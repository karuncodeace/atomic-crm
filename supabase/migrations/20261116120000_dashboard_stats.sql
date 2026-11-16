-- Dashboard redesign: one read-only stats call for the dashboard.

create index if not exists call_logs_sales_id_created_at_idx on public.call_logs using btree (sales_id, created_at);

-- Dashboard numbers in one call. Read-only. Admins and managers get the whole
-- calling team (every active BDE and manager) plus one row per person; a BDE
-- gets their own numbers only. "Connected" = any outcome except no_answer.
-- The daily target is the call engine quota (BDE 25, manager 10 by default).
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

revoke execute on function public.dashboard_stats() from public, anon;
grant execute on function public.dashboard_stats() to authenticated, service_role;
