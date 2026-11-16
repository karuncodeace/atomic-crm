import { useGetIdentity, useTranslate } from "ra-core";
import {
  CalendarDays,
  Download,
  PhoneCall,
  PhoneForwarded,
  Sparkles,
  ListTodo,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { CircularGauge } from "./CircularGauge";
import type { DashboardStats } from "./dashboardStats";
import { exportTeamStats } from "./exportTeamStats";
import { percent } from "./useDashboardStats";

export const SCHEDULE_ANCHOR = "dashboard-schedule";

const greetingKey = (hour: number) =>
  hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

const GREETING_FALLBACK = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
} as const;

const InlineKpi = ({
  icon: Icon,
  value,
  suffix,
  label,
}: {
  icon: LucideIcon;
  value: number | undefined;
  suffix?: string;
  label: string;
}) => (
  <div className="flex min-w-0 flex-col gap-2">
    <span className="flex size-8 items-center justify-center rounded-full bg-card text-foreground">
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
    </span>
    {value === undefined ? (
      <Skeleton className="h-8 w-16" />
    ) : (
      <span className="text-[28px] leading-none font-semibold tracking-tight tabular-nums text-foreground">
        {value.toLocaleString()}
        {suffix ? (
          <span className="ml-1 text-base font-medium text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </span>
    )}
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

/** Full-width hero: greeting, today's four call numbers, daily target gauge. */
export const DashboardHero = ({
  stats,
}: {
  stats: DashboardStats | undefined;
}) => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const now = new Date();
  const firstName = identity?.fullName?.split(" ")[0] ?? "";
  const greeting = greetingKey(now.getHours());
  const isTeam = stats?.scope === "team";
  const targetProgress = stats ? percent(stats.calls_today, stats.target) : 0;

  return (
    <section
      id="dashboard-overview"
      className="scroll-mt-20 rounded-xl border border-border bg-secondary p-5 lg:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <nav
          aria-label={translate("crm.dashboard.home.breadcrumb", {
            _: "Breadcrumb",
          })}
          className="text-xs text-muted-foreground"
        >
          <span>{translate("ra.page.dashboard")}</span>
          <span className="mx-1.5">/</span>
          <span className="font-medium text-foreground">
            {isTeam
              ? translate("crm.dashboard.home.team_overview", {
                  _: "Team overview",
                })
              : translate("crm.dashboard.home.my_overview", {
                  _: "My overview",
                })}
          </span>
        </nav>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title={translate("crm.dashboard.home.go_to_schedule", {
              _: "Go to schedule",
            })}
            onClick={() =>
              document
                .getElementById(SCHEDULE_ANCHOR)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <CalendarDays aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!stats}
            title={translate("crm.dashboard.home.export", {
              _: "Export team stats (CSV)",
            })}
            onClick={() => stats && exportTeamStats(stats)}
          >
            <Download aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-foreground lg:text-[30px]">
            {translate(`crm.dashboard.home.greeting_${greeting}`, {
              _: GREETING_FALLBACK[greeting],
            })}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4 lg:gap-x-10">
            <InlineKpi
              icon={PhoneCall}
              value={stats?.calls_today}
              suffix={stats ? `/ ${stats.target}` : undefined}
              label={translate("crm.dashboard.home.kpi_calls_today", {
                _: "Calls made today",
              })}
            />
            <InlineKpi
              icon={PhoneForwarded}
              value={stats?.connected_today}
              label={translate("crm.dashboard.home.kpi_connected", {
                _: "Connected today (%{rate}%)",
                rate: stats
                  ? percent(stats.connected_today, stats.calls_today)
                  : 0,
              })}
            />
            <InlineKpi
              icon={Sparkles}
              value={stats?.interested_today}
              label={translate("crm.dashboard.home.kpi_interested", {
                _: "Interested today",
              })}
            />
            <InlineKpi
              icon={ListTodo}
              value={stats?.open_calls}
              label={translate("crm.dashboard.home.kpi_open_calls", {
                _: "Calls left in queue",
              })}
            />
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          {stats ? (
            <CircularGauge
              value={targetProgress}
              label={translate("crm.dashboard.home.gauge_label", {
                _: "of today's call target",
              })}
            />
          ) : (
            <Skeleton className="size-[184px] rounded-full" />
          )}
        </div>
      </div>
    </section>
  );
};
