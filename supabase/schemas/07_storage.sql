--
-- Storage
-- This file declares storage bucket policies.
--

-- Active CRM users only; a file can only be deleted by its uploader or a manager.
create policy "Attachments 1mt4rzk_0" on storage.objects for select to authenticated using (bucket_id = 'attachments' and public.crm_role() is not null);
create policy "Attachments 1mt4rzk_1" on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and public.crm_role() is not null);
create policy "Attachments 1mt4rzk_3" on storage.objects for delete to authenticated using (bucket_id = 'attachments' and (owner_id = auth.uid()::text or public.is_manager()));

-- Call recordings: read-only for users, and only for a recording row they can
-- already see (call_recordings RLS applies inside the subquery). Files are
-- written by the salestrail_sync edge function with the service role.
create policy "Call recordings read" on storage.objects for select to authenticated using (bucket_id = 'call-recordings' and exists (select 1 from public.call_recordings r where r.storage_path = storage.objects.name));
