-- Meeting link on each lead, and a real "Last updated" date: updated_at was
-- only ever set on insert. Kanban reorders (index-only writes) do not count.

alter table public.deals add column if not exists meeting_link text;

CREATE OR REPLACE FUNCTION "public"."set_deal_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
    -- Kanban reordering only shifts index: not a real change of the lead
    if (to_jsonb(new) - 'index' - 'updated_at') is distinct from (to_jsonb(old) - 'index' - 'updated_at') then
        new.updated_at = now();
    end if;
    return new;
end;
$$;

create or replace trigger set_deal_updated_at
    before update on public.deals
    for each row execute function public.set_deal_updated_at();
