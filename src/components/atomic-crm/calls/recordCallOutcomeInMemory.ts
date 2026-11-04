import type { DataProvider, Identifier } from "ra-core";

import type {
  CallAssignment,
  CallLog,
  CallOutcome,
  Contact,
  Deal,
  LeadStage,
  RecordCallOutcomeResult,
} from "../types";
import { todayInCallTimezone } from "./callEngine";

const nextWorkingDayIso = (fromDate: string) => {
  const date = new Date(`${fromDate}T10:00:00+05:30`);
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString();
};

/**
 * FakeRest twin of `record_call_outcome()`: closes the assignment, logs the
 * outcome, and syncs contact lead fields + linked deal stage.
 */
export const recordCallOutcomeInMemory = async (
  dataProvider: DataProvider,
  args: {
    assignmentId: Identifier;
    outcome: CallOutcome;
    notes?: string | null;
    nextAttemptAt?: string | null;
    salesId?: Identifier;
    retryWindowWorkingDays?: number;
  },
): Promise<RecordCallOutcomeResult> => {
  const outcome = args.outcome;
  const retryWindow = args.retryWindowWorkingDays ?? 3;
  const { data: assignment } = await dataProvider.getOne<CallAssignment>(
    "call_assignments",
    { id: args.assignmentId },
  );
  if (assignment.status !== "open") {
    throw new Error(`Assignment ${args.assignmentId} is already done`);
  }

  const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
    id: assignment.contact_id,
  });

  const today = todayInCallTimezone();
  let retry = contact.retry_count ?? 0;
  let nextAttemptAt: string | null = null;
  let leadStage: LeadStage = "in_progress";
  let dealStage = "callback";

  if (outcome === "callback") {
    nextAttemptAt = args.nextAttemptAt || nextWorkingDayIso(today);
    leadStage = "in_progress";
    dealStage = "callback";
  } else if (outcome === "no_answer") {
    retry += 1;
    if (retry >= retryWindow) {
      leadStage = "recycled";
      dealStage = "not_answered";
      nextAttemptAt = null;
    } else {
      nextAttemptAt = args.nextAttemptAt || nextWorkingDayIso(today);
      leadStage = "in_progress";
      dealStage = "not_answered";
    }
  } else if (outcome === "interested") {
    leadStage = "interested";
    dealStage = "interested";
  } else {
    leadStage = "not_interested";
    dealStage = "not_interested";
  }

  const { data: log } = await dataProvider.create<CallLog>("call_logs", {
    data: {
      assignment_id: assignment.id,
      sales_id: args.salesId ?? assignment.sales_id,
      contact_id: assignment.contact_id,
      outcome,
      notes: args.notes ?? null,
      next_attempt_at: nextAttemptAt,
      created_at: new Date().toISOString(),
    },
  });

  await dataProvider.update<CallAssignment>("call_assignments", {
    id: assignment.id,
    data: { status: "done", done_at: new Date().toISOString() },
    previousData: assignment,
  });

  await dataProvider.update<Contact>("contacts", {
    id: contact.id,
    data: {
      last_outcome: outcome,
      last_attempt_at: new Date().toISOString(),
      next_attempt_at: nextAttemptAt,
      retry_count: retry,
      lead_stage: leadStage,
      recycled_at:
        leadStage === "recycled"
          ? new Date().toISOString()
          : contact.recycled_at,
      recycle_reason:
        leadStage === "recycled"
          ? "max_no_answer_retries"
          : contact.recycle_reason,
    },
    previousData: contact,
  });

  if (assignment.deal_id != null) {
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: assignment.deal_id,
    });
    if (!deal.archived_at) {
      await dataProvider.update<Deal>("deals", {
        id: deal.id,
        data: { stage: dealStage },
        previousData: deal,
      });
    }
  }

  return {
    assignment_id: Number(assignment.id),
    log_id: Number(log.id),
    outcome,
    lead_stage: leadStage,
    deal_stage: dealStage,
    next_attempt_at: nextAttemptAt,
  };
};
