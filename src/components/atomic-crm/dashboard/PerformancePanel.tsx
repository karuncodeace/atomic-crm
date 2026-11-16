import { useState } from "react";
import { useTranslate } from "ra-core";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Activity,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DashboardCard } from "./DashboardCard";
import type { DashboardStats, MonthStats } from "./dashboardStats";
import { LineChart } from "./LineChart";
import { percent } from "./useDashboardStats";

type Metric = "connect_rate" | "calls" | "connected" | "interested";

const METRICS: { id: Metric; fallback: string }[] = [
  { id: "connect_rate", fallback: "Connect rate" },
  { id: "calls", fallback: "Calls made" },
  { id: "connected", fallback: "Connected calls" },
  { id: "interested", fallback: "Interested leads" },
];

const valueOf = (month: MonthStats, metric: Metric): number =>
  metric === "connect_rate"
    ? percent(month.connected, month.calls)
    : month[metric];

const monthLabel = (month: string) =>
  new Date(`${month}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
  });

/** Monthly calling performance: connect rate headline + a 6-month line. */
export const PerformancePanel = ({
  stats,
}: {
  stats: DashboardStats | undefined;
}) => {
  const translate = useTranslate();
  const [metric, setMetric] = useState<Metric>("connect_rate");
  const metricLabel = (id: Metric) =>
    translate(`crm.dashboard.home.metric_${id}`, {
      _: METRICS.find((m) => m.id === id)?.fallback,
    });

  if (!stats) {
    return (
      <DashboardCard className="flex flex-col gap-4">
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-[220px] w-full" />
      </DashboardCard>
    );
  }

  const current = stats.months[stats.months.length - 1];
  const previous = stats.months[stats.months.length - 2];
  const rate = current ? percent(current.connected, current.calls) : 0;
  const previousRate = previous
    ? percent(previous.connected, previous.calls)
    : 0;
  const delta = rate - previousRate;
  const hasPrevious = !!previous && previous.calls > 0;
  const isRate = metric === "connect_rate";

  return (
    <DashboardCard className="flex min-w-0 flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-foreground">
            <Activity className="size-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[30px] leading-none font-semibold tracking-tight tabular-nums">
                {rate}%
              </span>
              {hasPrevious ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                    delta > 0
                      ? "bg-success/10 text-success"
                      : delta < 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {delta > 0 ? (
                    <ArrowUpRight className="size-3" aria-hidden />
                  ) : delta < 0 ? (
                    <ArrowDownRight className="size-3" aria-hidden />
                  ) : null}
                  {delta === 0
                    ? translate("crm.dashboard.home.same_as_last_month", {
                        _: "same as last month",
                      })
                    : `${Math.abs(delta)} pts`}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {translate("crm.dashboard.home.performance_caption", {
                _: "Connect rate this month · %{calls} calls, %{connected} connected",
                calls: current?.calls ?? 0,
                connected: current?.connected ?? 0,
              })}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label={translate("crm.dashboard.home.choose_metric", {
                  _: "Choose chart metric",
                })}
              />
            }
          >
            <SlidersHorizontal aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {METRICS.map((option) => (
              <DropdownMenuItem
                key={option.id}
                onClick={() => setMetric(option.id)}
                className="gap-2"
              >
                <Check
                  className={cn(
                    "size-4",
                    metric === option.id ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
                {metricLabel(option.id)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div>
        <p className="mb-3 text-xs font-medium text-foreground">
          {metricLabel(metric)}
          <span className="font-normal text-muted-foreground">
            {" · "}
            {translate("crm.dashboard.home.last_6_months", {
              _: "last 6 months",
            })}
          </span>
        </p>
        <LineChart
          ariaLabel={`${metricLabel(metric)}, ${translate("crm.dashboard.home.last_6_months", { _: "last 6 months" })}`}
          points={stats.months.map((month) => {
            const value = valueOf(month, metric);
            return {
              label: monthLabel(month.month),
              value,
              display: isRate
                ? `${value}% (${month.connected}/${month.calls})`
                : value.toLocaleString(),
            };
          })}
          maxValue={isRate ? 100 : undefined}
          formatAxis={(value) =>
            isRate ? `${value}%` : value.toLocaleString()
          }
        />
      </div>
    </DashboardCard>
  );
};
