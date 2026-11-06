-- BDE daily cap stays 25. Managers get 10, with the same follow-up order:
-- open leftovers, due callbacks / no-answers, then new or queued leads.

CREATE OR REPLACE FUNCTION "public"."call_engine_settings"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
      'dailyCallQuota', 25,
      'managerDailyCallQuota', 10,
      'retryWindowWorkingDays', 3,
      'timezone', 'Asia/Kolkata',
      'workingDays', jsonb_build_array(1, 2, 3, 4, 5),
      'holidays', jsonb_build_array(),
      'recycleCooldownDays', 7,
      'assignmentTime', '08:30'
    ) || coalesce((select config -> 'callEngine' from public.configuration where id = 1), '{}'::jsonb);
$$;

-- Advance a date by N working days (Mon–Fri by default from call_engine_settings).

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

        -- Due callbacks / no-answers already owned by this dialer.
        for v_contact in
            select c.id, c.company_id
            from public.contacts c
            where c.assigned_to = v_sales.id
              and coalesce(c.do_not_contact, false) = false
              and c.lead_stage is not null
              and c.lead_stage not in ('interested', 'not_interested', 'recycled')
              and c.last_outcome in ('callback', 'no_answer')
              and (c.next_attempt_at is null or (timezone(v_tz, c.next_attempt_at))::date <= v_today)
              and not exists (
                  select 1 from public.call_assignments a
                  where a.sales_id = v_sales.id
                    and a.contact_id = c.id
                    and a.status = 'open'
              )
            order by c.next_attempt_at nulls first, c.id
            limit v_slots
        loop
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
            update public.contacts
            set assigned_to = v_sales.id,
                assigned_at = coalesce(assigned_at, now()),
                lead_stage = case
                    when lead_stage = 'new' then 'queued'
                    else lead_stage
                end
            where id = v_contact.id;

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

-- Complete one call: write log, close assignment, sync contact + deal stage.
