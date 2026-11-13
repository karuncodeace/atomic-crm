

-- Keep the call engine's lead_stage equal to the visible stage
create or replace trigger sync_contact_status_to_call_queue
    after update of status on public.contacts
    for each row execute function public.sync_contact_status_to_call_queue();
