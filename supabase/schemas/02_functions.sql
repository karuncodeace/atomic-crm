

-- Dashboard numbers in one call. Read-only. Admins and managers get the whole
-- calling team (every active BDE and manager) plus one row per person; a BDE
-- gets their own numbers only. "Connected" = any outcome except no_answer.
-- The daily target is the call engine quota (BDE 25, manager 10 by default).
-- `days` = the last 14 days of calls (oldest first) for the activity chart.
CREATE OR REPLACE FUNCTION "public"."dashboard_stats"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_role text := public.crm_role();
    v_me bigint := public.current_sales_id();
    v_team boolean;
    v_settings jsonb := public.call_engine_settings();
    v_tz text := coalesce(v_settings->>'timezone', 'Asia/Kolkata');
    v_bde_quota integer := greatest(coalesce((v_settings->>'dailyCallQuota')::integer, 25), 0);
    v_manager_quota integer := greatest(coalesce((v_settings->>'managerDailyCallQuota')::integer, 10), 0);
    v_today date := (timezone(v_tz, now()))::date;
    v_month date := date_trunc('month', v_today)::date;
    v_from date := (date_trunc('month', v_today) - interval '5 months')::date;
    v_result jsonb;
begin
    if v_role is null then
        raise exception 'Not authorized' using errcode = '42501';
    end if;
    v_team := v_role in ('admin', 'manager');

    with people as (
        select s.id, s.first_name, s.last_name, s.role, s.avatar,
            case when s.role = 'manager' then v_manager_quota else v_bde_quota end as target
        from public.sales s
        where not s.disabled
          and s.role in ('bde', 'manager')
          and (v_team or s.id = v_me)
    ),
    logs as (
        select l.sales_id, l.outcome, (timezone(v_tz, l.created_at))::date as day
        from public.call_logs l
        where l.sales_id in (select id from people)
          and l.created_at >= (v_from::timestamp at time zone v_tz)
    ),
    per_person as (
        select p.id, p.first_name, p.last_name, p.role, p.avatar, p.target,
            count(l.*) filter (where l.day = v_today) as calls_today,
            count(l.*) filter (where l.day = v_today and l.outcome <> 'no_answer') as connected_today,
            count(l.*) filter (where l.day = v_today and l.outcome = 'interested') as interested_today,
            count(l.*) filter (where l.day >= v_month) as calls_month,
            count(l.*) filter (where l.day >= v_month and l.outcome <> 'no_answer') as connected_month,
            count(l.*) filter (where l.day >= v_month and l.outcome = 'interested') as interested_month,
            (select count(*) from public.call_assignments a
                where a.sales_id = p.id and a.status = 'open') as open_calls,
            (select count(*) from public.deals d
                where d.sales_id = p.id and d.archived_at is null) as leads
        from people p
            left join logs l on l.sales_id = p.id
        group by p.id, p.first_name, p.last_name, p.role, p.avatar, p.target
    ),
    months as (
        select m::date as month,
            count(l.*) as calls,
            count(l.*) filter (where l.outcome <> 'no_answer') as connected,
            count(l.*) filter (where l.outcome = 'interested') as interested
        from generate_series(v_from, v_month, interval '1 month') as m
            left join logs l on date_trunc('month', l.day) = m
        group by m
    ),
    days as (
        select d::date as day,
            count(l.*) as calls,
            count(l.*) filter (where l.outcome <> 'no_answer') as connected,
            count(l.*) filter (where l.outcome = 'interested') as interested
        from generate_series(v_today - 13, v_today, interval '1 day') as d
            left join logs l on l.day = d::date
        group by d
    ),
    scoped_deals as (
        select d.stage
        from public.deals d
        where d.archived_at is null
          and (v_team or d.sales_id = v_me)
    )
    select jsonb_build_object(
        'scope', case when v_team then 'team' else 'self' end,
        'today', v_today,
        'target', coalesce((select sum(target) from people), 0),
        'calls_today', coalesce((select sum(calls_today) from per_person), 0),
        'connected_today', coalesce((select sum(connected_today) from per_person), 0),
        'interested_today', coalesce((select sum(interested_today) from per_person), 0),
        'open_calls', coalesce((select sum(open_calls) from per_person), 0),
        'outcomes_today', (
            select jsonb_build_object(
                'interested', count(*) filter (where outcome = 'interested'),
                'callback', count(*) filter (where outcome = 'callback'),
                'no_answer', count(*) filter (where outcome = 'no_answer'),
                'not_interested', count(*) filter (where outcome = 'not_interested'))
            from logs where day = v_today),
        'months', (select coalesce(jsonb_agg(jsonb_build_object(
                'month', month, 'calls', calls, 'connected', connected, 'interested', interested)
                order by month), '[]'::jsonb) from months),
        'days', (select coalesce(jsonb_agg(jsonb_build_object(
                'day', day, 'calls', calls, 'connected', connected, 'interested', interested)
                order by day), '[]'::jsonb) from days),
        'stages', (select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb)
            from (select stage, count(*) as n from scoped_deals group by stage) s),
        'leads_total', (select count(*) from scoped_deals),
        'callbacks_due', (
            select count(*) from public.contacts c
            where c.status = 'callback'
              and (c.next_attempt_at is null or (timezone(v_tz, c.next_attempt_at))::date <= v_today)
              and (v_team or c.assigned_to = v_me)),
        'overdue_tasks', (
            select count(*) from public.tasks t
            where t.done_date is null
              and t.due_date < (v_today::timestamp at time zone v_tz)
              and (v_team or t.sales_id = v_me)),
        'pending_brochures', case when v_team then (
            select count(*) from public.brochures b where b.status = 'pending') end,
        'team', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', id, 'first_name', first_name, 'last_name', last_name,
                'role', role, 'avatar', avatar, 'target', target,
                'calls_today', calls_today, 'connected_today', connected_today,
                'interested_today', interested_today, 'open_calls', open_calls,
                'calls_month', calls_month, 'connected_month', connected_month,
                'interested_month', interested_month, 'leads', leads)
                order by calls_today desc, first_name), '[]'::jsonb) from per_person)
    ) into v_result;

    return v_result;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."set_deal_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
    -- Kanban reordering only shifts index: not a real change of the lead
    if (to_jsonb(new) - 'index' - 'updated_at') is distinct from (to_jsonb(old) - 'index' - 'updated_at') then
        new.updated_at = now();
    end if;
    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."record_salestrail_call"("p_call_id" "text", "p_user_email" "text", "p_phone" "text", "p_is_inbound" boolean, "p_started_at" timestamp with time zone, "p_duration_seconds" integer) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
    v_contact_id bigint;
    v_company_id bigint;
    v_sales_id bigint;
    v_deal_id bigint;
    v_id bigint;
begin
    -- Too short to identify a lead (service numbers, blank caller id)
    if length(v_digits) < 10 then
        return null;
    end if;

    -- Match on the last 10 digits, so "+91 98765 43210" and "09876543210"
    -- agree: first the contact's phones, then the company's.
    select co.id, co.company_id into v_contact_id, v_company_id
    from public.contacts co
    where right(regexp_replace(coalesce(co.phone_e164, ''), '\D', '', 'g'), 10) = v_digits
       or right(regexp_replace(coalesce(co.whatsapp_number, ''), '\D', '', 'g'), 10) = v_digits
       or exists (
           select 1
           from jsonb_array_elements(coalesce(co.phone_jsonb, '[]'::jsonb)) ph
           where right(regexp_replace(coalesce(ph->>'number', ''), '\D', '', 'g'), 10) = v_digits
       )
    order by (co.phone_e164 = p_phone) desc nulls last, co.id desc
    limit 1;

    if v_contact_id is null then
        select c.id into v_company_id
        from public.companies c
        where right(regexp_replace(coalesce(c.phone_number, ''), '\D', '', 'g'), 10) = v_digits
           or right(regexp_replace(coalesce(c.whatsapp_number, ''), '\D', '', 'g'), 10) = v_digits
        order by c.id desc
        limit 1;

        if v_company_id is not null then
            select co.id into v_contact_id
            from public.contacts co
            where co.company_id = v_company_id
            order by co.is_primary desc, co.id
            limit 1;
        end if;
    end if;

    -- The lead: one listing the contact, else one of its company; open first
    select d.id into v_deal_id
    from public.deals d
    where (v_contact_id is not null and v_contact_id = any (d.contact_ids))
       or (v_company_id is not null and d.company_id = v_company_id)
    order by (v_contact_id is not null and v_contact_id = any (d.contact_ids)) desc,
             (d.archived_at is null) desc,
             d.updated_at desc
    limit 1;

    -- Not a lead (e.g. a personal call): never stored
    if v_contact_id is null and v_deal_id is null then
        return null;
    end if;

    select s.id into v_sales_id
    from public.sales s
    where lower(s.email) = lower(p_user_email)
       or lower(p_user_email) in (select lower(e) from jsonb_array_elements_text(s.secondary_emails) e)
    order by s.disabled, s.id
    limit 1;

    insert into public.call_recordings (
        salestrail_call_id, sales_id, contact_id, deal_id, phone_number,
        is_inbound, started_at, duration_seconds
    )
    values (
        p_call_id, v_sales_id, v_contact_id, v_deal_id, p_phone,
        p_is_inbound, p_started_at, greatest(coalesce(p_duration_seconds, 0), 0)
    )
    on conflict (salestrail_call_id) do nothing
    returning id into v_id;

    return v_id;
end;
$$;
