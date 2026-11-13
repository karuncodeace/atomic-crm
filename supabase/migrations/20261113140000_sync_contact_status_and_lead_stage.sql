-- Keep contact status and lead (deal) stage in sync, both ways.
-- A call outcome now also sets the contact status, so the lead updates even
-- when the call assignment has no deal linked.

CREATE OR REPLACE FUNCTION "public"."record_call_outcome"(
    "p_assignment_id" bigint,
    "p_outcome" "text",
    "p_notes" "text" DEFAULT NULL,
    "p_next_attempt_at" timestamp with time zone DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_assignment public.call_assignments%rowtype;
    v_sales_id bigint := public.current_sales_id();
    v_outcome text := lower(trim(p_outcome));
    v_settings jsonb := public.call_engine_settings();
    v_tz text := coalesce(v_settings->>'timezone', 'Asia/Kolkata');
    v_retry_days integer := greatest(coalesce((v_settings->>'retryWindowWorkingDays')::integer, 3), 1);
    v_today date := (timezone(v_tz, now()))::date;
    v_next timestamp with time zone;
    v_retry integer;
    v_lead_stage text;
    v_deal_stage text;
    v_log_id bigint;
begin
    if v_sales_id is null then
        raise exception 'Not authenticated as a sales user' using errcode = '42501';
    end if;
    if v_outcome not in ('interested', 'callback', 'no_answer', 'not_interested') then
        raise exception 'Invalid outcome: %', p_outcome using errcode = '22023';
    end if;

    select * into v_assignment
    from public.call_assignments
    where id = p_assignment_id
    for update;

    if not found then
        raise exception 'Assignment % not found', p_assignment_id using errcode = 'P0002';
    end if;
    if v_assignment.status <> 'open' then
        raise exception 'Assignment % is already done', p_assignment_id using errcode = '22023';
    end if;
    -- Shared queue: any active sales user can complete any open assignment.
    if public.crm_role() is null then
        raise exception 'Not authorized' using errcode = '42501';
    end if;

    select retry_count into v_retry from public.contacts where id = v_assignment.contact_id;
    v_retry := coalesce(v_retry, 0);

    if v_outcome = 'callback' then
        v_next := coalesce(
            p_next_attempt_at,
            (public.add_working_days(v_today, 1)::text || ' 10:00:00')::timestamp
                at time zone v_tz
        );
        v_lead_stage := 'in_progress';
        v_deal_stage := 'callback';
    elsif v_outcome = 'no_answer' then
        v_retry := v_retry + 1;
        if v_retry >= v_retry_days then
            v_next := null;
            v_lead_stage := 'recycled';
            v_deal_stage := 'not_answered';
        else
            v_next := coalesce(
                p_next_attempt_at,
                (public.add_working_days(v_today, 1)::text || ' 10:00:00')::timestamp
                    at time zone v_tz
            );
            v_lead_stage := 'in_progress';
            v_deal_stage := 'not_answered';
        end if;
    elsif v_outcome = 'interested' then
        v_next := null;
        v_lead_stage := 'interested';
        v_deal_stage := 'interested';
    else
        v_next := null;
        v_lead_stage := 'not_interested';
        v_deal_stage := 'not_interested';
    end if;

    insert into public.call_logs (
        assignment_id, sales_id, contact_id, outcome, notes, next_attempt_at
    ) values (
        v_assignment.id,
        coalesce(v_sales_id, v_assignment.sales_id),
        v_assignment.contact_id,
        v_outcome,
        nullif(trim(coalesce(p_notes, '')), ''),
        v_next
    )
    returning id into v_log_id;

    update public.call_assignments
    set status = 'done', done_at = now()
    where id = v_assignment.id;

    update public.contacts set
        status = v_deal_stage,
        last_outcome = v_outcome,
        last_attempt_at = now(),
        next_attempt_at = v_next,
        retry_count = v_retry,
        lead_stage = v_lead_stage,
        recycled_at = case when v_lead_stage = 'recycled' then now() else recycled_at end,
        recycle_reason = case
            when v_lead_stage = 'recycled' then 'max_no_answer_retries'
            else recycle_reason
        end
    where id = v_assignment.contact_id;

    if v_assignment.deal_id is not null then
        update public.deals
        set stage = v_deal_stage, updated_at = now()
        where id = v_assignment.deal_id
          and archived_at is null;
    else
        update public.deals d
        set stage = v_deal_stage, updated_at = now()
        where d.company_id = v_assignment.company_id
          and d.archived_at is null
          and v_assignment.contact_id = any (d.contact_ids);
    end if;

    return jsonb_build_object(
        'assignment_id', v_assignment.id,
        'log_id', v_log_id,
        'outcome', v_outcome,
        'lead_stage', v_lead_stage,
        'deal_stage', v_deal_stage,
        'next_attempt_at', v_next
    );
end;
$$;


-- Contact status and lead (deal) stage share the same values (new, callback,
-- interested, not_interested, not_answered) and are kept equal both ways, so
-- a status set from a note, the contact page or a call outcome shows in the
-- leads table, and a stage set in the leads table shows on the contact.
-- The "is distinct from" guards stop the two triggers from looping.
CREATE OR REPLACE FUNCTION "public"."sync_contact_status_to_deals"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
    if new.status is null
        or new.status is not distinct from old.status
        or new.status not in ('new', 'callback', 'interested', 'not_interested', 'not_answered') then
        return new;
    end if;

    update public.deals d
    set stage = new.status, updated_at = now()
    where d.archived_at is null
      and new.id = any (d.contact_ids)
      and d.stage is distinct from new.status;

    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."sync_deal_stage_to_contacts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
    if new.archived_at is not null
        or new.stage not in ('new', 'callback', 'interested', 'not_interested', 'not_answered') then
        return new;
    end if;
    if tg_op = 'UPDATE' and new.stage is not distinct from old.stage then
        return new;
    end if;

    update public.contacts c
    set status = new.stage
    where c.id = any (new.contact_ids)
      and c.status is distinct from new.stage;

    return new;
end;
$$;

-- Keep contact status and lead stage equal (see sync_* functions)
create or replace trigger sync_contact_status_to_deals
    after update of status on public.contacts
    for each row execute function public.sync_contact_status_to_deals();

create or replace trigger sync_deal_stage_to_contacts
    after insert or update of stage on public.deals
    for each row execute function public.sync_deal_stage_to_contacts();
