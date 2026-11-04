-- Shared CRM access: any active sales role sees all leads, deals, tasks, dial
-- queue, brochures, and import history. Menus are no longer role-gated in the UI.

CREATE OR REPLACE FUNCTION "public"."can_see_company"("p_company_id" bigint) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.crm_role() is not null;
$$;

-- Drop restrictive policies, then recreate open ones (names kept where possible).
drop policy if exists "Enable read access for authenticated users" on public.companies;
drop policy if exists "Enable update for authenticated users only" on public.companies;
drop policy if exists "Company Delete Policy" on public.companies;
create policy "Enable read access for authenticated users" on public.companies for select to authenticated using (public.crm_role() is not null);
create policy "Enable update for authenticated users only" on public.companies for update to authenticated using (public.crm_role() is not null) with check (public.crm_role() is not null);
create policy "Company Delete Policy" on public.companies for delete to authenticated using (public.crm_role() is not null);

drop policy if exists "Enable read access for authenticated users" on public.contacts;
drop policy if exists "Enable insert for authenticated users only" on public.contacts;
drop policy if exists "Enable update for authenticated users only" on public.contacts;
drop policy if exists "Contact Delete Policy" on public.contacts;
create policy "Enable read access for authenticated users" on public.contacts for select to authenticated using (public.crm_role() is not null);
create policy "Enable insert for authenticated users only" on public.contacts for insert to authenticated with check (public.crm_role() is not null);
create policy "Enable update for authenticated users only" on public.contacts for update to authenticated using (public.crm_role() is not null) with check (public.crm_role() is not null);
create policy "Contact Delete Policy" on public.contacts for delete to authenticated using (public.crm_role() is not null);

drop policy if exists "Enable read access for authenticated users" on public.contact_notes;
drop policy if exists "Enable insert for authenticated users only" on public.contact_notes;
drop policy if exists "Contact Notes Update policy" on public.contact_notes;
drop policy if exists "Contact Notes Delete Policy" on public.contact_notes;
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using (public.crm_role() is not null);
create policy "Enable insert for authenticated users only" on public.contact_notes for insert to authenticated with check (public.crm_role() is not null);
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using (public.crm_role() is not null);
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using (public.crm_role() is not null);

drop policy if exists "Enable read access for authenticated users" on public.deals;
drop policy if exists "Enable update for authenticated users only" on public.deals;
drop policy if exists "Deals Delete Policy" on public.deals;
create policy "Enable read access for authenticated users" on public.deals for select to authenticated using (public.crm_role() is not null);
create policy "Enable update for authenticated users only" on public.deals for update to authenticated using (public.crm_role() is not null) with check (public.crm_role() is not null);
create policy "Deals Delete Policy" on public.deals for delete to authenticated using (public.crm_role() is not null);

drop policy if exists "Enable read access for authenticated users" on public.deal_notes;
drop policy if exists "Enable insert for authenticated users only" on public.deal_notes;
drop policy if exists "Deal Notes Update Policy" on public.deal_notes;
drop policy if exists "Deal Notes Delete Policy" on public.deal_notes;
create policy "Enable read access for authenticated users" on public.deal_notes for select to authenticated using (public.crm_role() is not null);
create policy "Enable insert for authenticated users only" on public.deal_notes for insert to authenticated with check (public.crm_role() is not null);
create policy "Deal Notes Update Policy" on public.deal_notes for update to authenticated using (public.crm_role() is not null);
create policy "Deal Notes Delete Policy" on public.deal_notes for delete to authenticated using (public.crm_role() is not null);

drop policy if exists "Enable delete for authenticated users only" on public.tags;
create policy "Enable delete for authenticated users only" on public.tags for delete to authenticated using (public.crm_role() is not null);

drop policy if exists "Enable read access for authenticated users" on public.tasks;
drop policy if exists "Enable insert for authenticated users only" on public.tasks;
drop policy if exists "Task Update Policy" on public.tasks;
drop policy if exists "Task Delete Policy" on public.tasks;
create policy "Enable read access for authenticated users" on public.tasks for select to authenticated using (public.crm_role() is not null);
create policy "Enable insert for authenticated users only" on public.tasks for insert to authenticated with check (public.crm_role() is not null);
create policy "Task Update Policy" on public.tasks for update to authenticated using (public.crm_role() is not null);
create policy "Task Delete Policy" on public.tasks for delete to authenticated using (public.crm_role() is not null);

drop policy if exists "Enable read for managers" on public.import_batches;
drop policy if exists "Enable insert for managers" on public.import_batches;
drop policy if exists "Enable update for managers" on public.import_batches;
drop policy if exists "Enable delete for managers" on public.import_batches;
create policy "Enable read for managers" on public.import_batches for select to authenticated using (public.crm_role() is not null);
create policy "Enable insert for managers" on public.import_batches for insert to authenticated with check (public.crm_role() is not null);
create policy "Enable update for managers" on public.import_batches for update to authenticated using (public.crm_role() is not null) with check (public.crm_role() is not null);
create policy "Enable delete for managers" on public.import_batches for delete to authenticated using (public.crm_role() is not null);

drop policy if exists "Enable read for own or managers" on public.call_assignments;
drop policy if exists "Enable read for own or managers" on public.call_logs;
create policy "Enable read for own or managers" on public.call_assignments
    for select to authenticated
    using (public.crm_role() is not null);
create policy "Enable read for own or managers" on public.call_logs
    for select to authenticated
    using (public.crm_role() is not null);

drop policy if exists "Enable update for managers" on public.brochures;
create policy "Enable update for managers" on public.brochures for update to authenticated using (public.crm_role() is not null) with check (public.crm_role() is not null);

drop policy if exists "Enable insert for authenticated users only" on public.company_sectors;
create policy "Enable insert for authenticated users only" on public.company_sectors for insert to authenticated with check (public.crm_role() is not null);

-- RPCs: any active role may import / assign / complete calls.
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

    perform set_config('crm.skip_enrichment', 'on', true);

    select coalesce(array_agg(s.id order by case when s.role = 'bde' then 0 else 1 end, s.id), '{}'::bigint[])
      into v_dialers
    from public.sales s
    where not s.disabled
      and s.role in ('bde', 'manager');
    v_dialer_count := coalesce(array_length(v_dialers, 1), 0);

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

        select c.id into v_company_id from public.companies c
        where (v_domain is not null and lower(regexp_replace(c.website::text, '^(https?://)?(www\.)?([^/:]+).*$', '\3')) = v_domain)
           or lower(c.name) = lower(v_company_name)
        order by c.id
        limit 1;

        if v_dialer_count > 0 then
            v_assignee := v_dialers[1 + (v_created % v_dialer_count)];
        else
            v_assignee := public.current_sales_id();
        end if;

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
            coalesce(
                (select c.sales_id from public.companies c where c.id = v_company_id),
                v_assignee,
                public.current_sales_id()
            ),
            v_company_name
        );

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
