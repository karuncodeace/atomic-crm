-- Callback follow-ups and call notes:
-- 1. A lead moved to the callback stage gets a "Call back" task.
-- 2. Notes typed with a call outcome are copied to the contact's notes
--    (they were only stored in call_logs, which no screen shows), and the
--    existing ones are backfilled.

-- A lead moved to the callback stage (leads table, board, form or a call
-- outcome) gets a "Call back" task on its main contact, due at the contact's
-- scheduled next attempt, or the next working day at 10:00. Skipped when that
-- contact already has an open call task, so stage changes never stack tasks.
CREATE OR REPLACE FUNCTION "public"."create_callback_task"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_tz text := coalesce(public.call_engine_settings()->>'timezone', 'Asia/Kolkata');
    v_contact_id bigint;
    v_due timestamp with time zone;
begin
    if new.stage is distinct from 'callback' or new.archived_at is not null then
        return new;
    end if;
    if tg_op = 'UPDATE' and old.stage is not distinct from 'callback' then
        return new;
    end if;

    select c.id, c.next_attempt_at into v_contact_id, v_due
    from public.contacts c
    where c.id = any (new.contact_ids)
    order by c.is_primary desc nulls last, array_position(new.contact_ids, c.id)
    limit 1;

    if v_contact_id is null then
        return new;
    end if;

    if exists (
        select 1 from public.tasks t
        where t.contact_id = v_contact_id
          and t.done_date is null
          and t.type = 'call'
    ) then
        return new;
    end if;

    if v_due is null or v_due < now() then
        v_due := (public.add_working_days((timezone(v_tz, now()))::date, 1)::text || ' 10:00:00')::timestamp
            at time zone v_tz;
    end if;

    insert into public.tasks (contact_id, type, text, due_date, sales_id)
    values (
        v_contact_id,
        'call',
        concat_ws(' ', 'Call back', new.name),
        v_due,
        coalesce(new.sales_id, public.current_sales_id())
    );

    return new;
end;
$$;

-- Notes typed when recording a call outcome are copied to the contact's
-- notes, with the outcome as the note status, so they show on the lead.
CREATE OR REPLACE FUNCTION "public"."copy_call_log_note"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
    if nullif(trim(coalesce(new.notes, '')), '') is null then
        return new;
    end if;

    insert into public.contact_notes (contact_id, text, date, sales_id, status)
    values (
        new.contact_id,
        trim(new.notes),
        new.created_at,
        new.sales_id,
        case new.outcome when 'no_answer' then 'not_answered' else new.outcome end
    );

    return new;
end;
$$;

-- A lead entering the callback stage gets a "Call back" task
create or replace trigger create_callback_task
    after insert or update of stage on public.deals
    for each row execute function public.create_callback_task();

-- Call outcome notes also land in the contact's notes
create or replace trigger copy_call_log_note
    after insert on public.call_logs
    for each row execute function public.copy_call_log_note();

-- Backfill: past call notes that never reached the contact's notes.
insert into public.contact_notes (contact_id, text, date, sales_id, status)
select
    l.contact_id,
    trim(l.notes),
    l.created_at,
    l.sales_id,
    case l.outcome when 'no_answer' then 'not_answered' else l.outcome end
from public.call_logs l
where nullif(trim(coalesce(l.notes, '')), '') is not null
  and exists (select 1 from public.contacts c where c.id = l.contact_id)
  and not exists (
      select 1 from public.contact_notes n
      where n.contact_id = l.contact_id
        and n.text = trim(l.notes)
  );
