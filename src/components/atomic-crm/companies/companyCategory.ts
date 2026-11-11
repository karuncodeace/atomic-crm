import type { CompanyCategory } from "../types";

export const DEFAULT_COMPANY_CATEGORY: CompanyCategory = "not_categorized";

export const companyCategories: { value: CompanyCategory; label: string }[] = [
  { value: "not_categorized", label: "Not Categorized" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "branding", label: "Branding" },
];

/** Badge colors per category, shared by the leads table and its dropdown. */
export const COMPANY_CATEGORY_BADGE_CLASSES: Record<CompanyCategory, string> = {
  not_categorized:
    "border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300",
  ecommerce:
    "border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300",
  branding:
    "border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300",
};

/**
 * Maps a free-text cell ("E-commerce", "ecommerce", "Branding", …) onto a
 * category. Anything unrecognized, or empty, is "not_categorized". Mirrors
 * the normalization in import_leads().
 */
export const normalizeCompanyCategory = (
  value: string | null | undefined,
): CompanyCategory => {
  const key = (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (key === "ecommerce") return "ecommerce";
  if (key === "branding") return "branding";
  return DEFAULT_COMPANY_CATEGORY;
};

export const getCompanyCategoryLabel = (
  value: string | null | undefined,
): string =>
  companyCategories.find(
    (category) => category.value === normalizeCompanyCategory(value),
  )?.label ?? "Not Categorized";
