-- Faster list search: companies_summary / contacts_summary no longer GROUP BY.
-- Under RLS the GROUP BY forced every search to aggregate the whole table
-- before filtering (~0.9 s on 20k companies); per-row count subqueries let
-- filters, sort and pagination run first (~25 ms). Same columns, same order.

create or replace view public.companies_summary with (security_invoker = on) as
select
    c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    (select count(*) from public.deals d where d.company_id = c.id) as nb_deals,
    (select count(*) from public.contacts co where co.company_id = c.id) as nb_contacts,
    c.lead_date,
    c.email,
    c.whatsapp_number,
    c.pitch_point,
    c.business_description,
    c.priority,
    c.decision_makers,
    c.category
from public.companies c;

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
    c.sector as company_sector
from public.contacts co
    left join public.companies c on co.company_id = c.id;

create index if not exists tasks_contact_id_idx on public.tasks using btree (contact_id);
