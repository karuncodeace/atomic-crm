-- Daily call queue = New leads only.
-- Per dialer per day (BDE 25, manager 10): yesterday's leftover open calls
-- first, then fill with leads whose stage is still New. Callback and Not
-- answered leads no longer come back in the queue: they are listed and
-- worked on the Follow-ups page. A lead moving to any stage other than New
-- leaves the open queue straight away.

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

    -- The daily queue only holds New leads. Leftover calls whose lead has
    -- since moved on (Callback / Not answered go to the Follow-ups page,
    -- Interested / Not interested are closed) leave the queue before the
    -- leftovers are counted against the cap.
    update public.call_assignments a
    set status = 'done', done_at = now()
    from public.contacts c
    where a.status = 'open'
      and c.id = a.contact_id
      and (coalesce(c.do_not_contact, false)
          or c.lead_stage in ('interested', 'not_interested', 'recycled')
          or c.status in ('callback', 'not_answered', 'interested', 'not_interested'));

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

    -- The daily queue holds New leads only: any other stage leaves it
    -- (Callback / Not answered are worked from the Follow-ups page).
    if new.status in ('callback', 'not_answered', 'interested', 'not_interested') then
        update public.call_assignments
        set status = 'done', done_at = now()
        where contact_id = new.id
          and status = 'open';
    end if;

    return new;
end;
$$;

-- Catch-up: open calls whose lead is already on Callback / Not answered
-- move out of the queue (they show on the Follow-ups page).
update public.call_assignments a
set status = 'done', done_at = now()
from public.contacts c
where a.status = 'open'
  and c.id = a.contact_id
  and c.status in ('callback', 'not_answered');

-- A call made from the Follow-ups page (Callback / Not answered leads, which
-- are not in the daily queue). It records the outcome exactly like a queue
-- call: a call assignment for today is opened for the caller and completed
-- through record_call_outcome, so logs, retries, stage sync and the next
-- callback date behave the same. The caller must be able to see the lead
-- (same rule as the contacts read policy).
CREATE OR REPLACE FUNCTION "public"."record_followup_outcome"(
    "p_contact_id" bigint,
    "p_outcome" "text",
    "p_notes" "text" DEFAULT NULL,
    "p_next_attempt_at" timestamp with time zone DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_sales_id bigint := public.current_sales_id();
    v_tz text := coalesce(public.call_engine_settings()->>'timezone', 'Asia/Kolkata');
    v_company_id bigint;
    v_deal_id bigint;
    v_assignment_id bigint;
begin
    if v_sales_id is null then
        raise exception 'Not authenticated as a sales user' using errcode = '42501';
    end if;

    select c.company_id into v_company_id
    from public.contacts c
    where c.id = p_contact_id
      and (public.crm_role() = 'admin'
          or c.assigned_to = v_sales_id
          or (c.assigned_to is null and c.sales_id = v_sales_id));
    if not found then
        raise exception 'Lead % not found', p_contact_id using errcode = 'P0002';
    end if;

    select d.id into v_deal_id
    from public.deals d
    where d.archived_at is null
      and p_contact_id = any (d.contact_ids)
    order by d.id
    limit 1;

    insert into public.call_assignments (
        assignment_date, sales_id, contact_id, company_id, deal_id, status
    ) values (
        (timezone(v_tz, now()))::date, v_sales_id, p_contact_id, v_company_id, v_deal_id, 'open'
    )
    on conflict (sales_id, contact_id, assignment_date)
    do update set status = 'open', done_at = null, deal_id = excluded.deal_id
    returning id into v_assignment_id;

    return public.record_call_outcome(v_assignment_id, p_outcome, p_notes, p_next_attempt_at);
end;
$$;
revoke all on function public.record_followup_outcome(bigint, text, text, timestamp with time zone) from public, anon;
grant all on function public.record_followup_outcome(bigint, text, text, timestamp with time zone) to authenticated;
grant all on function public.record_followup_outcome(bigint, text, text, timestamp with time zone) to service_role;
