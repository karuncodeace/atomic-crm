

-- Answered calls stamp the connected date on the contact and its lead
create or replace trigger set_last_connected_at
    after insert on public.call_logs
    for each row execute function public.set_last_connected_at();

-- "Last updated" date of a lead, shown on the Kanban cards and the leads table
create or replace trigger set_deal_updated_at
    before update on public.deals
    for each row execute function public.set_deal_updated_at();
