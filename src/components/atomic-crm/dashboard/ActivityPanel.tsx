import { useState, type CSSProperties } from "react";
import { useTranslate } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DashboardCard, DashboardCardHeader } from "./DashboardCard";
import type { DashboardStats, DayStats } from "./dashboardStats";
import { percent } from "./useDashboardStats";

const PLOT_HEIGHT = 200;
const TICKS = 4;

/** Axis top split into TICKS even, round steps (1 / 2 / 2.5 / 5 × 10ⁿ). */
const niceMax = (value: number): number => {
  const raw = Math.max(value, 1) / TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    ([1, 2, 2.5, 5, 10].find((s) => s * magnitude >= raw) ?? 10) * magnitude;
  return step * TICKS;
};

const asDate = (day: string) => new Date(`${day}T00:00:00`);
const longDay = (day: string) =>
  asDate(day).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

/** Bar colours: a cylinder-like gradient (lit left edge, shaded right edge). */
const barStyle = (color: string, heightPct: number): CSSProperties => ({
  height: `${heightPct}%`,
  background: `linear-gradient(90deg, color-mix(in oklab, ${color} 70%, white) 0%, ${color} 45%, color-mix(in oklab, ${color} 78%, black) 100%)`,
  boxShadow: `0 6px 12px -6px color-mix(in oklab, ${color} 70%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.45)`,
});

const SERIES = [
  { key: "calls", color: "var(--stage-callback)" },
  { key: "connected", color: "var(--stage-interested)" },
] as const;

/**
 * Calls per day over the last 14 days: side-by-side bars for calls made and
 * calls that connected, a value axis with round ticks, and a hover card with
 * the day's numbers. 14-day totals sit in the header; today's outcomes below.
 */
export const ActivityPanel = ({
  stats,
}: {
  stats: DashboardStats | undefined;
}) => {
  const translate = useTranslate();
  const [hovered, setHovered] = useState<string | null>(null);

  if (!stats) {
    return (
      <DashboardCard className="flex flex-col gap-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-[240px] w-full" />
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
  const axisTop = niceMax(Math.max(...days.map((day) => day.calls), 1));
  const ticks = Array.from(
    { length: TICKS + 1 },
    (_, i) => (axisTop / TICKS) * (TICKS - i),
  );
  const seriesLabel = {
    calls: translate("crm.dashboard.home.calls", { _: "Calls" }),
    connected: translate("crm.dashboard.home.connected", {
      _: "Connected",
    }),
  };

  const outcomes = [
    {
      key: "interested",
      value: stats.outcomes_today.interested,
      color: "var(--stage-interested)",
    },
    {
      key: "callback",
      value: stats.outcomes_today.callback,
      color: "var(--stage-callback)",
    },
    {
      key: "no_answer",
      value: stats.outcomes_today.no_answer,
      color: "var(--stage-not-answered)",
    },
    {
      key: "not_interested",
      value: stats.outcomes_today.not_interested,
      color: "var(--stage-not-interested)",
    },
  ];

  return (
    <DashboardCard className="flex flex-col gap-6">
      <DashboardCardHeader
        title={translate("crm.dashboard.home.activity", {
          _: "Call activity",
        })}
        description={translate("crm.dashboard.home.activity_hint", {
          _: "Last 14 days",
        })}
        aside={
          <dl className="flex gap-6 text-right">
            <Total label={seriesLabel.calls} value={totals.calls} />
            <Total
              label={seriesLabel.connected}
              value={totals.connected}
              hint={`${percent(totals.connected, totals.calls)}%`}
            />
            <Total
              label={translate("crm.dashboard.home.interested", {
                _: "Interested",
              })}
              value={totals.interested}
            />
          </dl>
        }
      />

      {totals.calls === 0 ? (
        <p className="py-14 text-center text-sm text-muted-foreground">
          {translate("crm.dashboard.home.no_activity", {
            _: "No calls in the last 14 days yet.",
          })}
        </p>
      ) : (
        <div>
          <div className="flex gap-3">
            {/* value axis */}
            <div
              className="relative w-7 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums"
              style={{ height: PLOT_HEIGHT }}
            >
              {ticks.map((tick, i) => (
                <span
                  key={tick}
                  className="absolute right-0 -translate-y-1/2"
                  style={{ top: `${(i / TICKS) * 100}%` }}
                >
                  {tick}
                </span>
              ))}
            </div>

            {/* plot */}
            <div className="relative min-w-0 flex-1">
              <div
                className="pointer-events-none absolute inset-x-0 top-0"
                style={{ height: PLOT_HEIGHT }}
              >
                {ticks.map((tick, i) => (
                  <div
                    key={tick}
                    className={cn(
                      "absolute inset-x-0 border-t",
                      i === TICKS
                        ? "border-border"
                        : "border-dashed border-border/70",
                    )}
                    style={{ top: `${(i / TICKS) * 100}%` }}
                  />
                ))}
              </div>

              <div className="relative flex" style={{ height: PLOT_HEIGHT }}>
                {days.map((day, index) => (
                  <DayColumn
                    key={day.day}
                    day={day}
                    axisTop={axisTop}
                    isToday={index === days.length - 1}
                    isHovered={hovered === day.day}
                    onHover={setHovered}
                    labels={seriesLabel}
                    interestedLabel={translate(
                      "crm.dashboard.home.interested",
                      { _: "Interested" },
                    )}
                    alignRight={index > days.length / 2}
                    index={index}
                  />
                ))}
              </div>

              {/* day axis */}
              <div className="mt-2 flex">
                {days.map((day, index) => {
                  const date = asDate(day.day);
                  const isToday = index === days.length - 1;
                  return (
                    <div
                      key={day.day}
                      className={cn(
                        "flex flex-1 flex-col items-center text-[10px] leading-tight",
                        isToday
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      <span>
                        {date.toLocaleDateString("en-IN", {
                          weekday: "narrow",
                        })}
                      </span>
                      <span className="tabular-nums">{date.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-5 text-xs text-muted-foreground">
            {SERIES.map(({ key, color }) => (
              <span key={key} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-[3px]"
                  style={{ background: color }}
                />
                {seriesLabel[key]}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          {translate("crm.dashboard.home.outcomes_today", {
            _: "Today's outcomes",
          })}
        </p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {outcomes.map(({ key, value, color }) => (
            <li
              key={key}
              className="relative overflow-hidden rounded-lg bg-secondary/70 py-2 pr-3 pl-4"
            >
              <span
                className="absolute inset-y-0 left-0 w-1"
                style={{ background: color }}
                aria-hidden
              />
              <span className="block truncate text-[11px] text-muted-foreground">
                {translate(`resources.call_assignments.outcome.${key}`)}
              </span>
              <span className="text-lg leading-tight font-semibold text-foreground tabular-nums">
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
  value: number;
  hint?: string;
}) => (
  <div>
    <dt className="text-[11px] text-muted-foreground">{label}</dt>
    <dd className="text-xl leading-tight font-semibold tracking-tight text-foreground tabular-nums">
      {value.toLocaleString()}
      {hint ? (
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </dd>
  </div>
);

/** One day: calls and connected bars side by side, value on top, hover card. */
const DayColumn = ({
  day,
  axisTop,
  isToday,
  isHovered,
  onHover,
  labels,
  interestedLabel,
  alignRight,
  index,
}: {
  day: DayStats;
  axisTop: number;
  isToday: boolean;
  isHovered: boolean;
  onHover: (day: string | null) => void;
  labels: Record<(typeof SERIES)[number]["key"], string>;
  interestedLabel: string;
  alignRight: boolean;
  index: number;
}) => (
  <div
    className={cn(
      "relative flex h-full flex-1 items-end justify-center gap-[3px] rounded-md px-[3px] transition-colors",
      isHovered ? "bg-secondary/80" : isToday ? "bg-brand-soft/60" : "",
    )}
    onMouseEnter={() => onHover(day.day)}
    onMouseLeave={() => onHover(null)}
    tabIndex={0}
    onFocus={() => onHover(day.day)}
    onBlur={() => onHover(null)}
    aria-label={`${longDay(day.day)}: ${day.calls} ${labels.calls}, ${day.connected} ${labels.connected}, ${day.interested} ${interestedLabel}`}
  >
    {SERIES.map(({ key, color }) => {
      const value = day[key];
      const height = (value / axisTop) * 100;
      return (
        <div
          key={key}
          className="relative flex h-full max-w-[18px] flex-1 items-end"
        >
          <div
            className="relative w-full"
            style={{ height: `${value > 0 ? Math.max(height, 2) : 0}%` }}
          >
            {value > 0 ? (
              <span className="absolute bottom-full left-1/2 mb-0.5 hidden -translate-x-1/2 text-[10px] font-medium text-muted-foreground tabular-nums md:block">
                {value}
              </span>
            ) : null}
            <div
              className="chart-grow-y size-full rounded-t-[4px]"
              style={{
                ...barStyle(color, 100),
                animationDelay: `${index * 30}ms`,
              }}
            />
          </div>
        </div>
      );
    })}

    {isHovered ? (
      <div
        className={cn(
          "pointer-events-none absolute bottom-full z-10 mb-2 w-44 rounded-xl border border-border bg-popover p-3 text-xs shadow-float",
          alignRight ? "right-0" : "left-0",
        )}
        role="tooltip"
      >
        <p className="mb-2 font-semibold text-foreground">{longDay(day.day)}</p>
        <TooltipRow
          color="var(--stage-callback)"
          label={labels.calls}
          value={`${day.calls}`}
        />
        <TooltipRow
          color="var(--stage-interested)"
          label={labels.connected}
          value={`${day.connected} · ${percent(day.connected, day.calls)}%`}
        />
        <TooltipRow
          color="var(--stage-new)"
          label={interestedLabel}
          value={`${day.interested}`}
        />
      </div>
    ) : null}
  </div>
);

const TooltipRow = ({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) => (
  <p className="flex items-center gap-2 py-0.5">
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
    <span className="text-muted-foreground">{label}</span>
    <span className="ml-auto font-semibold text-foreground tabular-nums">
      {value}
    </span>
  </p>
);
