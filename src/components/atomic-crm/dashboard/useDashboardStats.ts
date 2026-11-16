import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "../providers/types";
import type { DashboardStats } from "./dashboardStats";

const REFRESH_EVERY_MS = 60_000;

/** All dashboard numbers in one request, refreshed every minute. */
export const useDashboardStats = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  return useQuery<DashboardStats>({
    queryKey: ["dashboardStats"],
    queryFn: () => dataProvider.getDashboardStats(),
    refetchInterval: REFRESH_EVERY_MS,
  });
};

/** Share of `part` in `total` as a whole percentage (0 when total is 0). */
export const percent = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 100) : 0;
