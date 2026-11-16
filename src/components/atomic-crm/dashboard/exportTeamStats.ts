import type { DashboardStats } from "./dashboardStats";
import { percent } from "./useDashboardStats";

const HEADER = [
  "Name",
  "Role",
  "Calls today",
  "Daily target",
  "Connected today",
  "Interested today",
  "Open calls",
  "Calls this month",
  "Connect rate this month (%)",
  "Interested this month",
  "Open leads",
];

const escapeCell = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Downloads the team table as a CSV file (one row per person). */
export const exportTeamStats = (stats: DashboardStats): void => {
  const rows = stats.team.map((member) => [
    `${member.first_name} ${member.last_name}`,
    member.role,
    member.calls_today,
    member.target,
    member.connected_today,
    member.interested_today,
    member.open_calls,
    member.calls_month,
    percent(member.connected_month, member.calls_month),
    member.interested_month,
    member.leads,
  ]);
  const csv = [HEADER, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `team-stats-${stats.today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
