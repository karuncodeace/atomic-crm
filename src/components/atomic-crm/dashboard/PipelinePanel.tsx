import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { findDealLabel } from "../deals/dealUtils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { DashboardCard, DashboardCardTitle } from "./DashboardCard";
import type { DashboardStats } from "./dashboardStats";
import { leadsLink } from "./dashboardLinks";
import { percent } from "./useDashboardStats";

/** The lead journey, left to right, with one colour per stage. */
const PIPELINE_STAGES: { stage: string; fallback: string; color: string }[] = [
  { stage: "new", fallback: "New", color: "bg-chart-2" },
  { stage: "callback", fallback: "Callback", color: "bg-brand" },
  { stage: "not_answered", fallback: "Not connected", color: "bg-warning" },
  { stage: "interested", fallback: "Interested", color: "bg-success" },
  {
    stage: "not_interested",
    fallback: "Not interested",
    color: "bg-destructive/70",
  },
];

/**
 * Where every open lead stands: one bar split by stage (New → Callback →
 * Not connected → Interested → Not interested), and a clickable count per
 * stage. All open leads are shown, so the parts always add up to the total.
 */
export const PipelinePanel = ({
  stats,
}: {
  stats: DashboardStats | undefined;
}) => {
  const translate = useTranslate();
  const { dealStages } = useConfigurationContext();

  if (!stats) {
    return (
      <DashboardCard className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {PIPELINE_STAGES.map(({ stage }) => (
            <Skeleton key={stage} className="h-16" />
          ))}
        </div>
      </DashboardCard>
    );
  }

  const total = stats.leads_total;
  const known = new Set(PIPELINE_STAGES.map(({ stage }) => stage));
  const other = Object.entries(stats.stages)
    .filter(([stage]) => !known.has(stage))
    .reduce((sum, [, count]) => sum + count, 0);
  const segments = [
    ...PIPELINE_STAGES.map(({ stage, fallback, color }) => ({
      stage,
      label: findDealLabel(dealStages, stage) ?? fallback,
      color,
      count: stats.stages[stage] ?? 0,
    })),
    ...(other > 0
      ? [
          {
            stage: "other",
            label: translate("crm.dashboard.home.stage_other", {
              _: "Other",
            }),
            color: "bg-muted-foreground/40",
            count: other,
          },
        ]
      : []),
  ];
  const contacted = total - (stats.stages.new ?? 0);

  return (
    <DashboardCard className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <DashboardCardTitle>
            {translate("crm.dashboard.home.pipeline", { _: "Lead pipeline" })}
          </DashboardCardTitle>
          <p className="text-xs text-muted-foreground">
            {translate("crm.dashboard.home.pipeline_hint", {
              _: "Where every open lead stands right now",
            })}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {total.toLocaleString()}
          </span>{" "}
          {translate("crm.dashboard.home.open_leads", { _: "open leads" })}
          {" · "}
          <span className="font-medium text-foreground tabular-nums">
            {percent(contacted, total)}%
          </span>{" "}
          {translate("crm.dashboard.home.contacted", { _: "contacted" })}
        </p>
      </div>

      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-secondary"
        role="img"
        aria-label={segments
          .map(({ label, count }) => `${label}: ${count}`)
          .join(", ")}
      >
        {segments.map(({ stage, color, count }) =>
          count > 0 ? (
            <div
              key={stage}
              className={cn("h-full", color)}
              style={{ width: `${(count / Math.max(total, 1)) * 100}%` }}
            />
          ) : null,
        )}
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {segments.map(({ stage, label, color, count }) => {
          const body = (
            <>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={cn("size-2 shrink-0 rounded-[3px]", color)}
                  aria-hidden
                />
                <span className="truncate">{label}</span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
                  {count.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {percent(count, total)}%
                </span>
              </span>
            </>
          );
          const className =
            "flex flex-col gap-1 rounded-lg border border-border px-3 py-2.5 no-underline transition-colors";
          return (
            <li key={stage}>
              {stage === "other" ? (
                <div className={className}>{body}</div>
              ) : (
                <Link
                  to={leadsLink({ stage: [stage] })}
                  className={cn(className, "hover:border-brand")}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
};
