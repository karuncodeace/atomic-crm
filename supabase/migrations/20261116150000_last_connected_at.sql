-- "Connected" date: when a lead last answered a call (any outcome but
-- no_answer). Shown instead of the created date in the leads table and the
-- daily call list. Kept by a trigger on call_logs, backfilled from history.

alter table public.contacts add column if not exists last_connected_at timestamp with time zone;
alter table public.deals add column if not exists last_connected_at timestamp with time zone;

-- Appended as the view's last column, so CREATE OR REPLACE keeps the layout.
create or replace view public.contacts_summary with (security_invoker = on) as
select
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.email_jsonb,
    co.phone_jsonb,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'))::text as email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'))::text as phone_fts,
    c.name as company_name,
    (select count(*) from public.tasks t where t.contact_id = co.id and t.done_date is null) as nb_tasks,
    co.whatsapp_number,
    co.is_primary,
    co.lead_stage,
    co.retry_count,
    co.last_attempt_at,
    co.next_attempt_at,
    co.last_outcome,
    co.recycled_at,
    co.recycle_reason,
    co.assigned_to,
    co.assigned_at,
    co.import_batch_id,
    co.phone_e164,
    co.do_not_contact,
    c.sector as company_sector,
    co.last_connected_at
from public.contacts co
    left join public.companies c on co.company_id = c.id;

-- An answered call (any outcome but no_answer) stamps "connected" on the
-- contact and on its open lead(s); the leads table and call list show it.
CREATE OR REPLACE FUNCTION "public"."set_last_connected_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
    if new.outcome = 'no_answer' then
        return new;
    end if;

    update public.contacts c
    set last_connected_at = new.created_at
    where c.id = new.contact_id
      and (c.last_connected_at is null or c.last_connected_at < new.created_at);

    update public.deals d
    set last_connected_at = new.created_at
    where d.archived_at is null
      and new.contact_id = any (d.contact_ids)
      and (d.last_connected_at is null or d.last_connected_at < new.created_at);

    return new;
end;
$$;

-- Answered calls stamp the connected date on the contact and its lead
create or replace trigger set_last_connected_at
    after insert on public.call_logs
    for each row execute function public.set_last_connected_at();

-- Backfill from past answered calls.
update public.contacts c
set last_connected_at = l.connected_at
from (
    select contact_id, max(created_at) as connected_at
    from public.call_logs
    where outcome <> 'no_answer'
    group by contact_id
) l
where c.id = l.contact_id;

update public.deals d
set last_connected_at = l.connected_at
from (
    select d2.id, max(cl.created_at) as connected_at
    from public.deals d2
        join public.call_logs cl on cl.contact_id = any (d2.contact_ids)
    where cl.outcome <> 'no_answer'
    group by d2.id
) l
where d.id = l.id;
