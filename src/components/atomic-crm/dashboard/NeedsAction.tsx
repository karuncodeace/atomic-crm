import { useTranslate } from "ra-core";
import { Link } from "react-router";
import {
  AlarmClock,
  ArrowRight,
  CheckCircle2,
  FileText,
  PhoneForwarded,
  PhoneMissed,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DashboardCard, DashboardCardHeader } from "./DashboardCard";
import type { DashboardStats } from "./dashboardStats";

interface ActionItem {
  key: string;
  label: string;
  hint: string;
  value: number;
  icon: LucideIcon;
  color: string;
  /** Where the work gets done, with its link text. */
  to?: { path: string; label: string };
}

const tint = (color: string, amount: number) =>
  `color-mix(in oklab, ${color} ${amount}%, transparent)`;

/**
 * What needs doing next, each tile linking to where it gets done: callbacks
 * that are due, unanswered leads to try again, overdue tasks and (for admins
 * and managers) brochures waiting for review. Tiles with work waiting get a
 * coloured accent; empty ones say "All clear".
 */
export const NeedsAction = ({
  stats,
}: {
  stats: DashboardStats | undefined;
}) => {
  const translate = useTranslate();

  if (!stats) {
    return (
      <DashboardCard className="flex flex-col gap-5">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[150px] rounded-xl" />
          ))}
        </div>
      </DashboardCard>
    );
  }

  const openFollowUps = translate("crm.dashboard.home.open_follow_ups", {
    _: "Open follow-ups",
  });
  const items: ActionItem[] = [
    {
      key: "callbacks",
      label: translate("crm.dashboard.home.quick_callbacks", {
        _: "Callbacks due",
      }),
      hint: translate("crm.dashboard.home.callbacks_due_hint", {
        _: "Due today or earlier",
      }),
      value: stats.callbacks_due,
      icon: PhoneForwarded,
      color: "var(--stage-callback)",
      to: { path: "/follow-ups", label: openFollowUps },
    },
    {
      key: "not_answered",
      label: translate("crm.dashboard.home.quick_not_connected", {
        _: "Not connected",
      }),
      hint: translate("crm.dashboard.home.not_connected_hint", {
        _: "Leads to try again",
      }),
      value: stats.stages.not_answered ?? 0,
      icon: PhoneMissed,
      color: "var(--stage-not-answered)",
      to: { path: "/follow-ups", label: openFollowUps },
    },
    {
      key: "overdue_tasks",
      label: translate("crm.dashboard.home.quick_overdue_tasks", {
        _: "Overdue tasks",
      }),
      hint: translate("crm.dashboard.home.overdue_tasks_hint", {
        _: "Past their due date",
      }),
      value: stats.overdue_tasks,
      icon: AlarmClock,
      color: "var(--stage-not-interested)",
    },
    ...(stats.pending_brochures != null
      ? [
          {
            key: "brochures",
            label: translate("crm.dashboard.kpi.pending_brochures"),
            hint: translate("crm.dashboard.home.brochures_hint", {
              _: "Waiting for your review",
            }),
            value: stats.pending_brochures,
            icon: FileText,
            color: "var(--stage-new)",
            to: {
              path: "/brochures",
              label: translate("crm.dashboard.home.open_brochures", {
                _: "Review brochures",
              }),
            },
          },
        ]
      : []),
  ];
  const waiting = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <DashboardCard className="flex flex-col gap-5">
      <DashboardCardHeader
        title={translate("crm.dashboard.home.needs_action", {
          _: "Needs action",
        })}
        description={translate("crm.dashboard.home.needs_action_hint", {
          _: "What to work on next",
        })}
        aside={
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {waiting.toLocaleString()}
            </span>{" "}
            {translate("crm.dashboard.home.items_waiting", {
              _: "waiting",
            })}
          </span>
        }
      />
      <ul
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2",
          items.length === 4 ? "2xl:grid-cols-4" : "2xl:grid-cols-3",
        )}
      >
        {items.map((item) => (
          <li key={item.key}>
            <ActionTile item={item} />
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
};

const ActionTile = ({ item }: { item: ActionItem }) => {
  const translate = useTranslate();
  const { label, hint, value, icon: Icon, color, to } = item;
  const hasWork = value > 0;

  const body = (
    <>
      {hasWork ? (
        <span
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: color }}
          aria-hidden
        />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]"
          style={{
            background: tint(color, hasWork ? 20 : 10),
            color: hasWork ? color : "var(--muted-foreground)",
          }}
          aria-hidden
        >
          <Icon className="size-[18px]" strokeWidth={2} />
        </span>
        <span className="text-[30px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
          {value.toLocaleString()}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {label}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {hasWork
            ? hint
            : translate("crm.dashboard.home.all_clear", { _: "All clear" })}
        </p>
      </div>
      {to ? (
        <span className="flex items-center gap-1 border-t border-border/70 pt-3 text-xs font-medium text-foreground">
          {to.label}
          <ArrowRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      ) : (
        <span className="flex items-center gap-1 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          {hasWork ? null : (
            <CheckCircle2 className="size-3.5 text-success" aria-hidden />
          )}
          {hasWork
            ? translate("crm.dashboard.home.check_contacts", {
                _: "Open each lead to close them",
              })
            : translate("crm.dashboard.home.nothing_late", {
                _: "Nothing late",
              })}
        </span>
      )}
    </>
  );

  const className =
    "group relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border border-border/80 bg-card p-4 no-underline shadow-card transition-[box-shadow,transform] duration-200";
  const style = hasWork
    ? {
        backgroundImage: `linear-gradient(160deg, ${tint(color, 10)}, transparent 60%)`,
      }
    : undefined;

  return to ? (
    <Link
      to={to.path}
      className={cn(
        className,
        "hover:-translate-y-0.5 hover:shadow-raised focus-visible:shadow-raised",
      )}
      style={style}
    >
      {body}
    </Link>
  ) : (
    <div className={className} style={style}>
      {body}
    </div>
  );
};
