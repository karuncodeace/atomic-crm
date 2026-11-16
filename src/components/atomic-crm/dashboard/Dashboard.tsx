import { useEffect } from "react";
import { useTranslate } from "ra-core";
import { useLocation } from "react-router";
import { Button } from "@/components/ui/button";

import { DashboardCard } from "./DashboardCard";
import { DashboardHero } from "./DashboardHero";
import { PerformancePanel } from "./PerformancePanel";
import { QuickStats } from "./QuickStats";
import { SchedulePanel } from "./SchedulePanel";
import { StatusPanel } from "./StatusPanel";
import { TeamTable } from "./TeamTable";
import { useDashboardStats } from "./useDashboardStats";

/**
 * Five sections: hero (greeting, today's KPIs, target gauge); schedule on the
 * left running alongside performance + status charts and the five quick
 * stats; then the full-width team table. Every number comes from
 * dashboard_stats() (team scope for admins / managers, own scope for BDEs).
 */
export const DashboardContent = () => {
  const translate = useTranslate();
  const { data: stats, error, refetch } = useDashboardStats();
  const { hash } = useLocation();
  const hasStats = !!stats;

  // Sidebar Favorites / Reports link to "/#<section>": scroll there once the
  // section has its real height (after the numbers load).
  useEffect(() => {
    if (!hash) return;
    document
      .getElementById(hash.slice(1))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, hasStats]);

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <DashboardCard className="flex flex-wrap items-center justify-between gap-3 border-destructive/30">
          <p className="text-sm text-destructive">
            {translate("crm.dashboard.home.stats_error", {
              _: "The dashboard numbers could not be loaded.",
            })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {translate("crm.dashboard.home.retry", { _: "Try again" })}
          </Button>
        </DashboardCard>
      ) : null}

      <DashboardHero stats={stats} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <div className="relative">
          <SchedulePanel />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <PerformancePanel stats={stats} />
            <StatusPanel stats={stats} />
          </div>
          <div id="dashboard-metrics" className="scroll-mt-20">
            <QuickStats stats={stats} />
          </div>
        </div>
      </div>

      <TeamTable stats={stats} />
    </div>
  );
};

export const Dashboard = () => <DashboardContent />;
