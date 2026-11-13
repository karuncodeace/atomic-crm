-- Interested popup: only two packages (E-commerce, Branding), kept in sync
-- with the company category (the leads table Category column), both ways.

-- The Interested popup package (stored in deals.categories) and the company
-- category are the same choice: ecommerce-store <-> ecommerce,
-- branding <-> branding. These two triggers keep them equal both ways; the
-- "is distinct from" guards stop them from looping.
CREATE OR REPLACE FUNCTION "public"."sync_deal_package_to_company"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_category text;
begin
    if new.archived_at is not null or new.company_id is null then
        return new;
    end if;
    if tg_op = 'UPDATE' and new.categories is not distinct from old.categories then
        return new;
    end if;

    v_category := case
        when 'ecommerce-store' = any (new.categories) then 'ecommerce'
        when 'branding' = any (new.categories) then 'branding'
    end;
    if v_category is null then
        return new;
    end if;

    update public.companies c
    set category = v_category
    where c.id = new.company_id
      and c.category is distinct from v_category;

    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."sync_company_category_to_deals"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_package text;
begin
    if new.category is not distinct from old.category then
        return new;
    end if;

    v_package := case new.category
        when 'ecommerce' then 'ecommerce-store'
        when 'branding' then 'branding'
    end;

    update public.deals d
    set categories = s.categories, updated_at = now()
    from (
        select d2.id,
            array(
                select c from unnest(coalesce(d2.categories, '{}'::text[])) as c
                where c not in ('ecommerce-store', 'branding', 'business-website',
                    'website-seo', 'shopify-store', 'landing-page')
            ) || case when v_package is null then '{}'::text[] else array[v_package] end as categories
        from public.deals d2
        where d2.company_id = new.id
          and d2.archived_at is null
    ) s
    where d.id = s.id
      and d.categories is distinct from s.categories;

    return new;
end;
$$;

-- Keep the deal package and the company category equal (see sync_* functions)
create or replace trigger sync_deal_package_to_company
    after insert or update of categories on public.deals
    for each row execute function public.sync_deal_package_to_company();

create or replace trigger sync_company_category_to_deals
    after update of category on public.companies
    for each row execute function public.sync_company_category_to_deals();

-- Catch-up, triggers paused so it runs as one plain pass:
-- 1. Uncategorized companies take the category of a package already chosen
--    on one of their open deals (Shopify store counts as e-commerce).
-- 2. Every categorized company's open deals then carry the matching package
--    (older package values are replaced).
alter table public.deals disable trigger sync_deal_package_to_company;
alter table public.companies disable trigger sync_company_category_to_deals;

update public.companies c
set category = picked.category
from (
    select distinct on (d.company_id) d.company_id,
        case
            when d.categories && array['ecommerce-store', 'shopify-store'] then 'ecommerce'
            else 'branding'
        end as category
    from public.deals d
    where d.archived_at is null
      and d.company_id is not null
      and d.categories && array['ecommerce-store', 'shopify-store', 'branding']
    order by d.company_id, d.updated_at desc
) picked
where c.id = picked.company_id
  and c.category = 'not_categorized';

update public.deals d
set categories = array(
        select x from unnest(coalesce(d.categories, '{}'::text[])) as x
        where x not in ('ecommerce-store', 'branding', 'business-website',
            'website-seo', 'shopify-store', 'landing-page')
    ) || array[case c.category when 'ecommerce' then 'ecommerce-store' else 'branding' end],
    updated_at = now()
from public.companies c
where c.id = d.company_id
  and d.archived_at is null
  and c.category in ('ecommerce', 'branding')
  and not (coalesce(d.categories, '{}'::text[]) @> array[case c.category when 'ecommerce' then 'ecommerce-store' else 'branding' end]
      and not coalesce(d.categories, '{}'::text[]) && array['business-website', 'website-seo', 'shopify-store', 'landing-page',
          case c.category when 'ecommerce' then 'branding' else 'ecommerce-store' end]);

alter table public.deals enable trigger sync_deal_package_to_company;
alter table public.companies enable trigger sync_company_category_to_deals;
