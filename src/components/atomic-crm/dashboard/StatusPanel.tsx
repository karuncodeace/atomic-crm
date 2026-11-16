import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { findDealLabel } from "../deals/dealUtils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  DashboardCard,
  DashboardCardTitle,
  DashboardEmpty,
} from "./DashboardCard";
import type { DashboardStats } from "./dashboardStats";
import { leadsLink } from "./dashboardLinks";
import { percent } from "./useDashboardStats";

interface StatusBar {
  key: string;
  label: string;
  value: number;
  stages: string[];
  barClass: string;
}

/** Where worked leads stand: interested, still in follow-up, or lost. */
export const StatusPanel = ({
  stats,
}: {
  stats: DashboardStats | undefined;
}) => {
  const translate = useTranslate();
  const { dealStages } = useConfigurationContext();

  if (!stats) {
    return (
      <DashboardCard className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-[220px] w-full" />
      </DashboardCard>
    );
  }

  const count = (stage: string) => stats.stages[stage] ?? 0;
  const bars: StatusBar[] = [
    {
      key: "interested",
      label: findDealLabel(dealStages, "interested") ?? "Interested",
      value: count("interested"),
      stages: ["interested"],
      barClass: "bg-brand",
    },
    {
      key: "follow_up",
      label: translate("crm.dashboard.home.status_follow_up", {
        _: "Follow-up",
      }),
      value: count("callback") + count("not_answered"),
      stages: ["callback", "not_answered"],
      barClass: "bg-foreground",
    },
    {
      key: "not_interested",
      label: findDealLabel(dealStages, "not_interested") ?? "Not interested",
      value: count("not_interested"),
      stages: ["not_interested"],
      barClass: "bg-chart-3",
    },
  ];
  const worked = bars.reduce((total, bar) => total + bar.value, 0);
  const tallest = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <DashboardCard className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <DashboardCardTitle>
            {translate("crm.dashboard.home.status_title", { _: "Lead status" })}
          </DashboardCardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {translate("crm.dashboard.home.status_caption", {
              _: "%{worked} worked · %{fresh} still new",
              worked,
              fresh: count("new"),
            })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-right">
            <span className="block text-[22px] leading-none font-semibold tabular-nums">
              {stats.leads_total.toLocaleString()}
            </span>
            <span className="text-[11px] whitespace-nowrap text-muted-foreground">
              {translate("crm.dashboard.home.open_leads", { _: "open leads" })}
            </span>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={translate("crm.dashboard.home.more", {
                    _: "More options",
                  })}
                />
              }
            >
              <MoreHorizontal aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {bars.map((bar) => (
                <DropdownMenuItem
                  key={bar.key}
                  render={<Link to={leadsLink({ stage: bar.stages })} />}
                >
                  {translate("crm.dashboard.home.view_stage", {
                    _: "View %{stage} leads",
                    stage: bar.label,
                  })}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {worked === 0 ? (
        <DashboardEmpty>
          {translate("crm.dashboard.home.status_empty", {
            _: "No leads have been worked yet.",
          })}
        </DashboardEmpty>
      ) : (
        <div className="grid flex-1 grid-cols-3 items-end gap-3 pt-6">
          {bars.map((bar) => {
            const share = percent(bar.value, worked);
            return (
              <Link
                key={bar.key}
                to={leadsLink({ stage: bar.stages })}
                className="group flex flex-col items-center gap-2 no-underline"
                title={`${bar.label}: ${bar.value.toLocaleString()} (${share}%)`}
              >
                <div className="flex h-[180px] w-full items-end justify-center">
                  <div
                    className={cn(
                      "relative w-full max-w-16 rounded-xl transition-[height,filter] duration-700 group-hover:brightness-95",
                      bar.barClass,
                    )}
                    style={{
                      height: `${Math.max((bar.value / tallest) * 100, 4)}%`,
                    }}
                  >
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-foreground tabular-nums shadow-sm">
                      {share}%
                    </span>
                  </div>
                </div>
                <span className="text-center">
                  <span className="block text-sm font-semibold tabular-nums text-foreground">
                    {bar.value.toLocaleString()}
                  </span>
                  <span className="block text-[11px] leading-tight text-muted-foreground">
                    {bar.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
};
