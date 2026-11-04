import fakeRestDataProvider from "ra-data-fakerest";
import { describe, expect, it } from "vitest";

import { assignDailyCallsInMemory } from "./assignDailyCallsInMemory";

const today = "2026-03-16"; // Monday

const setup = () =>
  fakeRestDataProvider({
    sales: [
      {
        id: 1,
        first_name: "Ada",
        last_name: "BDE",
        role: "bde",
        disabled: false,
        administrator: false,
        email: "ada@example.com",
        user_id: "u1",
      },
      {
        id: 2,
        first_name: "Mo",
        last_name: "Mgr",
        role: "manager",
        disabled: false,
        administrator: false,
        email: "mo@example.com",
        user_id: "u2",
      },
    ],
    contacts: [
      {
        id: 10,
        first_name: "New",
        last_name: "One",
        company_id: 100,
        lead_stage: "new",
        assigned_to: null,
        do_not_contact: false,
      },
      {
        id: 11,
        first_name: "New",
        last_name: "Two",
        company_id: 101,
        lead_stage: "new",
        assigned_to: null,
        do_not_contact: false,
      },
      {
        id: 12,
        first_name: "Callback",
        last_name: "Due",
        company_id: 102,
        lead_stage: "in_progress",
        assigned_to: 1,
        last_outcome: "callback",
        next_attempt_at: "2026-03-15T10:00:00.000Z",
        do_not_contact: false,
      },
    ],
    call_assignments: [
      {
        id: 1,
        sales_id: 1,
        contact_id: 99,
        company_id: 199,
        assignment_date: "2026-03-15",
        status: "open",
        created_at: "2026-03-15T08:00:00.000Z",
      },
    ],
    call_logs: [],
    deals: [],
    companies: [],
  });

describe("assignDailyCallsInMemory", () => {
  it("fills to quota with leftover + due callback + new leads", async () => {
    const dataProvider = setup();
    const result = await assignDailyCallsInMemory(dataProvider, {
      quota: 3,
      today,
    });

    expect(result).toMatchObject({
      date: today,
      skipped: false,
      // BDE: leftover 1 + callback + 1 new; manager: remaining new
      assigned: 3,
      quota: 3,
      sales_processed: 2,
    });

    const { data: assignments } = await dataProvider.getList(
      "call_assignments",
      {
        pagination: { page: 1, perPage: 20 },
        sort: { field: "id", order: "ASC" },
        filter: { status: "open" },
      },
    );
    expect(assignments).toHaveLength(4);
    const { data: bdeContacts } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 20 },
      sort: { field: "id", order: "ASC" },
      filter: { assigned_to: 1 },
    });
    expect(bdeContacts.map((contact) => contact.id).sort()).toEqual([10, 12]);
    const { data: managerContacts } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 20 },
      sort: { field: "id", order: "ASC" },
      filter: { assigned_to: 2 },
    });
    expect(managerContacts.map((contact) => contact.id)).toEqual([11]);
  });

  it("skips non-working days", async () => {
    const dataProvider = setup();
    const result = await assignDailyCallsInMemory(dataProvider, {
      today: "2026-03-15", // Sunday
    });
    expect(result.skipped).toBe(true);
    expect(result.assigned).toBe(0);
  });

  it("queues new/queued leads already assigned to the dialer", async () => {
    const dataProvider = fakeRestDataProvider({
      sales: [
        {
          id: 4,
          first_name: "Karun",
          last_name: "BDE",
          role: "bde",
          disabled: false,
          administrator: false,
          email: "karun@example.com",
          user_id: "u4",
        },
      ],
      contacts: [
        {
          id: 3,
          first_name: "Preassigned",
          last_name: "Lead",
          company_id: 1,
          lead_stage: "queued",
          assigned_to: 4,
          do_not_contact: false,
        },
      ],
      call_assignments: [],
      call_logs: [],
      deals: [
        {
          id: 3,
          company_id: 1,
          contact_ids: [3],
          archived_at: null,
        },
      ],
      companies: [],
    });

    const result = await assignDailyCallsInMemory(dataProvider, {
      quota: 25,
      today,
    });

    expect(result.assigned).toBe(1);
    const { data: open } = await dataProvider.getList("call_assignments", {
      pagination: { page: 1, perPage: 20 },
      sort: { field: "id", order: "ASC" },
      filter: { status: "open" },
    });
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      sales_id: 4,
      contact_id: 3,
      company_id: 1,
      deal_id: 3,
    });
  });
});
