

-- Answered calls stamp the connected date on the contact and its lead
create or replace trigger set_last_connected_at
    after insert on public.call_logs
    for each row execute function public.set_last_connected_at();
