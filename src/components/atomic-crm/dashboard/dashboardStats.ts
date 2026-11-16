import type { DataProvider, Identifier } from "ra-core";

import { todayInCallTimezone } from "../calls/callEngine";
import type {
  Brochure,
  CallAssignment,
  CallLog,
  Contact,
  Deal,
  RAFile,
  Sale,
  SalesRole,
  Task,
} from "../types";

/** One dialer's row in the dashboard team table. */
export interface TeamMemberStats {
  id: Identifier;
  first_name: string;
  last_name: string;
  role: SalesRole;
  avatar: RAFile | null;
  /** Daily call target (call engine quota). */
  target: number;
  calls_today: number;
  connected_today: number;
  interested_today: number;
  open_calls: number;
  calls_month: number;
  connected_month: number;
  interested_month: number;
  /** Open leads (deals) owned. */
  leads: number;
}

export interface MonthStats {
  /** First day of the month, YYYY-MM-DD. */
  month: string;
  calls: number;
  connected: number;
  interested: number;
}

/** One day of calls (activity chart). */
export interface DayStats {
  /** YYYY-MM-DD in the call-engine timezone. */
  day: string;
  calls: number;
  connected: number;
  interested: number;
}

/**
 * Shape returned by the `dashboard_stats()` Postgres function (and by its
 * FakeRest twin below). "team" = admins and managers (everyone who calls),
 * "self" = a BDE's own numbers.
 */
export interface DashboardStats {
  scope: "team" | "self";
  today: string;
  target: number;
  calls_today: number;
  connected_today: number;
  interested_today: number;
  open_calls: number;
  outcomes_today: {
    interested: number;
    callback: number;
    no_answer: number;
    not_interested: number;
  };
  /** Last 6 months, oldest first. */
  months: MonthStats[];
  /** Last 14 days, oldest first. */
  days: DayStats[];
  /** Open leads per stage value. */
  stages: Record<string, number>;
  leads_total: number;
  callbacks_due: number;
  overdue_tasks: number;
  /** Team scope only; null for a BDE. */
  pending_brochures: number | null;
  team: TeamMemberStats[];
}

const BDE_TARGET = 25;
const MANAGER_TARGET = 10;
const MONTHS = 6;
const DAYS = 14;

const monthKey = (day: string) => `${day.slice(0, 7)}-01`;

const lastMonths = (today: string): string[] => {
  const [year, month] = today.split("-").map(Number);
  return Array.from({ length: MONTHS }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (MONTHS - 1 - index), 1));
    return date.toISOString().slice(0, 10);
  });
};

const lastDays = (today: string): string[] => {
  const [year, month, day] = today.split("-").map(Number);
  return Array.from({ length: DAYS }, (_, index) =>
    new Date(Date.UTC(year, month - 1, day - (DAYS - 1 - index)))
      .toISOString()
      .slice(0, 10),
  );
};

const getAll = async <T extends { id: Identifier }>(
  dataProvider: DataProvider,
  resource: string,
): Promise<T[]> => {
  const { data } = await dataProvider.getList<T>(resource, {
    pagination: { page: 1, perPage: 100_000 },
    sort: { field: "id", order: "ASC" },
    filter: {},
  });
  return data;
};

/** FakeRest twin of `dashboard_stats()`: same numbers, from the in-memory db. */
export const computeDashboardStatsInMemory = async (
  dataProvider: DataProvider,
  identity: { id: Identifier; role?: SalesRole } | undefined,
  now = new Date(),
): Promise<DashboardStats> => {
  const [sales, logs, assignments, deals, contacts, tasks, brochures] =
    await Promise.all([
      getAll<Sale>(dataProvider, "sales"),
      getAll<CallLog>(dataProvider, "call_logs"),
      getAll<CallAssignment>(dataProvider, "call_assignments"),
      getAll<Deal>(dataProvider, "deals"),
      getAll<Contact>(dataProvider, "contacts"),
      getAll<Task>(dataProvider, "tasks"),
      getAll<Brochure>(dataProvider, "brochures"),
    ]);

  const isTeam = identity?.role === "admin" || identity?.role === "manager";
  const today = todayInCallTimezone(now);
  const thisMonth = monthKey(today);
  const months = lastMonths(today);
  const dayOf = (iso: string) => todayInCallTimezone(new Date(iso));

  const people = sales.filter(
    (sale) =>
      !sale.disabled &&
      (sale.role === "bde" || sale.role === "manager") &&
      (isTeam || sale.id === identity?.id),
  );
  const peopleIds = new Set(people.map((person) => person.id));
  const scopedLogs = logs
    .filter((log) => peopleIds.has(log.sales_id))
    .map((log) => ({ ...log, day: dayOf(log.created_at) }))
    .filter((log) => monthKey(log.day) >= months[0]);
  const isConnected = (log: CallLog) => log.outcome !== "no_answer";
  const openDeals = deals.filter((deal) => !deal.archived_at);
  const scopedDeals = openDeals.filter(
    (deal) => isTeam || deal.sales_id === identity?.id,
  );

  const team: TeamMemberStats[] = people
    .map((person) => {
      const own = scopedLogs.filter((log) => log.sales_id === person.id);
      const todays = own.filter((log) => log.day === today);
      const monthly = own.filter((log) => monthKey(log.day) === thisMonth);
      return {
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        role: person.role as SalesRole,
        avatar: person.avatar ?? null,
        target: person.role === "manager" ? MANAGER_TARGET : BDE_TARGET,
        calls_today: todays.length,
        connected_today: todays.filter(isConnected).length,
        interested_today: todays.filter((log) => log.outcome === "interested")
          .length,
        open_calls: assignments.filter(
          (a) => a.sales_id === person.id && a.status === "open",
        ).length,
        calls_month: monthly.length,
        connected_month: monthly.filter(isConnected).length,
        interested_month: monthly.filter((log) => log.outcome === "interested")
          .length,
        leads: openDeals.filter((deal) => deal.sales_id === person.id).length,
      };
    })
    .sort(
      (a, b) =>
        b.calls_today - a.calls_today ||
        a.first_name.localeCompare(b.first_name),
    );

  const sum = (pick: (member: TeamMemberStats) => number) =>
    team.reduce((total, member) => total + pick(member), 0);
  const todaysLogs = scopedLogs.filter((log) => log.day === today);
  const countOutcome = (outcome: CallLog["outcome"]) =>
    todaysLogs.filter((log) => log.outcome === outcome).length;

  return {
    scope: isTeam ? "team" : "self",
    today,
    target: sum((member) => member.target),
    calls_today: sum((member) => member.calls_today),
    connected_today: sum((member) => member.connected_today),
    interested_today: sum((member) => member.interested_today),
    open_calls: sum((member) => member.open_calls),
    outcomes_today: {
      interested: countOutcome("interested"),
      callback: countOutcome("callback"),
      no_answer: countOutcome("no_answer"),
      not_interested: countOutcome("not_interested"),
    },
    months: months.map((month) => {
      const inMonth = scopedLogs.filter((log) => monthKey(log.day) === month);
      return {
        month,
        calls: inMonth.length,
        connected: inMonth.filter(isConnected).length,
        interested: inMonth.filter((log) => log.outcome === "interested")
          .length,
      };
    }),
    days: lastDays(today).map((day) => {
      const onDay = scopedLogs.filter((log) => log.day === day);
      return {
        day,
        calls: onDay.length,
        connected: onDay.filter(isConnected).length,
        interested: onDay.filter((log) => log.outcome === "interested").length,
      };
    }),
    stages: scopedDeals.reduce<Record<string, number>>((acc, deal) => {
      acc[deal.stage] = (acc[deal.stage] ?? 0) + 1;
      return acc;
    }, {}),
    leads_total: scopedDeals.length,
    callbacks_due: contacts.filter(
      (contact) =>
        contact.status === "callback" &&
        (!contact.next_attempt_at || dayOf(contact.next_attempt_at) <= today) &&
        (isTeam || contact.assigned_to === identity?.id),
    ).length,
    overdue_tasks: tasks.filter(
      (task) =>
        !task.done_date &&
        !!task.due_date &&
        dayOf(task.due_date) < today &&
        (isTeam || task.sales_id === identity?.id),
    ).length,
    pending_brochures: isTeam
      ? brochures.filter((brochure) => brochure.status === "pending").length
      : null,
    team,
  };
};
