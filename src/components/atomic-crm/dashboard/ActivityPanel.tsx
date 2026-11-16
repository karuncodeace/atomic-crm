import { useTranslate } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DashboardCard, DashboardCardTitle } from "./DashboardCard";
import type { DashboardStats, DayStats } from "./dashboardStats";
import { percent } from "./useDashboardStats";

const CHART_HEIGHT = 140;

const dayLabel = (day: string, short = false) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", {
    ...(short ? {} : { weekday: "short" }),
    day: "numeric",
    month: "short",
  });

/**
 * Calls per day over the last 14 days: a light bar for calls made and a dark
 * bar for the ones that connected, with the 14-day totals on top and today's
 * outcomes underneath.
 */
export const ActivityPanel = ({
  stats,
}: {
  stats: DashboardStats | undefined;
}) => {
  const translate = useTranslate();

  if (!stats) {
    return (
      <DashboardCard className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-[180px] w-full" />
      </DashboardCard>
    );
  }

  const days = stats.days ?? [];
  const totals = days.reduce(
    (acc, day) => ({
      calls: acc.calls + day.calls,
      connected: acc.connected + day.connected,
      interested: acc.interested + day.interested,
    }),
    { calls: 0, connected: 0, interested: 0 },
  );
  const tallest = Math.max(...days.map((day) => day.calls), 1);

  const outcomes = [
    {
      key: "interested",
      label: translate("resources.call_assignments.outcome.interested"),
      value: stats.outcomes_today.interested,
      color: "bg-success",
    },
    {
      key: "callback",
      label: translate("resources.call_assignments.outcome.callback"),
      value: stats.outcomes_today.callback,
      color: "bg-brand",
    },
    {
      key: "no_answer",
      label: translate("resources.call_assignments.outcome.no_answer"),
      value: stats.outcomes_today.no_answer,
      color: "bg-warning",
    },
    {
      key: "not_interested",
      label: translate("resources.call_assignments.outcome.not_interested"),
      value: stats.outcomes_today.not_interested,
      color: "bg-destructive/70",
    },
  ];

  return (
    <DashboardCard className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <DashboardCardTitle>
            {translate("crm.dashboard.home.activity", {
              _: "Call activity",
            })}
          </DashboardCardTitle>
          <p className="text-xs text-muted-foreground">
            {translate("crm.dashboard.home.activity_hint", {
              _: "Last 14 days",
            })}
          </p>
        </div>
        <dl className="flex gap-6 text-right">
          <Total
            label={translate("crm.dashboard.home.calls", { _: "Calls" })}
            value={totals.calls.toLocaleString()}
          />
          <Total
            label={translate("crm.dashboard.home.connected", {
              _: "Connected",
            })}
            value={`${totals.connected.toLocaleString()}`}
            hint={`${percent(totals.connected, totals.calls)}%`}
          />
          <Total
            label={translate("crm.dashboard.home.interested", {
              _: "Interested",
            })}
            value={totals.interested.toLocaleString()}
          />
        </dl>
      </div>

      {totals.calls === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {translate("crm.dashboard.home.no_activity", {
            _: "No calls in the last 14 days yet.",
          })}
        </p>
      ) : (
        <div>
          <div
            className="flex items-end gap-1.5"
            style={{ height: CHART_HEIGHT }}
            role="img"
            aria-label={translate("crm.dashboard.home.activity_aria", {
              _: "Calls and connected calls per day, last 14 days",
            })}
          >
            {days.map((day) => (
              <DayBar key={day.day} day={day} tallest={tallest} />
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5 text-[10px] text-muted-foreground">
            {days.map((day, index) => (
              <span key={day.day} className="flex-1 truncate text-center">
                {index % 2 === days.length % 2 || index === days.length - 1
                  ? dayLabel(day.day, true)
                  : ""}
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[3px] bg-brand-soft ring-1 ring-brand/60 ring-inset" />
              {translate("crm.dashboard.home.calls", { _: "Calls" })}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[3px] bg-foreground" />
              {translate("crm.dashboard.home.connected", { _: "Connected" })}
            </span>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {translate("crm.dashboard.home.outcomes_today", {
            _: "Today's outcomes",
          })}
        </p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
          {outcomes.map(({ key, label, value, color }) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              <span
                className={cn("size-2 shrink-0 rounded-[3px]", color)}
                aria-hidden
              />
              <span className="truncate text-muted-foreground">{label}</span>
              <span className="ml-auto font-semibold text-foreground tabular-nums">
                {value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardCard>
  );
};

const Total = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div>
    <dt className="text-[11px] text-muted-foreground">{label}</dt>
    <dd className="text-lg font-semibold tracking-tight text-foreground tabular-nums">
      {value}
      {hint ? (
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </dd>
  </div>
);

/** One day: calls bar with the connected share filled dark inside it. */
const DayBar = ({ day, tallest }: { day: DayStats; tallest: number }) => {
  const callsHeight = (day.calls / tallest) * 100;
  const connectedHeight = day.calls > 0 ? (day.connected / day.calls) * 100 : 0;
  return (
    <div
      className="group relative flex h-full flex-1 items-end"
      title={`${dayLabel(day.day)}: ${day.calls} calls, ${day.connected} connected, ${day.interested} interested`}
    >
      <div
        className="flex w-full items-end overflow-hidden rounded-t-[5px] bg-brand-soft ring-1 ring-brand/60 ring-inset transition-colors group-hover:bg-brand/40"
        style={{ height: `${Math.max(callsHeight, day.calls > 0 ? 3 : 0)}%` }}
      >
        <div
          className="w-full bg-foreground"
          style={{ height: `${connectedHeight}%` }}
        />
      </div>
    </div>
  );
};
