-- A lead can hold several meeting (recording) links, each with an optional
-- title: meeting_link (one text value) becomes meeting_links (jsonb array).
-- Existing links are kept.

alter table public.deals
    add column if not exists meeting_links jsonb not null default '[]'::jsonb;

alter table public.deals
    add constraint deals_meeting_links_is_array check (jsonb_typeof(meeting_links) = 'array');

update public.deals
set meeting_links = jsonb_build_array(jsonb_build_object('url', meeting_link, 'title', null))
where meeting_link is not null and meeting_link <> '';

alter table public.deals drop column if exists meeting_link;
