-- BDE owns every lead: import/create assign only to BDEs, enqueue Tasks,
-- and repair existing company/deal ownership that still points at admin.

-- Repair existing lead ownership onto the contact's BDE assignee.
UPDATE public.contacts c
SET sales_id = c.assigned_to
WHERE c.assigned_to IS NOT NULL
  AND c.sales_id IS DISTINCT FROM c.assigned_to;

UPDATE public.companies co
SET sales_id = sub.assigned_to
FROM (
  SELECT company_id, min(assigned_to) AS assigned_to
  FROM public.contacts
  WHERE assigned_to IS NOT NULL AND company_id IS NOT NULL
  GROUP BY company_id
) sub
WHERE co.id = sub.company_id
  AND co.sales_id IS DISTINCT FROM sub.assigned_to;

UPDATE public.deals d
SET sales_id = c.assigned_to
FROM public.contacts c
WHERE c.assigned_to IS NOT NULL
  AND c.id = ANY (d.contact_ids)
  AND d.sales_id IS DISTINCT FROM c.assigned_to;

-- Drop existing queued BDE leads into today's call queue.
INSERT INTO public.call_assignments (
  assignment_date, sales_id, contact_id, company_id, deal_id, status
)
SELECT
  (timezone(coalesce((public.call_engine_settings()->>'timezone'), 'Asia/Kolkata'), now()))::date,
  c.assigned_to,
  c.id,
  c.company_id,
  d.id,
  'open'
FROM public.contacts c
JOIN public.sales s ON s.id = c.assigned_to AND s.role = 'bde' AND NOT s.disabled
LEFT JOIN LATERAL (
  SELECT deals.id
  FROM public.deals
  WHERE deals.company_id = c.company_id
    AND deals.archived_at IS NULL
    AND c.id = ANY (deals.contact_ids)
  ORDER BY deals.id
  LIMIT 1
) d ON true
WHERE c.lead_stage IN ('new', 'queued')
  AND coalesce(c.do_not_contact, false) = false
  AND c.assigned_to IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.call_assignments a
    WHERE a.contact_id = c.id AND a.status = 'open'
  )
ON CONFLICT (sales_id, contact_id, assignment_date) DO NOTHING;

CREATE OR REPLACE FUNCTION "public"."assign_daily_calls"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_settings jsonb := public.call_engine_settings();
    v_quota integer := greatest(coalesce((v_settings->>'dailyCallQuota')::integer, 25), 0);
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
        select s.id
        from public.sales s
        where not s.disabled
          and s.role = 'bde'
        order by s.id
    loop
        v_sales_count := v_sales_count + 1;

        -- Carry leftover open assignments into today's cap (do not re-insert).
        select count(*)::integer into v_open_count
        from public.call_assignments a
        where a.sales_id = v_sales.id
          and a.status = 'open';

        v_slots := greatest(v_quota - v_open_count, 0);
        if v_slots = 0 then
            continue;
        end if;

        -- Due callbacks / no-answers already owned by this BDE.
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
        'quota', v_quota
    );
end;
$$;

-- Complete one call: write log, close assignment, sync contact + deal stage.

CREATE OR REPLACE FUNCTION "public"."import_leads"("p_file_name" "text", "p_rows" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
declare
    v_row jsonb;
    v_batch_id bigint;
    v_results jsonb := '[]'::jsonb;
    v_phone text;
    v_email text;
    v_company_name text;
    v_domain text;
    v_sector text;
    v_company_id bigint;
    v_contact_id bigint;
    v_assignee bigint;
    v_dialers bigint[];
    v_dialer_count int;
    v_seen_phones text[] := '{}';
    v_seen_emails text[] := '{}';
    v_created int := 0;
    v_duplicates int := 0;
    v_invalid int := 0;
    v_reason text;
begin
    if public.crm_role() is null then
        raise exception 'Not authorized' using errcode = '42501';
    end if;
    if jsonb_typeof(p_rows) is distinct from 'array' then
        raise exception 'p_rows must be an array' using errcode = '22023';
    end if;

    -- Never wait on favicon / gravatar HTTP calls during a bulk import.
    perform set_config('crm.skip_enrichment', 'on', true);

    -- Round-robin across active BDEs only (admin oversees, does not own leads).
    select coalesce(array_agg(s.id order by s.id), '{}'::bigint[])
      into v_dialers
    from public.sales s
    where not s.disabled
      and s.role = 'bde';
    v_dialer_count := coalesce(array_length(v_dialers, 1), 0);
    if v_dialer_count = 0 then
        raise exception 'No active BDE to assign leads to' using errcode = 'P0001';
    end if;

    insert into public.import_batches (created_by, file_name, total_rows)
    values (public.current_sales_id(), p_file_name, jsonb_array_length(p_rows))
    returning id into v_batch_id;

    for v_row in select * from jsonb_array_elements(p_rows)
    loop
        v_phone := nullif(trim(v_row->>'phone'), '');
        v_email := nullif(lower(trim(v_row->>'email')), '');
        v_company_name := nullif(trim(v_row->>'company_name'), '');
        v_domain := nullif(lower(trim(v_row->>'domain')), '');
        v_reason := null;

        if v_phone is null and v_email is null then
            v_reason := 'missing phone and email';
        elsif v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
            v_reason := 'invalid phone';
        elsif v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
            v_reason := 'invalid email';
        elsif v_company_name is null then
            v_reason := 'missing company name';
        end if;

        -- No contact person in the file: use the company name on the contact.
        if v_reason is null
            and nullif(trim(coalesce(v_row->>'first_name', '') || coalesce(v_row->>'last_name', '')), '') is null then
            v_row := jsonb_set(v_row, '{first_name}', to_jsonb(v_company_name));
        end if;

        if v_reason is not null then
            v_invalid := v_invalid + 1;
            v_results := v_results || jsonb_build_object('row', v_row->'row', 'status', 'invalid', 'reason', v_reason);
            continue;
        end if;

        select co.id into v_contact_id
        from public.contacts co
        where (v_phone is not null and co.phone_e164 = v_phone)
           or (v_email is not null and co.email_jsonb @> jsonb_build_array(jsonb_build_object('email', v_email)))
        limit 1;

        if v_contact_id is not null
            or (v_phone is not null and v_phone = any (v_seen_phones))
            or (v_email is not null and v_email = any (v_seen_emails)) then
            v_duplicates := v_duplicates + 1;
            v_results := v_results || jsonb_build_object(
                'row', v_row->'row', 'status', 'duplicate',
                'reason', case when v_contact_id is null then 'duplicate in file' else 'matches an existing lead' end,
                'contact_id', v_contact_id);
            continue;
        end if;

        -- Industry: reuse a sector by label or value, or create it.
        v_sector := null;
        if nullif(trim(v_row->>'industry'), '') is not null then
            select s.value into v_sector from public.company_sectors s
            where lower(s.label) = lower(trim(v_row->>'industry')) or s.value = lower(trim(v_row->>'industry'))
            limit 1;
            if v_sector is null then
                v_sector := trim(both '-' from regexp_replace(lower(trim(v_row->>'industry')), '[^a-z0-9]+', '-', 'g'));
                insert into public.company_sectors (value, label)
                values (v_sector, trim(v_row->>'industry'))
                on conflict do nothing;
            end if;
        end if;

        -- Company: same domain or same name is the same company.
        select c.id into v_company_id from public.companies c
        where (v_domain is not null and lower(regexp_replace(c.website::text, '^(https?://)?(www\.)?([^/:]+).*$', '\3')) = v_domain)
           or lower(c.name) = lower(v_company_name)
        order by c.id
        limit 1;

        v_assignee := v_dialers[1 + (v_created % v_dialer_count)];

        if v_company_id is null then
            insert into public.companies (
                name, sector, pitch_point, business_description, website,
                phone_number, email, whatsapp_number, city, address,
                context_links, lead_date, priority, sales_id, created_at
            )
            values (
                v_company_name,
                v_sector,
                nullif(trim(v_row->>'pitch'), ''),
                nullif(trim(v_row->>'business_description'), ''),
                case when v_domain is not null then 'https://' || v_domain end,
                nullif(trim(v_row->>'phone'), ''),
                v_email,
                coalesce(nullif(trim(v_row->>'whatsapp_number'), ''), v_phone),
                nullif(trim(v_row->>'city'), ''),
                nullif(trim(v_row->>'address'), ''),
                case
                    when jsonb_typeof(v_row->'social_media_urls') = 'array'
                        and jsonb_array_length(v_row->'social_media_urls') > 0
                    then (v_row->'social_media_urls')::json
                    else null
                end,
                coalesce(nullif(trim(v_row->>'lead_date'), '')::date, current_date),
                coalesce(nullif(trim(v_row->>'priority'), ''), 'medium'),
                v_assignee,
                now()
            )
            returning id into v_company_id;
        else
            update public.companies c set
                pitch_point = coalesce(c.pitch_point, nullif(trim(v_row->>'pitch'), '')),
                business_description = coalesce(c.business_description, nullif(trim(v_row->>'business_description'), '')),
                sector = coalesce(c.sector, v_sector),
                phone_number = coalesce(c.phone_number, nullif(trim(v_row->>'phone'), '')),
                email = coalesce(c.email, v_email),
                whatsapp_number = coalesce(c.whatsapp_number, nullif(trim(v_row->>'whatsapp_number'), ''), v_phone),
                city = coalesce(c.city, nullif(trim(v_row->>'city'), '')),
                address = coalesce(c.address, nullif(trim(v_row->>'address'), '')),
                -- context_links is json; social_media_urls from jsonb payload must cast
                context_links = coalesce(
                    c.context_links,
                    case
                        when jsonb_typeof(v_row->'social_media_urls') = 'array'
                            and jsonb_array_length(v_row->'social_media_urls') > 0
                        then (v_row->'social_media_urls')::json
                        else null::json
                    end
                ),
                priority = coalesce(c.priority, nullif(trim(v_row->>'priority'), ''), 'medium'),
                sales_id = coalesce(c.sales_id, v_assignee)
            where c.id = v_company_id;
        end if;

        insert into public.contacts (
            first_name, last_name, title, company_id, whatsapp_number, is_primary,
            email_jsonb, phone_jsonb, phone_e164,
            lead_stage, sales_id, assigned_to, assigned_at,
            import_batch_id, first_seen, last_seen, tags
        )
        values (
            nullif(trim(v_row->>'first_name'), ''),
            nullif(trim(v_row->>'last_name'), ''),
            nullif(trim(v_row->>'title'), ''),
            v_company_id,
            coalesce(nullif(trim(v_row->>'whatsapp_number'), ''), v_phone),
            not exists (
                select 1 from public.contacts existing
                where existing.company_id = v_company_id and existing.is_primary
            ),
            case when v_email is not null then jsonb_build_array(jsonb_build_object('email', v_email, 'type', 'Work')) end,
            case when v_phone is not null then jsonb_build_array(jsonb_build_object('number', v_phone, 'type', 'Work')) end,
            v_phone,
            'queued',
            v_assignee,
            v_assignee,
            now(),
            v_batch_id,
            now(),
            now(),
            '{}'
        )
        returning id into v_contact_id;

        perform public.open_cold_deal(
            v_company_id,
            array[v_contact_id],
            v_assignee,
            v_company_name
        );

        -- Put imported leads straight into today's BDE call queue.
        insert into public.call_assignments (
            assignment_date, sales_id, contact_id, company_id, deal_id, status
        )
        select
            (timezone(coalesce((public.call_engine_settings()->>'timezone'), 'Asia/Kolkata'), now()))::date,
            v_assignee,
            v_contact_id,
            v_company_id,
            d.id,
            'open'
        from public.deals d
        where d.company_id = v_company_id
          and d.archived_at is null
          and v_contact_id = any (d.contact_ids)
        order by d.id
        limit 1
        on conflict (sales_id, contact_id, assignment_date) do nothing;

        if v_phone is not null then v_seen_phones := v_seen_phones || v_phone; end if;
        if v_email is not null then v_seen_emails := v_seen_emails || v_email; end if;
        v_created := v_created + 1;
        v_results := v_results || jsonb_build_object('row', v_row->'row', 'status', 'created', 'contact_id', v_contact_id);
    end loop;

    update public.import_batches set
        created_count = v_created,
        duplicate_count = v_duplicates,
        invalid_count = v_invalid
    where id = v_batch_id;

    return jsonb_build_object(
        'batch_id', v_batch_id,
        'created', v_created,
        'duplicates', v_duplicates,
        'invalid', v_invalid,
        'rows', v_results
    );
end;
$_$;

CREATE OR REPLACE FUNCTION "public"."save_company_with_contacts"("p_company_id" bigint, "p_company" "jsonb", "p_contacts" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
    v_company_id bigint := p_company_id;
    v_is_new boolean := p_company_id is null;
    v_contacts jsonb := coalesce(p_contacts, '[]'::jsonb);
    v_contact jsonb;
    v_contact_id bigint;
    v_kept_ids bigint[] := '{}';
    v_email text;
    v_mobile text;
begin
    if jsonb_typeof(v_contacts) <> 'array' then
        raise exception 'p_contacts must be an array' using errcode = '22023';
    end if;

    if nullif(trim(p_company->>'name'), '') is null then
        raise exception 'Company name is required' using errcode = '23502';
    end if;

    if (select count(*) from jsonb_array_elements(v_contacts) c
        where coalesce((c->>'is_primary')::boolean, false)) > 1 then
        raise exception 'A company can only have one primary contact' using errcode = '23505';
    end if;

    if (select count(c->>'id') <> count(distinct c->>'id')
        from jsonb_array_elements(v_contacts) c) then
        raise exception 'The same contact is listed twice' using errcode = '23505';
    end if;

    if v_company_id is null then
        insert into public.companies (
            name, sector, city, lead_date, pitch_point, business_description, sales_id,
            website, phone_number, email, whatsapp_number, priority, address, context_links
        )
        values (
            trim(p_company->>'name'),
            nullif(p_company->>'sector', ''),
            nullif(p_company->>'city', ''),
            coalesce(nullif(p_company->>'lead_date', '')::date, current_date),
            nullif(p_company->>'pitch_point', ''),
            nullif(p_company->>'business_description', ''),
            (p_company->>'sales_id')::bigint,
            nullif(trim(p_company->>'website'), ''),
            nullif(trim(p_company->>'phone_number'), ''),
            nullif(trim(p_company->>'email'), ''),
            nullif(trim(p_company->>'whatsapp_number'), ''),
            coalesce(nullif(p_company->>'priority', ''), 'medium'),
            nullif(trim(p_company->>'address'), ''),
            case
                when jsonb_typeof(p_company->'context_links') = 'array'
                    and jsonb_array_length(p_company->'context_links') > 0
                then (p_company->'context_links')::json
                else null
            end
        )
        returning id into v_company_id;
    else
        update public.companies c set
            name = trim(p_company->>'name'),
            sector = case when p_company ? 'sector' then nullif(p_company->>'sector', '') else c.sector end,
            city = case when p_company ? 'city' then nullif(p_company->>'city', '') else c.city end,
            lead_date = case when p_company ? 'lead_date' then nullif(p_company->>'lead_date', '')::date else c.lead_date end,
            pitch_point = case when p_company ? 'pitch_point' then nullif(p_company->>'pitch_point', '') else c.pitch_point end,
            business_description = case when p_company ? 'business_description' then nullif(p_company->>'business_description', '') else c.business_description end,
            website = case when p_company ? 'website' then nullif(trim(p_company->>'website'), '') else c.website end,
            phone_number = case when p_company ? 'phone_number' then nullif(trim(p_company->>'phone_number'), '') else c.phone_number end,
            email = case when p_company ? 'email' then nullif(trim(p_company->>'email'), '') else c.email end,
            whatsapp_number = case when p_company ? 'whatsapp_number' then nullif(trim(p_company->>'whatsapp_number'), '') else c.whatsapp_number end,
            priority = case when p_company ? 'priority' then coalesce(nullif(p_company->>'priority', ''), 'medium') else c.priority end,
            address = case when p_company ? 'address' then nullif(trim(p_company->>'address'), '') else c.address end,
            context_links = case
                when p_company ? 'context_links' then
                    case
                        when jsonb_typeof(p_company->'context_links') = 'array'
                            and jsonb_array_length(p_company->'context_links') > 0
                        then (p_company->'context_links')::json
                        else null
                    end
                else c.context_links
            end,
            sales_id = case when p_company ? 'sales_id' then (p_company->>'sales_id')::bigint else c.sales_id end
        where c.id = v_company_id;

        if not found then
            raise exception 'Company % not found', v_company_id using errcode = 'P0002';
        end if;
    end if;

    -- Clear the primary flag first so moving it between contacts never trips
    -- the one-primary-per-company index.
    update public.contacts set is_primary = false
    where company_id = v_company_id and is_primary;

    for v_contact in select * from jsonb_array_elements(v_contacts)
    loop
        if nullif(trim(v_contact->>'first_name'), '') is null
            and nullif(trim(v_contact->>'last_name'), '') is null then
            raise exception 'Every contact needs a name' using errcode = '23502';
        end if;

        v_email := nullif(lower(trim(v_contact->>'email')), '');
        v_mobile := nullif(trim(v_contact->>'mobile'), '');
        v_contact_id := (v_contact->>'id')::bigint;

        if v_contact_id is null then
            insert into public.contacts (
                first_name, last_name, title, company_id, whatsapp_number, is_primary,
                email_jsonb, phone_jsonb, first_seen, last_seen, tags
            )
            values (
                nullif(trim(v_contact->>'first_name'), ''),
                nullif(trim(v_contact->>'last_name'), ''),
                nullif(trim(v_contact->>'title'), ''),
                v_company_id,
                nullif(trim(v_contact->>'whatsapp_number'), ''),
                coalesce((v_contact->>'is_primary')::boolean, false),
                case when v_email is not null
                    then jsonb_build_array(jsonb_build_object('email', v_email, 'type', 'Work')) end,
                case when v_mobile is not null
                    then jsonb_build_array(jsonb_build_object('number', v_mobile, 'type', 'Work')) end,
                now(),
                now(),
                '{}'
            )
            returning id into v_contact_id;
        else
            update public.contacts co set
                first_name = nullif(trim(v_contact->>'first_name'), ''),
                last_name = nullif(trim(v_contact->>'last_name'), ''),
                title = nullif(trim(v_contact->>'title'), ''),
                company_id = v_company_id,
                whatsapp_number = nullif(trim(v_contact->>'whatsapp_number'), ''),
                is_primary = coalesce((v_contact->>'is_primary')::boolean, false),
                email_jsonb = nullif(
                    case when v_email is null
                        then coalesce(co.email_jsonb, '[]'::jsonb) - 0
                        else jsonb_set(coalesce(co.email_jsonb, '[]'::jsonb), '{0}',
                            jsonb_build_object('email', v_email,
                                'type', coalesce(co.email_jsonb->0->>'type', 'Work')))
                    end, '[]'::jsonb),
                phone_jsonb = nullif(
                    case when v_mobile is null
                        then coalesce(co.phone_jsonb, '[]'::jsonb) - 0
                        else jsonb_set(coalesce(co.phone_jsonb, '[]'::jsonb), '{0}',
                            jsonb_build_object('number', v_mobile,
                                'type', coalesce(co.phone_jsonb->0->>'type', 'Work')))
                    end, '[]'::jsonb)
            where co.id = v_contact_id;

            if not found then
                raise exception 'Contact % not found', v_contact_id using errcode = 'P0002';
            end if;
        end if;

        v_kept_ids := v_kept_ids || v_contact_id;
    end loop;

    -- Unlink, never delete, the contacts removed from the list.
    update public.contacts set company_id = null, is_primary = false
    where company_id = v_company_id and id <> all (v_kept_ids);

    -- A new company with at least one contact opens one cold deal.
    -- A later edit does not open another.
    if v_is_new and coalesce(array_length(v_kept_ids, 1), 0) > 0 then
        declare
            v_owner bigint := coalesce(
                nullif(p_company->>'sales_id', '')::bigint,
                public.current_sales_id()
            );
            v_dialer bigint;
        begin
            -- Leads always belong to a BDE. Admin only oversees.
            select s.id into v_dialer
            from public.sales s
            where not s.disabled
              and s.role = 'bde'
            order by
                case when s.id = v_owner then 0 else 1 end,
                s.id
            limit 1;

            v_dialer := coalesce(v_dialer, v_owner);

            update public.companies
            set sales_id = v_dialer
            where id = v_company_id;

            update public.contacts
            set
                lead_stage = coalesce(lead_stage, 'queued'),
                sales_id = v_dialer,
                assigned_to = v_dialer,
                assigned_at = coalesce(assigned_at, now())
            where id = any (v_kept_ids);

            perform public.open_cold_deal(
                v_company_id,
                v_kept_ids,
                v_dialer,
                trim(p_company->>'name')
            );
        end;
    end if;

    return v_company_id;
end;
$$;
