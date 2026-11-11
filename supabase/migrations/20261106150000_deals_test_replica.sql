-- Replicates the public.deals table as public.deals_test and fills it with test data.
--
-- The column set is derived from public.deals via LIKE INCLUDING ALL, so this
-- replica stays in sync with the declarative schema (defaults, identity, indexes)
-- without duplicating the DDL here. Foreign keys are intentionally not copied:
-- LIKE never duplicates them, which lets the test rows reference real
-- company/sales ids only when those tables actually have data.

create table public.deals_test (like public.deals including all);

-- Reset the identity so test rows start at 1, independent of the real table.
alter table public.deals_test alter column id restart with 1;

-- Test rows spanning every default pipeline stage
-- (defaultDealStages in src/components/atomic-crm/root/defaultConfiguration.ts).
-- company_id / sales_id resolve to real ids when present, null otherwise.
insert into public.deals_test
    (name, company_id, contact_ids, categories, stage, description, amount,
     created_at, updated_at, expected_closing_date, sales_id, "index")
values
    ('New website',
     (select min(id) from public.companies),
     null,
     array['website-design', 'ui-design'],
     'new',
     'Redesign of the public website',
     12000,
     now(), now(),
     date '2026-09-30',
     (select min(id) from public.sales),
     1),
    ('Print campaign',
     (select min(id) from public.companies),
     null,
     array['print-project'],
     'callback',
     'Flyers and posters for the autumn sale',
     4500,
     now(), now(),
     date '2026-10-15',
     (select min(id) from public.sales),
     2),
    ('Copywriting retainer',
     (select min(id) from public.companies),
     null,
     array['copywriting'],
     'interested',
     'Monthly blog and newsletter content',
     8000,
     now(), now(),
     date '2026-11-30',
     (select min(id) from public.sales),
     3),
    ('Mobile app UI',
     (select min(id) from public.companies),
     null,
     array['ui-design'],
     'not_interested',
     'Prospect declined the initial quote',
     15000,
     now(), now(),
     null,
     (select min(id) from public.sales),
     4),
    ('Cold outreach follow-up',
     (select min(id) from public.companies),
     null,
     array['other'],
     'not_answered',
     'No answer after two call attempts',
     2500,
     now(), now(),
     date '2026-12-15',
     (select min(id) from public.sales),
     5);
