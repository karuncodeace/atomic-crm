import { useState } from "react";
import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { findDealLabel } from "../deals/dealUtils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { DashboardCard, DashboardCardHeader } from "./DashboardCard";
import { DonutChart, type DonutSegment } from "./DonutChart";
import type { DashboardStats } from "./dashboardStats";
import { leadsLink } from "./dashboardLinks";
import { percent } from "./useDashboardStats";

/** The lead journey, in order, each with its stage colour token. */
const PIPELINE_STAGES: { stage: string; fallback: string; color: string }[] = [
  { stage: "new", fallback: "New", color: "var(--stage-new)" },
  { stage: "callback", fallback: "Callback", color: "var(--stage-callback)" },
  {
    stage: "not_answered",
    fallback: "Not connected",
    color: "var(--stage-not-answered)",
  },
  {
    stage: "interested",
    fallback: "Interested",
    color: "var(--stage-interested)",
  },
  {
    stage: "not_interested",
    fallback: "Not interested",
    color: "var(--stage-not-interested)",
  },
];

/**
 * Where every open lead stands: a donut split by stage (New → Callback →
 * Not connected → Interested → Not interested) and a legend with the count,
 * share and a link per stage. All open leads are shown, so the parts always
 * add up to the total.
 */
export const PipelinePanel = ({
  stats,
}: {
  stats: DashboardStats | undefined;
}) => {
  const translate = useTranslate();
  const { dealStages } = useConfigurationContext();
  const [active, setActive] = useState<string | null>(null);

  if (!stats) {
    return (
      <DashboardCard className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <Skeleton className="mx-auto size-[200px] rounded-full" />
        <div className="flex flex-col gap-3">
          {PIPELINE_STAGES.map(({ stage }) => (
            <Skeleton key={stage} className="h-9" />
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
  const segments: (DonutSegment & { linkable: boolean })[] = [
    ...PIPELINE_STAGES.map(({ stage, fallback, color }) => ({
      key: stage,
      label: findDealLabel(dealStages, stage) ?? fallback,
      value: stats.stages[stage] ?? 0,
      color,
      linkable: true,
    })),
    ...(other > 0
      ? [
          {
            key: "other",
            label: translate("crm.dashboard.home.stage_other", {
              _: "Other",
            }),
            value: other,
            color: "var(--muted-foreground)",
            linkable: false,
          },
        ]
      : []),
  ];
  const contacted = total - (stats.stages.new ?? 0);
  const interested = stats.stages.interested ?? 0;
  const lost = stats.stages.not_interested ?? 0;
  const followUp =
    (stats.stages.callback ?? 0) + (stats.stages.not_answered ?? 0);

  return (
    <DashboardCard className="flex flex-col gap-6">
      <DashboardCardHeader
        title={translate("crm.dashboard.home.pipeline", {
          _: "Lead pipeline",
        })}
        description={translate("crm.dashboard.home.pipeline_hint", {
          _: "Where every open lead stands right now",
        })}
      />

      <div className="grid items-center gap-8 md:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 2xl:grid-cols-[220px_minmax(0,1fr)_200px]">
        <DonutChart
          segments={segments}
          total={total}
          centerLabel={translate("crm.dashboard.home.open_leads", {
            _: "open leads",
          })}
          ariaLabel={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
          active={active}
          onActiveChange={setActive}
        />

        <ul className="flex flex-col gap-1">
          {segments.map(({ key, label, value, color, linkable }) => {
            const share = percent(value, total);
            const row = (
              <>
                <span
                  className="size-2.5 shrink-0 rounded-full shadow-[inset_0_-1px_1px_rgb(0_0_0/0.2)]"
                  style={{ background: color }}
                  aria-hidden
                />
                <span className="w-28 shrink-0 truncate text-sm text-foreground sm:w-32">
                  {label}
                </span>
                <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                    style={{
                      width: `${share}%`,
                      background: `linear-gradient(90deg, color-mix(in oklab, ${color} 75%, white), ${color})`,
                    }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right text-sm font-semibold text-foreground tabular-nums">
                  {value.toLocaleString()}
                </span>
                <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {share}%
                </span>
                {linkable ? (
                  <ArrowUpRight
                    className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                ) : (
                  <span className="size-3.5 shrink-0" />
                )}
              </>
            );
            const className = cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 no-underline transition-colors",
              active === key ? "bg-secondary" : "hover:bg-secondary/70",
            );
            const hover = {
              onMouseEnter: () => setActive(key),
              onMouseLeave: () => setActive(null),
              onFocus: () => setActive(key),
              onBlur: () => setActive(null),
            };
            return (
              <li key={key}>
                {linkable ? (
                  <Link
                    to={leadsLink({ stage: [key] })}
                    className={className}
                    {...hover}
                  >
                    {row}
                  </Link>
                ) : (
                  <div className={className} {...hover}>
                    {row}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <dl className="grid grid-cols-3 gap-3 md:col-span-2 2xl:col-span-1 2xl:grid-cols-1">
          <Insight
            label={translate("crm.dashboard.home.contacted_label", {
              _: "Contacted",
            })}
            value={`${percent(contacted, total)}%`}
            hint={translate("crm.dashboard.home.contacted_hint", {
              _: "%{count} of %{total} leads past New",
              count: contacted,
              total,
            })}
          />
          <Insight
            label={translate("crm.dashboard.home.win_rate", {
              _: "Win rate",
            })}
            value={`${percent(interested, interested + lost)}%`}
            hint={translate("crm.dashboard.home.win_rate_hint", {
              _: "Interested out of decided leads",
            })}
          />
          <Insight
            label={translate("crm.dashboard.home.in_follow_up", {
              _: "In follow-up",
            })}
            value={followUp.toLocaleString()}
            hint={translate("crm.dashboard.home.in_follow_up_hint", {
              _: "Callback + not connected",
            })}
          />
        </dl>
      </div>
    </DashboardCard>
  );
};

/** One conversion figure beside the donut. */
const Insight = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) => (
  <div className="rounded-xl bg-secondary/70 px-4 py-3">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 text-2xl leading-tight font-semibold tracking-tight text-foreground tabular-nums">
      {value}
    </dd>
    <dd className="mt-0.5 truncate text-[11px] text-muted-foreground">
      {hint}
    </dd>
  </div>
);
