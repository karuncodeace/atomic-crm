/*
 * Website package (owner, 2026-11-10): when a lead becomes Interested, the CRM asks which kind of website the client
 * wants. The choice is stored in the deal's `categories` field (an existing column the CRM did not use) and sent to
 * AxiCore, which picks the brochure design for that package.
 */
import type { DataProvider, Identifier } from "ra-core";

import type { CompanyCategory } from "../types";
import { engineFetch } from "./axicore";

export const INTERESTED_STAGE = "interested";

/*
 * owner, 2026-11-13: only two packages, matching the company category.
 * "ecommerce-store" keeps the value AxiCore already knows; "branding" is new
 * to AxiCore. The package, the company category and the leads table Category
 * column are kept equal by the database (sync_company_category_* triggers).
 */
export const WEBSITE_PACKAGES = [
  {
    value: "ecommerce-store",
    label: "E-commerce",
    hint: "Online store with catalogue, cart and payments",
    category: "ecommerce",
  },
  {
    value: "branding",
    label: "Branding",
    hint: "Brand identity, logo and brand materials",
    category: "branding",
  },
] as const satisfies readonly {
  value: string;
  label: string;
  hint: string;
  category: CompanyCategory;
}[];

export type WebsitePackage = (typeof WEBSITE_PACKAGES)[number]["value"];

/** Packages offered before 2026-11-13: still stripped when a package is swapped in. */
const LEGACY_PACKAGES = [
  "business-website",
  "website-seo",
  "shopify-store",
  "landing-page",
];

export const isWebsitePackage = (value: unknown): value is WebsitePackage =>
  WEBSITE_PACKAGES.some((p) => p.value === value);

const isAnyPackage = (value: string): boolean =>
  isWebsitePackage(value) || LEGACY_PACKAGES.includes(value);

/** The package already chosen for a deal, if any. */
export const dealPackage = (
  categories: string[] | null | undefined,
): WebsitePackage | null => (categories ?? []).find(isWebsitePackage) ?? null;

export const packageLabel = (value: string | null | undefined): string =>
  WEBSITE_PACKAGES.find((p) => p.value === value)?.label ?? "";

/** The package matching a company category, or null for "not_categorized". */
export const packageForCategory = (
  category: string | null | undefined,
): WebsitePackage | null =>
  WEBSITE_PACKAGES.find((p) => p.category === category)?.value ?? null;

/** The deal's categories with the package swapped in (other categories are kept). */
export const withPackage = (
  categories: string[] | null | undefined,
  pkg: WebsitePackage,
): string[] => [...(categories ?? []).filter((c) => !isAnyPackage(c)), pkg];

/**
 * Tells AxiCore the package straight away (also covers users whose role may not update the deal row).
 * Never blocks the CRM: a failure is only logged.
 */
export async function sendPackageToAxiCore(params: {
  dealId?: Identifier | null;
  companyId?: Identifier | null;
  pkg: WebsitePackage;
}): Promise<void> {
  try {
    await engineFetch("/api/axicore/package", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deal_id: params.dealId ?? null,
        company_id: params.companyId ?? null,
        package: params.pkg,
      }),
    });
  } catch (error) {
    console.warn("AxiCore did not get the package", error);
  }
}

/** Saves the package on the deal (categories) and tells AxiCore. */
export async function savePackage(
  dataProvider: DataProvider,
  deal: {
    id: Identifier;
    company_id?: Identifier | null;
    categories?: string[] | null;
  },
  pkg: WebsitePackage,
): Promise<void> {
  await sendPackageToAxiCore({
    dealId: deal.id,
    companyId: deal.company_id,
    pkg,
  });
  try {
    await dataProvider.update("deals", {
      id: deal.id,
      data: { categories: withPackage(deal.categories, pkg) },
      previousData: deal,
    });
  } catch (error) {
    // e.g. a BDE who does not own the deal: AxiCore already has the package
    console.warn("Could not save the package on the deal", error);
  }
}
