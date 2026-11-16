import { useMemo, useState } from "react";
import { useTranslate } from "ra-core";
import { useNavigate } from "react-router";
import { ArrowDown, ArrowUp, MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  DashboardCard,
  DashboardCardTitle,
  DashboardEmpty,
} from "./DashboardCard";
import type { DashboardStats, TeamMemberStats } from "./dashboardStats";
import { PersonAvatar } from "./PersonAvatar";
import { leadsLink } from "./dashboardLinks";
import { percent } from "./useDashboardStats";

export const TEAM_ANCHOR = "dashboard-team";

type SortKey =
  | "name"
  | "calls_today"
  | "connected_today"
  | "interested_today"
  | "open_calls"
  | "calls_month"
  | "connect_rate"
  | "interested_month"
  | "leads";

type RoleFilter = "all" | "bde" | "manager";

const PAGE_SIZE = 8;

const sortValue = (member: TeamMemberStats, key: SortKey): number | string => {
  if (key === "name")
    return `${member.first_name} ${member.last_name}`.toLowerCase();
  if (key === "connect_rate")
    return percent(member.connected_month, member.calls_month);
  return member[key];
};

interface Column {
  key: SortKey;
  fallback: string;
  className?: string;
}

const COLUMNS: Column[] = [
  { key: "name", fallback: "Person" },
  { key: "calls_today", fallback: "Calls today", className: "min-w-36" },
  { key: "connected_today", fallback: "Connected" },
  { key: "interested_today", fallback: "Interested" },
  { key: "open_calls", fallback: "In queue" },
  { key: "calls_month", fallback: "Calls (month)" },
  { key: "connect_rate", fallback: "Connect rate" },
  { key: "interested_month", fallback: "Interested (month)" },
  { key: "leads", fallback: "Open leads" },
];

const TargetProgress = ({ done, target }: { done: number; target: number }) => {
  const value = percent(done, target);
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">
        {done}
        <span className="font-normal text-muted-foreground">/{target}</span>
      </span>
      <span className="h-1.5 w-full max-w-20 overflow-hidden rounded-full bg-secondary">
        <span
          className={cn(
            "block h-full rounded-full",
            value >= 100 ? "bg-success" : "bg-brand",
          )}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </span>
    </div>
  );
};

/** Bottom table: one row per dialer (team scope) or the BDE's own row. */
export const TeamTable = ({ stats }: { stats: DashboardStats | undefined }) => {
  const translate = useTranslate();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "calls_today",
    desc: true,
  });
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = (stats?.team ?? []).filter(
      (member) =>
        (role === "all" || member.role === role) &&
        `${member.first_name} ${member.last_name}`
          .toLowerCase()
          .includes(needle),
    );
    return [...filtered].sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      const order = left < right ? -1 : left > right ? 1 : 0;
      return sort.desc ? -order : order;
    });
  }, [stats, query, role, sort]);

  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const isTeam = stats?.scope === "team";
  const columnLabel = (column: Column) =>
    translate(`crm.dashboard.home.col_${column.key}`, { _: column.fallback });

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : { key, desc: key !== "name" },
    );
    setPage(1);
  };

  const roleLabel = (value: string) =>
    value === "manager"
      ? translate("crm.dashboard.home.role_manager", { _: "Manager" })
      : translate("crm.dashboard.home.role_bde", { _: "BDE" });

  return (
    <DashboardCard id={TEAM_ANCHOR} className="scroll-mt-20 p-0">
      <div className="flex flex-col gap-3 p-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <DashboardCardTitle>
            {isTeam
              ? translate("crm.dashboard.home.team_title", {
                  _: "Team performance",
                })
              : translate("crm.dashboard.home.my_title", {
                  _: "My performance",
                })}
          </DashboardCardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {translate("crm.dashboard.home.team_caption", {
              _: "Today against the daily target, and this month so far",
            })}
          </p>
        </div>
        {isTeam ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs">
              {(["all", "bde", "manager"] as RoleFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setRole(value);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 font-medium transition-colors",
                    role === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={role === value}
                >
                  {value === "all"
                    ? translate("crm.dashboard.home.role_all", { _: "All" })
                    : roleLabel(value)}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-auto">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={translate("crm.dashboard.home.search_people", {
                  _: "Search people",
                })}
                aria-label={translate("crm.dashboard.home.search_people", {
                  _: "Search people",
                })}
                className="h-10 w-full pl-9 sm:w-48"
              />
            </div>
          </div>
        ) : null}
      </div>

      {!stats ? (
        <div className="flex flex-col gap-2 px-5 pb-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <DashboardEmpty>
          {stats.team.length === 0
            ? translate("crm.dashboard.home.team_empty", {
                _: "No BDEs or managers yet. Add them under Users.",
              })
            : translate("crm.dashboard.home.team_no_match", {
                _: "Nobody matches this search.",
              })}
        </DashboardEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-y border-border bg-secondary/70">
                {COLUMNS.map((column) => {
                  const isSorted = sort.key === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        isSorted
                          ? sort.desc
                            ? "descending"
                            : "ascending"
                          : "none"
                      }
                      className={cn(
                        "px-3 py-2.5 text-left first:pl-5",
                        column.className,
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex items-center gap-1 text-[10.5px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase hover:text-foreground"
                      >
                        {columnLabel(column)}
                        {isSorted ? (
                          sort.desc ? (
                            <ArrowDown className="size-3" aria-hidden />
                          ) : (
                            <ArrowUp className="size-3" aria-hidden />
                          )
                        ) : null}
                      </button>
                    </th>
                  );
                })}
                <th scope="col" className="w-12 pr-5">
                  <span className="sr-only">
                    {translate("crm.dashboard.home.actions", { _: "Actions" })}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((member) => {
                const rate = percent(
                  member.connected_month,
                  member.calls_month,
                );
                const openLeads = leadsLink({ sales_id: member.id });
                return (
                  <tr
                    key={member.id}
                    onClick={() => navigate(openLeads)}
                    className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-secondary/50"
                  >
                    <td className="py-3 pr-3 pl-5">
                      <div className="flex items-center gap-3">
                        <PersonAvatar
                          firstName={member.first_name}
                          lastName={member.last_name}
                          avatar={member.avatar}
                          className="size-8"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {roleLabel(member.role)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <TargetProgress
                        done={member.calls_today}
                        target={member.target}
                      />
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {member.connected_today}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({percent(member.connected_today, member.calls_today)}%)
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {member.interested_today}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {member.open_calls}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {member.calls_month}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                          member.calls_month === 0
                            ? "bg-secondary text-muted-foreground"
                            : rate >= 50
                              ? "bg-success/10 text-success"
                              : rate >= 25
                                ? "bg-warning/15 text-[#a8731f]"
                                : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {member.calls_month === 0 ? "—" : `${rate}%`}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {member.interested_month}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{member.leads}</td>
                    <td
                      className="py-3 pr-5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={translate(
                                "crm.dashboard.home.actions",
                                {
                                  _: "Actions",
                                },
                              )}
                            />
                          }
                        >
                          <MoreHorizontal aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(openLeads)}>
                            {translate("crm.dashboard.home.view_leads", {
                              _: "View open leads",
                            })}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(
                                leadsLink({
                                  sales_id: member.id,
                                  stage: ["interested"],
                                }),
                              )
                            }
                          >
                            {translate("crm.dashboard.home.view_interested", {
                              _: "View interested leads",
                            })}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {stats && rows.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>
            {translate("crm.dashboard.home.page_of", {
              _: "Page %{page} of %{count}",
              page: currentPage,
              count: pageCount,
            })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              {translate("ra.navigation.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              {translate("ra.navigation.next")}
            </Button>
          </div>
        </div>
      ) : null}
    </DashboardCard>
  );
};
