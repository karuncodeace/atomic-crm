/** Leads list filtered on some fields (react-admin reads `filter` from the URL). */
export const leadsLink = (filter: Record<string, unknown>): string =>
  `/deals?filter=${encodeURIComponent(JSON.stringify(filter))}`;
