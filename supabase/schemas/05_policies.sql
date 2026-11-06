--
-- Row Level Security
-- This file declares RLS policies for all tables.
--

-- Enable RLS on all tables
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.deals enable row level security;
alter table public.deal_notes enable row level security;
alter table public.sales enable row level security;
alter table public.tags enable row level security;
alter table public.tasks enable row level security;
alter table public.configuration enable row level security;
alter table public.favicons_excluded_domains enable row level security;
alter table public.company_sectors enable row level security;
alter table public.import_batches enable row level security;
alter table public.call_assignments enable row level security;
alter table public.call_logs enable row level security;
alter table public.brochures enable row level security;
alter table public.user_invitations enable row level security;

-- Admin sees and edits every row. A BDE / manager only sees their own leads
-- (contacts assigned to them, deals / companies they own) and what hangs off
-- them (notes, tasks, call queue). Unassigned pool leads are admin-only.
-- Disabled users have crm_role() = null → no rows.

-- Companies
create policy "Enable read access for authenticated users" on public.companies for select to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.company_id = companies.id and c.assigned_to = (select public.current_sales_id())));
create policy "Enable insert for authenticated users only" on public.companies for insert to authenticated with check (public.crm_role() is not null);
create policy "Enable update for authenticated users only" on public.companies for update to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.company_id = companies.id and c.assigned_to = (select public.current_sales_id()))) with check (public.crm_role() is not null);
create policy "Company Delete Policy" on public.companies for delete to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.company_id = companies.id and c.assigned_to = (select public.current_sales_id())));

-- Contacts (leads)
create policy "Enable read access for authenticated users" on public.contacts for select to authenticated using ((select public.crm_role()) = 'admin' or assigned_to = (select public.current_sales_id()) or (assigned_to is null and sales_id = (select public.current_sales_id())));
create policy "Enable insert for authenticated users only" on public.contacts for insert to authenticated with check (public.crm_role() is not null);
create policy "Enable update for authenticated users only" on public.contacts for update to authenticated using ((select public.crm_role()) = 'admin' or assigned_to = (select public.current_sales_id()) or (assigned_to is null and sales_id = (select public.current_sales_id()))) with check (public.crm_role() is not null);
create policy "Contact Delete Policy" on public.contacts for delete to authenticated using ((select public.crm_role()) = 'admin' or assigned_to = (select public.current_sales_id()) or (assigned_to is null and sales_id = (select public.current_sales_id())));

-- Contact Notes
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.contacts c where c.id = contact_notes.contact_id));
create policy "Enable insert for authenticated users only" on public.contact_notes for insert to authenticated with check (public.crm_role() is not null);
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.contacts c where c.id = contact_notes.contact_id));
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.contacts c where c.id = contact_notes.contact_id));

-- Deals (Leads board)
create policy "Enable read access for authenticated users" on public.deals for select to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()));
create policy "Enable insert for authenticated users only" on public.deals for insert to authenticated with check (public.crm_role() is not null);
create policy "Enable update for authenticated users only" on public.deals for update to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id())) with check (public.crm_role() is not null);
create policy "Deals Delete Policy" on public.deals for delete to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()));

-- Deal Notes
create policy "Enable read access for authenticated users" on public.deal_notes for select to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.deals d where d.id = deal_notes.deal_id));
create policy "Enable insert for authenticated users only" on public.deal_notes for insert to authenticated with check (public.crm_role() is not null);
create policy "Deal Notes Update Policy" on public.deal_notes for update to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.deals d where d.id = deal_notes.deal_id));
create policy "Deal Notes Delete Policy" on public.deal_notes for delete to authenticated using ((select public.crm_role()) = 'admin' or exists (select 1 from public.deals d where d.id = deal_notes.deal_id));

-- Sales (team directory)
create policy "Enable read access for authenticated users" on public.sales for select to authenticated using (public.crm_role() is not null or user_id = auth.uid());

-- Tags
create policy "Enable read access for authenticated users" on public.tags for select to authenticated using (public.crm_role() is not null);
create policy "Enable insert for authenticated users only" on public.tags for insert to authenticated with check (public.crm_role() is not null);
create policy "Enable update for authenticated users only" on public.tags for update to authenticated using (public.crm_role() is not null);
create policy "Enable delete for authenticated users only" on public.tags for delete to authenticated using (public.crm_role() is not null);

-- Tasks
create policy "Enable read access for authenticated users" on public.tasks for select to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.id = tasks.contact_id));
create policy "Enable insert for authenticated users only" on public.tasks for insert to authenticated with check (public.crm_role() is not null);
create policy "Task Update Policy" on public.tasks for update to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.id = tasks.contact_id));
create policy "Task Delete Policy" on public.tasks for delete to authenticated using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()) or exists (select 1 from public.contacts c where c.id = tasks.contact_id));

-- Import batches
create policy "Enable read for managers" on public.import_batches for select to authenticated using (public.crm_role() is not null);
create policy "Enable insert for managers" on public.import_batches for insert to authenticated with check (public.crm_role() is not null);
create policy "Enable update for managers" on public.import_batches for update to authenticated using (public.crm_role() is not null) with check (public.crm_role() is not null);
create policy "Enable delete for managers" on public.import_batches for delete to authenticated using (public.crm_role() is not null);

-- Daily dial queue (shared)
create policy "Enable read for own or managers" on public.call_assignments
    for select to authenticated
    using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()));
create policy "Enable read for own or managers" on public.call_logs
    for select to authenticated
    using ((select public.crm_role()) = 'admin' or sales_id = (select public.current_sales_id()));

-- Brochures
create policy "Enable read access for authenticated users" on public.brochures for select to authenticated using (public.crm_role() is not null);
create policy "Enable update for managers" on public.brochures for update to authenticated using (public.crm_role() is not null) with check (public.crm_role() is not null);

-- Company Sectors
create policy "Enable read access for authenticated users" on public.company_sectors for select to authenticated using (public.crm_role() is not null);
create policy "Enable insert for authenticated users only" on public.company_sectors for insert to authenticated with check (public.crm_role() is not null);

-- Configuration (still admin-only for writes)
create policy "Enable read for authenticated" on public.configuration for select to authenticated using (true);
create policy "Enable insert for admins" on public.configuration for insert to authenticated with check (public.is_admin());
create policy "Enable update for admins" on public.configuration for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Favicons excluded domains
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated using (true) with check (true);
