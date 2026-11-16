import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import type { DashboardStats } from "./dashboardStats";
import { leadsLink } from "./dashboardLinks";

interface QuickStat {
  key: string;
  label: string;
  value: number;
  to?: string;
}

const StatCard = ({ label, value, to }: Omit<QuickStat, "key">) => {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span
            className="size-2 shrink-0 rounded-[3px] bg-brand"
            aria-hidden
          />
          {label}
        </span>
        {to ? (
          <ArrowUpRight
            className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-foreground"
            aria-hidden
          />
        ) : null}
      </div>
      <span className="text-[26px] leading-none font-semibold tracking-tight tabular-nums text-foreground">
        {value.toLocaleString()}
      </span>
    </>
  );
  const className =
    "group flex min-h-[92px] flex-col justify-between gap-3 rounded-[10px] border border-border bg-brand-soft p-4 no-underline transition-colors";
  return to ? (
    <Link to={to} className={`${className} hover:border-brand`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
};

/** Five small counters under the charts; each links to the matching list. */
export const QuickStats = ({
  stats,
}: {
  stats: DashboardStats | undefined;
}) => {
  const translate = useTranslate();

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-[10px]" />
        ))}
      </div>
    );
  }

  const thisMonth = stats.months[stats.months.length - 1];
  const cards: QuickStat[] = [
    {
      key: "new",
      label: translate("crm.dashboard.home.quick_new", { _: "New leads" }),
      value: stats.stages.new ?? 0,
      to: leadsLink({ stage: ["new"] }),
    },
    {
      key: "callbacks",
      label: translate("crm.dashboard.home.quick_callbacks", {
        _: "Callbacks due",
      }),
      value: stats.callbacks_due,
      to: "/call_assignments",
    },
    {
      key: "not_answered",
      label: translate("crm.dashboard.home.quick_not_answered", {
        _: "Not answered",
      }),
      value: stats.stages.not_answered ?? 0,
      to: leadsLink({ stage: ["not_answered"] }),
    },
    {
      key: "interested_month",
      label: translate("crm.dashboard.home.quick_interested_month", {
        _: "Interested this month",
      }),
      value: thisMonth?.interested ?? 0,
      to: leadsLink({ stage: ["interested"] }),
    },
    stats.pending_brochures != null
      ? {
          key: "brochures",
          label: translate("crm.dashboard.kpi.pending_brochures"),
          value: stats.pending_brochures,
          to: "/brochures",
        }
      : {
          key: "overdue_tasks",
          label: translate("crm.dashboard.home.quick_overdue_tasks", {
            _: "Overdue tasks",
          }),
          value: stats.overdue_tasks,
        },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map(({ key, ...card }) => (
        <StatCard key={key} {...card} />
      ))}
    </div>
  );
};
