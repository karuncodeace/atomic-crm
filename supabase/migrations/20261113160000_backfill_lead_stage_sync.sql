-- One-off catch-up for leads whose stage and contact status drifted apart
-- before the two-way sync existed (20261113140000).
--
-- 1. Each open lead takes the most recent outcome recorded on its contacts
--    (a call outcome or a note with a status) when that outcome is newer than
--    the lead's last update, or when the lead is still on "new".
-- 2. Contacts then take their lead's stage.
-- 3. Leads that end up on "callback" without an open call task get one.
-- The sync / callback triggers are paused so this runs as one plain pass.

alter table public.deals disable trigger sync_deal_stage_to_contacts;
alter table public.deals disable trigger create_callback_task;
alter table public.contacts disable trigger sync_contact_status_to_deals;

with events as (
    select d.id as deal_id, l.created_at as happened_at,
        case l.outcome when 'no_answer' then 'not_answered' else l.outcome end as stage
    from public.deals d
        join public.call_logs l on l.contact_id = any (d.contact_ids)
    where d.archived_at is null
    union all
    select d.id, n.date, n.status
    from public.deals d
        join public.contact_notes n on n.contact_id = any (d.contact_ids)
    where d.archived_at is null
      and n.status in ('new', 'callback', 'interested', 'not_interested', 'not_answered')
),
latest as (
    select distinct on (deal_id) deal_id, happened_at, stage
    from events
    where happened_at is not null
    order by deal_id, happened_at desc
)
update public.deals d
set stage = latest.stage, updated_at = now()
from latest
where d.id = latest.deal_id
  and d.stage is distinct from latest.stage
  and (d.stage = 'new' or latest.happened_at > d.updated_at);

with lead_stage as (
    select distinct on (c.id) c.id as contact_id, d.stage
    from public.contacts c
        join public.deals d on c.id = any (d.contact_ids)
    where d.archived_at is null
      and d.stage in ('new', 'callback', 'interested', 'not_interested', 'not_answered')
    order by c.id, d.updated_at desc
)
update public.contacts c
set status = lead_stage.stage
from lead_stage
where c.id = lead_stage.contact_id
  and c.status is distinct from lead_stage.stage;

insert into public.tasks (contact_id, type, text, due_date, sales_id)
select
    main.contact_id,
    'call',
    concat_ws(' ', 'Call back', d.name),
    case
        when main.next_attempt_at > now() then main.next_attempt_at
        else (public.add_working_days((timezone('Asia/Kolkata', now()))::date, 1)::text || ' 10:00:00')::timestamp
            at time zone 'Asia/Kolkata'
    end,
    d.sales_id
from public.deals d
    cross join lateral (
        select c.id as contact_id, c.next_attempt_at
        from public.contacts c
        where c.id = any (d.contact_ids)
        order by c.is_primary desc nulls last, array_position(d.contact_ids, c.id)
        limit 1
    ) main
where d.archived_at is null
  and d.stage = 'callback'
  and not exists (
      select 1 from public.tasks t
      where t.contact_id = main.contact_id
        and t.done_date is null
        and t.type = 'call'
  );

alter table public.deals enable trigger sync_deal_stage_to_contacts;
alter table public.deals enable trigger create_callback_task;
alter table public.contacts enable trigger sync_contact_status_to_deals;
