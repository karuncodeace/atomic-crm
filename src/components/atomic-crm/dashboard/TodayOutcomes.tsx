import { useTranslate } from "ra-core";
import {
  PhoneForwarded,
  PhoneMissed,
  Sparkles,
  ThumbsDown,
  type LucideIcon,
} from "lucide-react";

import type { DashboardStats } from "./dashboardStats";
import { percent } from "./useDashboardStats";

type OutcomeKey = keyof DashboardStats["outcomes_today"];

const OUTCOMES: { key: OutcomeKey; color: string; icon: LucideIcon }[] = [
  { key: "interested", color: "var(--stage-interested)", icon: Sparkles },
  { key: "callback", color: "var(--stage-callback)", icon: PhoneForwarded },
  { key: "no_answer", color: "var(--stage-not-answered)", icon: PhoneMissed },
  {
    key: "not_interested",
    color: "var(--stage-not-interested)",
    icon: ThumbsDown,
  },
];

/** Soft tint of a stage colour, for icon discs and tile washes. */
const tint = (color: string, amount: number) =>
  `color-mix(in oklab, ${color} ${amount}%, transparent)`;

/**
 * How today's finished calls ended: one stacked bar for the split, then a
 * tile per outcome with its icon, count, share of today's calls and a share
 * bar. Sits at the bottom of the Call activity card.
 */
export const TodayOutcomes = ({
  outcomes,
}: {
  outcomes: DashboardStats["outcomes_today"];
}) => {
  const translate = useTranslate();
  const total = OUTCOMES.reduce((sum, { key }) => sum + outcomes[key], 0);

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-foreground">
          {translate("crm.dashboard.home.outcomes_today", {
            _: "Today's outcomes",
          })}
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {translate("crm.dashboard.home.outcomes_total", {
            _: "%{count} calls finished",
            count: total,
          })}
        </span>
      </div>

      {/* split of today's calls */}
      <div
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-secondary"
        role="img"
        aria-label={OUTCOMES.map(
          ({ key }) =>
            `${translate(`resources.call_assignments.outcome.${key}`)}: ${outcomes[key]}`,
        ).join(", ")}
      >
        {total > 0
          ? OUTCOMES.map(({ key, color }) =>
              outcomes[key] > 0 ? (
                <span
                  key={key}
                  className="h-full transition-[width] duration-700 ease-out first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${(outcomes[key] / total) * 100}%`,
                    background: `linear-gradient(180deg, color-mix(in oklab, ${color} 75%, white), ${color})`,
                  }}
                />
              ) : null,
            )
          : null}
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {OUTCOMES.map(({ key, color, icon: Icon }) => {
          const value = outcomes[key];
          const share = percent(value, total);
          return (
            <li
              key={key}
              className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-card"
              style={{
                backgroundImage: `linear-gradient(160deg, ${tint(color, 9)}, transparent 55%)`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="flex size-8 items-center justify-center rounded-lg shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]"
                  style={{ background: tint(color, 20), color }}
                  aria-hidden
                >
                  <Icon className="size-4" strokeWidth={2} />
                </span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {share}%
                </span>
              </div>
              <div>
                <p className="text-2xl leading-none font-semibold tracking-tight text-foreground tabular-nums">
                  {value}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {translate(`resources.call_assignments.outcome.${key}`)}
                </p>
              </div>
              <span className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                <span
                  className="block h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${share}%`, background: color }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
