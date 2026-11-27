-- SalesTrail calls also match a lead through the contact's WhatsApp number
-- and the company's phone / WhatsApp numbers (leads often only have the
-- company's number). A company match needs no contact, so contact_id is
-- optional. The sync cursor goes back 2 days so already-pulled calls are
-- matched again (stored ones are skipped by their unique call id).

alter table public.call_recordings alter column contact_id drop not null;

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

update public.salestrail_sync_state set synced_until = now() - interval '2 days';
