import type { CallOutcome } from "../types";

export const CALL_OUTCOMES: {
  value: CallOutcome;
  dealStage: string;
}[] = [
  { value: "callback", dealStage: "callback" },
  { value: "no_answer", dealStage: "not_answered" },
  { value: "interested", dealStage: "interested" },
  { value: "not_interested", dealStage: "not_interested" },
];

/** Today as YYYY-MM-DD in Asia/Kolkata (call-engine timezone). */
export const todayInCallTimezone = (
  now = new Date(),
  timeZone = "Asia/Kolkata",
) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
};

/**
 * Pure priority fill for the hard-cap dial queue.
 * Leftover open count already reserved; returns how many of each bucket fit.
 */
export const planDailySlots = (args: {
  quota: number;
  openLeftover: number;
  dueCallbacks: number;
  newLeads: number;
}) => {
  const leftover = Math.min(Math.max(args.openLeftover, 0), args.quota);
  let remaining = args.quota - leftover;
  const callbacks = Math.min(Math.max(args.dueCallbacks, 0), remaining);
  remaining -= callbacks;
  const news = Math.min(Math.max(args.newLeads, 0), remaining);
  return {
    leftover,
    callbacks,
    news,
    total: leftover + callbacks + news,
    slotsLeft: args.quota - (leftover + callbacks + news),
  };
};
