import { datatype, random } from "faker/locale/en_US";

import type { CallLog, CallOutcome } from "../../../types";
import type { Db } from "./types";

const DAYS_OF_HISTORY = 150;
// Weighted like a real cold-calling day: most calls go unanswered.
const OUTCOMES: CallOutcome[] = [
  "no_answer",
  "no_answer",
  "no_answer",
  "no_answer",
  "callback",
  "callback",
  "not_interested",
  "not_interested",
  "interested",
];

/**
 * Demo call history so the dashboard has numbers to show: every active BDE /
 * manager makes some calls on each weekday of the last ~5 months, plus part of
 * today's quota. Assignment ids are placeholders (nothing reads them back).
 */
export const generateCallLogs = (db: Db): CallLog[] => {
  const dialers = db.sales.filter(
    (sale) =>
      !sale.disabled && (sale.role === "bde" || sale.role === "manager"),
  );
  if (dialers.length === 0 || db.contacts.length === 0) return [];

  const logs: CallLog[] = [];
  const now = new Date();
  for (let daysAgo = DAYS_OF_HISTORY; daysAgo >= 0; daysAgo--) {
    const day = new Date(now);
    day.setDate(now.getDate() - daysAgo);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    for (const dialer of dialers) {
      const quota = dialer.role === "manager" ? 10 : 25;
      // Teams improve over time; today is still in progress.
      const ramp = 0.45 + 0.4 * (1 - daysAgo / DAYS_OF_HISTORY);
      const calls =
        daysAgo === 0
          ? datatype.number({ min: 3, max: Math.round(quota * 0.6) })
          : Math.round(quota * ramp * datatype.float({ min: 0.7, max: 1.1 }));
      for (let i = 0; i < calls; i++) {
        const at = new Date(day);
        at.setHours(
          10 + Math.floor((i / Math.max(calls, 1)) * 7),
          datatype.number(59),
        );
        if (at > now) continue;
        logs.push({
          id: logs.length,
          assignment_id: logs.length,
          sales_id: dialer.id,
          contact_id: random.arrayElement(db.contacts).id,
          outcome: random.arrayElement(OUTCOMES),
          notes: null,
          next_attempt_at: null,
          created_at: at.toISOString(),
        });
      }
    }
  }
  return logs;
};
