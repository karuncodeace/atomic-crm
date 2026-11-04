-- import_leads() runs as the signed-in manager (SECURITY INVOKER). Without
-- insert/update policies on import_batches, the batch row is rejected by RLS
-- (42501) even though is_manager() already passed inside the function.

create policy "Enable insert for managers"
  on public.import_batches
  for insert
  to authenticated
  with check (public.is_manager());

create policy "Enable update for managers"
  on public.import_batches
  for update
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "Enable delete for managers"
  on public.import_batches
  for delete
  to authenticated
  using (public.is_manager());
