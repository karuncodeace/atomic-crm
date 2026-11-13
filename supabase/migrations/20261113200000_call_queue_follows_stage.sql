-- Daily call queue follows the stage shown in the CRM.
-- Per dialer per day (BDE 25, manager 10): leftover open calls, then due
-- Callback / Not answered leads, then leads whose stage is still New.
-- Previously the queue read only the call engine's own lead_stage /
-- last_outcome, so a lead marked Interested / Callback from the leads table
-- or a note could be handed out as a "new" call, and a Callback set there was
-- never re-queued.

CREATE OR REPLACE FUNCTION "public"."assign_daily_calls"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_settings jsonb := public.call_engine_settings();
    v_bde_quota integer := greatest(coalesce((v_settings->>'dailyCallQuota')::integer, 25), 0);
    v_manager_quota integer := greatest(coalesce((v_settings->>'managerDailyCallQuota')::integer, 10), 0);
    v_quota integer;
    v_tz text := coalesce(v_settings->>'timezone', 'Asia/Kolkata');
    v_today date := (timezone(v_tz, now()))::date;
    v_dow integer := extract(isodow from v_today)::integer;
    v_working jsonb := coalesce(v_settings->'workingDays', '[1,2,3,4,5]'::jsonb);
    v_sales record;
    v_open_count integer;
    v_slots integer;
    v_contact record;
    v_deal_id bigint;
    v_new_id bigint;
    v_assigned_total integer := 0;
    v_sales_count integer := 0;
begin
    if coalesce(auth.role(), '') <> 'service_role' and public.crm_role() is null then
        raise exception 'Not authorized' using errcode = '42501';
    end if;

    if not (v_working @> to_jsonb(v_dow)) then
        return jsonb_build_object(
            'date', v_today,
            'skipped', true,
            'reason', 'non_working_day',
            'assigned', 0
        );
    end if;

    -- Leftover calls for leads already closed elsewhere (marked Interested or
    -- Not interested from the leads table, a note, or recycled) leave the queue
    -- before leftovers are counted against the cap.
    update public.call_assignments a
    set status = 'done', done_at = now()
    from public.contacts c
    where a.status = 'open'
      and c.id = a.contact_id
      and (coalesce(c.do_not_contact, false)
          or c.lead_stage in ('interested', 'not_interested', 'recycled')
          or c.status in ('interested', 'not_interested'));

    for v_sales in
        select s.id, s.role
        from public.sales s
        where not s.disabled
          and s.role in ('bde', 'manager')
        order by case when s.role = 'bde' then 0 else 1 end, s.id
    loop
        v_sales_count := v_sales_count + 1;
        v_quota := case
            when v_sales.role = 'manager' then v_manager_quota
            else v_bde_quota
        end;

        -- Carry leftover open assignments into today's cap (do not re-insert).
        select count(*)::integer into v_open_count
        from public.call_assignments a
        where a.sales_id = v_sales.id
          and a.status = 'open';

        v_slots := greatest(v_quota - v_open_count, 0);
        if v_slots = 0 then
            continue;
        end if;

        -- Due callbacks / not-answered leads: the stage shown in the CRM
        -- (contact status = lead stage) decides, so a Callback set from the
        -- leads table is queued too. This dialer's own first, then the pool.
        for v_contact in
            select c.id, c.company_id
            from public.contacts c
            where (c.assigned_to = v_sales.id or c.assigned_to is null)
              and coalesce(c.do_not_contact, false) = false
              and c.lead_stage is not null
              and c.lead_stage not in ('interested', 'not_interested', 'recycled')
              and (c.status in ('callback', 'not_answered')
                  or (c.status is null and c.last_outcome in ('callback', 'no_answer')))
              and (c.next_attempt_at is null or (timezone(v_tz, c.next_attempt_at))::date <= v_today)
              and not exists (
                  select 1 from public.call_assignments a
                  where a.contact_id = c.id
                    and a.status = 'open'
              )
            order by case when c.assigned_to = v_sales.id then 0 else 1 end,
                     c.next_attempt_at nulls first, c.id
            limit v_slots
            for update skip locked
        loop
            update public.contacts
            set assigned_to = v_sales.id,
                sales_id = v_sales.id,
                assigned_at = coalesce(assigned_at, now())
            where id = v_contact.id
              and assigned_to is null;

            select d.id into v_deal_id
            from public.deals d
            where d.company_id = v_contact.company_id
              and d.archived_at is null
              and v_contact.id = any (d.contact_ids)
            order by d.id
            limit 1;

            insert into public.call_assignments (
                assignment_date, sales_id, contact_id, company_id, deal_id, status
            ) values (
                v_today, v_sales.id, v_contact.id, v_contact.company_id, v_deal_id, 'open'
            )
            on conflict (sales_id, contact_id, assignment_date) do nothing
            returning id into v_new_id;

            if v_new_id is not null then
                v_assigned_total := v_assigned_total + 1;
                v_slots := v_slots - 1;
                v_new_id := null;
            end if;
            exit when v_slots <= 0;
        end loop;

        if v_slots <= 0 then
            continue;
        end if;

        -- Fill with new / queued leads: unassigned pool OR already owned by
        -- this dialer (import pre-assigns BDEs, so those must still dial).
        for v_contact in
            select c.id, c.company_id
            from public.contacts c
            where (c.assigned_to is null or c.assigned_to = v_sales.id)
              and coalesce(c.do_not_contact, false) = false
              and c.lead_stage in ('new', 'queued')
              and coalesce(c.status, 'new') not in ('callback', 'interested', 'not_interested', 'not_answered')
              and not exists (
                  select 1 from public.call_assignments a
                  where a.contact_id = c.id
                    and a.status = 'open'
              )
            order by case when c.assigned_to = v_sales.id then 0 else 1 end,
                     c.first_seen nulls last, c.id
            limit v_slots
            for update skip locked
        loop
            -- Claim the lead: the dialer now owns it, so its callbacks come
            -- back to the same person and no one else is handed it.
            update public.contacts
            set assigned_to = v_sales.id,
                sales_id = v_sales.id,
                assigned_at = coalesce(assigned_at, now()),
                lead_stage = case
                    when lead_stage = 'new' then 'queued'
                    else lead_stage
                end
            where id = v_contact.id;

            -- The company / deal follow the first dialer to claim one of its
            -- leads, unless another active dialer already owns them.
            update public.companies co
            set sales_id = v_sales.id
            where co.id = v_contact.company_id
              and not exists (
                  select 1 from public.sales s
                  where s.id = co.sales_id
                    and not s.disabled
                    and s.role in ('bde', 'manager')
              );

            update public.deals d
            set sales_id = v_sales.id
            where d.company_id = v_contact.company_id
              and d.archived_at is null
              and v_contact.id = any (d.contact_ids)
              and not exists (
                  select 1 from public.sales s
                  where s.id = d.sales_id
                    and not s.disabled
                    and s.role in ('bde', 'manager')
              );

            select d.id into v_deal_id
            from public.deals d
            where d.company_id = v_contact.company_id
              and d.archived_at is null
              and v_contact.id = any (d.contact_ids)
            order by d.id
            limit 1;

            insert into public.call_assignments (
                assignment_date, sales_id, contact_id, company_id, deal_id, status
            ) values (
                v_today, v_sales.id, v_contact.id, v_contact.company_id, v_deal_id, 'open'
            )
            on conflict (sales_id, contact_id, assignment_date) do nothing
            returning id into v_new_id;

            if v_new_id is not null then
                v_assigned_total := v_assigned_total + 1;
                v_slots := v_slots - 1;
                v_new_id := null;
            end if;
            exit when v_slots <= 0;
        end loop;
    end loop;

    return jsonb_build_object(
        'date', v_today,
        'skipped', false,
        'sales_processed', v_sales_count,
        'assigned', v_assigned_total,
        'quota', v_bde_quota,
        'manager_quota', v_manager_quota
    );
end;
$$;


-- The call engine's lead_stage follows the stage shown in the CRM (contact
-- status = lead stage), whichever screen changed it, so the daily call queue
-- picks leads by what users see. A lead closed as Interested / Not interested
-- also leaves every open call queue at once.
CREATE OR REPLACE FUNCTION "public"."sync_contact_status_to_call_queue"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_lead_stage text;
begin
    if new.lead_stage is null or new.status is not distinct from old.status then
        return new;
    end if;

    v_lead_stage := case new.status
        when 'interested' then 'interested'
        when 'not_interested' then 'not_interested'
        when 'callback' then 'in_progress'
        when 'not_answered' then
            case when new.lead_stage = 'recycled' then 'recycled' else 'in_progress' end
        when 'new' then
            case when new.lead_stage in ('new', 'queued') then new.lead_stage else 'queued' end
    end;
    if v_lead_stage is null then
        return new;
    end if;

    update public.contacts
    set lead_stage = v_lead_stage
    where id = new.id
      and lead_stage is distinct from v_lead_stage;

    if new.status in ('interested', 'not_interested') then
        update public.call_assignments
        set status = 'done', done_at = now()
        where contact_id = new.id
          and status = 'open';
    end if;

    return new;
end;
$$;

-- Keep the call engine's lead_stage equal to the visible stage
create or replace trigger sync_contact_status_to_call_queue
    after update of status on public.contacts
    for each row execute function public.sync_contact_status_to_call_queue();

-- Catch-up: align lead_stage with the visible stage, then close open calls
-- for leads that are already Interested / Not interested.
update public.contacts c
set lead_stage = case c.status
        when 'interested' then 'interested'
        when 'not_interested' then 'not_interested'
        when 'callback' then 'in_progress'
        when 'not_answered' then case when c.lead_stage = 'recycled' then 'recycled' else 'in_progress' end
    end
where c.lead_stage is not null
  and c.status in ('interested', 'not_interested', 'callback', 'not_answered')
  and c.lead_stage is distinct from case c.status
        when 'interested' then 'interested'
        when 'not_interested' then 'not_interested'
        when 'callback' then 'in_progress'
        when 'not_answered' then case when c.lead_stage = 'recycled' then 'recycled' else 'in_progress' end
    end;

update public.call_assignments a
set status = 'done', done_at = now()
from public.contacts c
where a.status = 'open'
  and c.id = a.contact_id
  and (c.lead_stage in ('interested', 'not_interested')
      or c.status in ('interested', 'not_interested'));
