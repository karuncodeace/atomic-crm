import type { DataProvider, GetListParams } from "ra-core";

import { defaultDealCategories } from "../../root/defaultConfiguration";
import type { LabeledValue } from "../../types";

const CATEGORIES_CACHE_TTL_MS = 60_000;
const categoriesCache = new WeakMap<
  DataProvider,
  { expiresAt: number; categories: Promise<LabeledValue[]> }
>();

/**
 * Deal categories rarely change, so they are cached for a minute (per data
 * provider) instead of costing an extra round-trip before every search
 * keystroke.
 */
const getDealCategories = (
  dataProvider: DataProvider,
): Promise<LabeledValue[]> => {
  const cached = categoriesCache.get(dataProvider);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.categories;
  }
  const categories = dataProvider
    .getOne("configuration", { id: 1 })
    .then(
      ({ data }) =>
        (data?.config?.dealCategories as LabeledValue[] | undefined) ??
        defaultDealCategories,
    )
    .catch((error: unknown) => {
      categoriesCache.delete(dataProvider);
      throw error;
    });
  categoriesCache.set(dataProvider, {
    expiresAt: Date.now() + CATEGORIES_CACHE_TTL_MS,
    categories,
  });
  return categories;
};

/**
 * ilike can't search inside the categories array, so the search words are
 * matched against the configured category labels and values instead, and the
 * matching categories are added to the full-text search as an overlap filter.
 */
export const searchDealCategories = async (
  params: GetListParams,
  q: string | undefined,
  dataProvider: DataProvider,
): Promise<GetListParams> => {
  if (!q) return params;
  const categories = await getDealCategories(dataProvider);
  const words = q.toLowerCase().trim().split(/\s+/);
  const matches = categories.filter(({ value, label }) =>
    words.some(
      (word) =>
        value.toLowerCase().includes(word) ||
        label.toLowerCase().includes(word),
    ),
  );
  if (matches.length === 0) return params;
  return {
    ...params,
    filter: {
      ...params.filter,
      "@or": {
        ...params.filter["@or"],
        "categories@ov": `{${matches.map(({ value }) => `"${value}"`).join(",")}}`,
      },
    },
  };
};
