import { useEffect } from "react";
import { useTranslate } from "ra-core";
import { useLocation } from "react-router";
import { Button } from "@/components/ui/button";

import { DashboardCard } from "./DashboardCard";
import { DashboardHero } from "./DashboardHero";
import { ActivityPanel } from "./ActivityPanel";
import { NeedsAction } from "./NeedsAction";
import { PipelinePanel } from "./PipelinePanel";
import { SchedulePanel } from "./SchedulePanel";
import { TeamTable } from "./TeamTable";
import { useDashboardStats } from "./useDashboardStats";

/**
 * Read top to bottom, one question per section:
 * 1. Today (hero): calls made vs target, connected, interested, calls left.
 * 2. Lead pipeline: where every open lead stands, by stage.
 * 3. Schedule (callbacks / recently connected) beside the last 14 days of
 *    call activity and what needs action next.
 * 4. Team table: per-person numbers.
 * Every number comes from dashboard_stats() (team scope for admins /
 * managers, own scope for BDEs).
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

      <PipelinePanel stats={stats} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <div className="relative">
          <SchedulePanel />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <ActivityPanel stats={stats} />
          <NeedsAction stats={stats} />
        </div>
      </div>

      <TeamTable stats={stats} />
    </div>
  );
};

export const Dashboard = () => <DashboardContent />;
