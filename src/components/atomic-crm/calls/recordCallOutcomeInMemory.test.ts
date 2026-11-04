import fakeRestDataProvider from "ra-data-fakerest";
import { describe, expect, it } from "vitest";

import { recordCallOutcomeInMemory } from "./recordCallOutcomeInMemory";

const setup = () =>
  fakeRestDataProvider({
    call_assignments: [
      {
        id: 1,
        sales_id: 7,
        contact_id: 3,
        company_id: 9,
        deal_id: 5,
        assignment_date: "2026-03-16",
        status: "open",
        created_at: "2026-03-16T08:00:00.000Z",
      },
    ],
    call_logs: [],
    contacts: [
      {
        id: 3,
        first_name: "Ravi",
        last_name: "K",
        company_id: 9,
        lead_stage: "queued",
        retry_count: 0,
        assigned_to: 7,
      },
    ],
    deals: [
      {
        id: 5,
        name: "Acme",
        company_id: 9,
        contact_ids: [3],
        stage: "new",
        amount: 0,
        index: 0,
        created_at: "2026-03-16T08:00:00.000Z",
        updated_at: "2026-03-16T08:00:00.000Z",
      },
    ],
  });

describe("recordCallOutcomeInMemory", () => {
  it("marks the assignment done and moves the lead to callback", async () => {
    const dataProvider = setup();
    const result = await recordCallOutcomeInMemory(dataProvider, {
      assignmentId: 1,
      outcome: "callback",
      salesId: 7,
    });

    expect(result).toMatchObject({
      outcome: "callback",
      lead_stage: "in_progress",
      deal_stage: "callback",
    });
    expect(result.next_attempt_at).toBeTruthy();

    const { data: assignment } = await dataProvider.getOne("call_assignments", {
      id: 1,
    });
    expect(assignment.status).toBe("done");

    const { data: contact } = await dataProvider.getOne("contacts", { id: 3 });
    expect(contact).toMatchObject({
      last_outcome: "callback",
      lead_stage: "in_progress",
    });

    const { data: deal } = await dataProvider.getOne("deals", { id: 5 });
    expect(deal.stage).toBe("callback");
  });

  it("recycles after max no-answer retries", async () => {
    const dataProvider = setup();
    await dataProvider.update("contacts", {
      id: 3,
      data: { retry_count: 2 },
      previousData: { id: 3, retry_count: 0 },
    });

    const result = await recordCallOutcomeInMemory(dataProvider, {
      assignmentId: 1,
      outcome: "no_answer",
      retryWindowWorkingDays: 3,
    });

    expect(result).toMatchObject({
      outcome: "no_answer",
      lead_stage: "recycled",
      deal_stage: "not_answered",
    });
    const { data: contact } = await dataProvider.getOne("contacts", { id: 3 });
    expect(contact.retry_count).toBe(3);
    expect(contact.recycle_reason).toBe("max_no_answer_retries");
  });
});
