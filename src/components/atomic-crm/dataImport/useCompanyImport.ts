import { useCallback } from "react";
import { useDataProvider, useGetIdentity } from "ra-core";

import { mapSizeToCategory } from "../companies/sizes";
import { normalizeLeadDate, parseSocialMediaUrls } from "../leads/leadImport";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { createEachRow } from "./createEachRow";
import { toConfiguredValue, toNumber, toText } from "./parseCell";
import type { ImportCell, ImportRow, ProcessImportBatch } from "./types";

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

/**
 * Creates a company per CSV row. Unknown columns are ignored, missing ones are
 * left empty — except `name`, which the database requires.
 *
 * Accepts both the legacy sample headers (`name`, `city`, …) and the lead CSV
 * headers (`company`, `place`, `whatsApp_number`, …).
 */
export function useCompanyImport(): ProcessImportBatch {
  const { companySectors } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();

  return useCallback(
    (batch) =>
      createEachRow(
        batch.map((row) => {
          const name = cell(
            row,
            "name",
            "company",
            "company_name",
            "business_name",
          );
          // PostgREST 400s on a null `name`; refuse the row before the round-trip.
          if (!name) {
            return Promise.reject(new Error("missing company name"));
          }

          const leadDateRaw = cell(
            row,
            "lead_date",
            "calling_date",
            "collection_date",
            "date",
          );
          const leadDate = leadDateRaw
            ? normalizeLeadDate(leadDateRaw) || undefined
            : undefined;

          const socialRaw = cell(
            row,
            "social_media_urls",
            "social_media",
            "context_links",
          );
          const context_links = socialRaw
            ? parseSocialMediaUrls(socialRaw)
            : undefined;

          return dataProvider.create("companies", {
            data: {
              name,
              sector: toConfiguredValue(
                cell(row, "sector", "vertical", "industry") ?? null,
                companySectors,
              ),
              size: sizeOf(cell(row, "size")),
              linkedin_url: cell(row, "linkedin_url"),
              website: cell(row, "website", "company_website", "url", "web"),
              phone_number: cell(
                row,
                "phone_number",
                "phone",
                "mobile",
                "mobile_number",
              ),
              whatsapp_number: cell(row, "whatsapp_number", "whatsapp", "wa"),
              email: cell(row, "email", "gmail", "email_address", "mail"),
              address: cell(row, "address", "street", "street_address"),
              zipcode: cell(row, "zipcode", "zip"),
              city: cell(row, "city", "place", "location", "town"),
              state_abbr: cell(row, "state_abbr", "state"),
              country: cell(row, "country"),
              description: cell(row, "description"),
              business_description: cell(
                row,
                "business_description",
                "about",
                "about_business",
              ),
              revenue: cell(row, "revenue"),
              tax_identifier: cell(row, "tax_identifier"),
              lead_date: leadDate,
              pitch_point: cell(row, "pitch_point", "pitch"),
              priority: toConfiguredValue(
                cell(row, "priority") ?? null,
                PRIORITY_OPTIONS,
              ),
              context_links:
                context_links && context_links.length
                  ? context_links
                  : undefined,
              sales_id: identity?.id,
              created_at: new Date().toISOString(),
            },
          });
        }),
      ),
    [companySectors, dataProvider, identity?.id],
  );
}

/**
 * Reads a cell by any of the accepted header aliases. Headers are matched
 * case-insensitively with spaces / dashes folded to underscores, so
 * `whatsApp_number` and `Social Media URLs` both resolve.
 */
const cell = (row: ImportRow, ...aliases: string[]): string | undefined => {
  const normalized: Record<string, ImportCell> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = value;
  }
  for (const alias of aliases) {
    const text = toText(normalized[normalizeHeader(alias)]);
    if (text !== undefined) return text;
  }
  return undefined;
};

const normalizeHeader = (header: string) =>
  header
    .trim()
    .toLowerCase()
    .replace(/[\s\-.]+/g, "_");

/**
 * `size` is a bucket id, not a headcount, so an arbitrary CSV number is coerced
 * into the nearest bucket the company screens can render.
 */
const sizeOf = (value: string | undefined) => {
  if (value === undefined) return undefined;
  const size = toNumber(value);
  return size === undefined ? undefined : mapSizeToCategory(size);
};
