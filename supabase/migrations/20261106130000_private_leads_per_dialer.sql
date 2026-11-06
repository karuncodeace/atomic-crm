-- Leads become private per dialer. Admin sees every row; a BDE / manager only
-- sees contacts assigned to them, the deals / companies they own, and the
-- notes, tasks and call queue rows hanging off those. Unassigned pool leads are
-- admin-only. Dashboard widgets read these tables (and security-invoker views),
-- so their stats follow automatically.

drop policy if exists "Enable read access for authenticated users" on public.companies;
create policy "Enable read access for authenticated users" on public.companies for select to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.company_id = companies.id and c.assigned_to = (select public.current_sales_id())));

drop policy if exists "Enable update for authenticated users only" on public.companies;
create policy "Enable update for authenticated users only" on public.companies for update to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.company_id = companies.id and c.assigned_to = (select public.current_sales_id()))) with check (public.crm_role() is not null);

drop policy if exists "Company Delete Policy" on public.companies;
create policy "Company Delete Policy" on public.companies for delete to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.company_id = companies.id and c.assigned_to = (select public.current_sales_id())));

drop policy if exists "Enable read access for authenticated users" on public.contacts;
create policy "Enable read access for authenticated users" on public.contacts for select to authenticated using ((select public.crm_role()) = 'admin' or assigned_to = (select public.current_sales_id()) or (assigned_to is null and sales_id = (select public.current_sales_id())));

drop policy if exists "Enable update for authenticated users only" on public.contacts;
create policy "Enable update for authenticated users only" on public.contacts for update to authenticated using ((select public.crm_role()) = 'admin' or assigned_to = (select public.current_sales_id()) or (assigned_to is null and sales_id = (select public.current_sales_id()))) with check (public.crm_role() is not null);

drop policy if exists "Contact Delete Policy" on public.contacts;
create policy "Contact Delete Policy" on public.contacts for delete to authenticated using ((select public.crm_role()) = 'admin' or assigned_to = (select public.current_sales_id()) or (assigned_to is null and sales_id = (select public.current_sales_id())));

drop policy if exists "Enable read access for authenticated users" on public.contact_notes;
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.contacts c where c.id = contact_notes.contact_id));

drop policy if exists "Contact Notes Update policy" on public.contact_notes;
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.contacts c where c.id = contact_notes.contact_id));

drop policy if exists "Contact Notes Delete Policy" on public.contact_notes;
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.contacts c where c.id = contact_notes.contact_id));

drop policy if exists "Enable read access for authenticated users" on public.deals;
create policy "Enable read access for authenticated users" on public.deals for select to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()));

drop policy if exists "Enable update for authenticated users only" on public.deals;
create policy "Enable update for authenticated users only" on public.deals for update to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id())) with check (public.crm_role() is not null);

drop policy if exists "Deals Delete Policy" on public.deals;
create policy "Deals Delete Policy" on public.deals for delete to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()));

drop policy if exists "Enable read access for authenticated users" on public.deal_notes;
create policy "Enable read access for authenticated users" on public.deal_notes for select to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.deals d where d.id = deal_notes.deal_id));

drop policy if exists "Deal Notes Update Policy" on public.deal_notes;
create policy "Deal Notes Update Policy" on public.deal_notes for update to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.deals d where d.id = deal_notes.deal_id));

drop policy if exists "Deal Notes Delete Policy" on public.deal_notes;
create policy "Deal Notes Delete Policy" on public.deal_notes for delete to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.deals d where d.id = deal_notes.deal_id));

drop policy if exists "Enable read access for authenticated users" on public.tasks;
create policy "Enable read access for authenticated users" on public.tasks for select to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.id = tasks.contact_id));

drop policy if exists "Task Update Policy" on public.tasks;
create policy "Task Update Policy" on public.tasks for update to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.id = tasks.contact_id));

drop policy if exists "Task Delete Policy" on public.tasks;
create policy "Task Delete Policy" on public.tasks for delete to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.id = tasks.contact_id));

drop policy if exists "Enable read for own or managers" on public.call_assignments;
create policy "Enable read for own or managers" on public.call_assignments
    for select to authenticated
    using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()));

drop policy if exists "Enable read for own or managers" on public.call_logs;
create policy "Enable read for own or managers" on public.call_logs
    for select to authenticated
    using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()));

-- Pool leads must not stay visible to a former owner: the earlier repair put
-- never-dialed imported leads back in the pool but left their owner columns.
update public.contacts c
set sales_id = null
where c.assigned_to is null
  and c.sales_id in (select s.id from public.sales s where s.role in ('bde', 'manager'));

update public.deals d
set sales_id = null
where d.sales_id in (select s.id from public.sales s where s.role in ('bde', 'manager'))
  and coalesce(array_length(d.contact_ids, 1), 0) > 0
  and not exists (
      select 1 from public.contacts c
      where c.id = any (d.contact_ids) and c.assigned_to = d.sales_id
  );

update public.companies co
set sales_id = null
where co.sales_id in (select s.id from public.sales s where s.role in ('bde', 'manager'))
  and exists (select 1 from public.contacts c where c.company_id = co.id)
  and not exists (
      select 1 from public.contacts c
      where c.company_id = co.id and c.assigned_to = co.sales_id
  );
