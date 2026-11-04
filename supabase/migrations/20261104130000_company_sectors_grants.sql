-- company_sectors was never granted to authenticated in 06_grants.sql (only
-- revoked from anon). On a clean remote that leaves SELECT failing with
-- "permission denied", which the company form shows as
-- "Failed to load verticals from the database."

grant select, insert, references, trigger on table public.company_sectors to authenticated;
grant all on table public.company_sectors to service_role;
revoke all on table public.company_sectors from anon;

-- Keep the role-gated policies from the lead-calling foundation migration.
drop policy if exists "Enable read access for authenticated users" on public.company_sectors;
create policy "Enable read access for authenticated users"
  on public.company_sectors
  for select
  to authenticated
  using (public.crm_role() is not null);

drop policy if exists "Enable insert for authenticated users only" on public.company_sectors;
create policy "Enable insert for authenticated users only"
  on public.company_sectors
  for insert
  to authenticated
  with check (public.is_manager());
