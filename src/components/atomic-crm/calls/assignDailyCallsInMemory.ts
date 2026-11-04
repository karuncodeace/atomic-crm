import type { DataProvider, Identifier } from "ra-core";

import type {
  AssignDailyCallsResult,
  CallAssignment,
  Contact,
  Deal,
  Sale,
} from "../types";
import { planDailySlots, todayInCallTimezone } from "./callEngine";

const ALL = { page: 1, perPage: 100_000 };
const DEFAULT_QUOTA = 25;

/**
 * FakeRest twin of `assign_daily_calls()`: hard-cap quota, leftovers first,
 * then due callbacks, then new leads from the unassigned pool.
 */
export const assignDailyCallsInMemory = async (
  dataProvider: DataProvider,
  options?: { quota?: number; today?: string },
): Promise<AssignDailyCallsResult> => {
  const quota = options?.quota ?? DEFAULT_QUOTA;
  const today = options?.today ?? todayInCallTimezone();
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 Sun
  const isoDow = dow === 0 ? 7 : dow;
  if (isoDow > 5) {
    return {
      date: today,
      skipped: true,
      reason: "non_working_day",
      assigned: 0,
    };
  }

  const [
    { data: sales },
    { data: contacts },
    { data: assignments },
    { data: deals },
  ] = await Promise.all([
    dataProvider.getList<Sale>("sales", {
      pagination: ALL,
      sort: { field: "id", order: "ASC" },
      filter: {},
    }),
    dataProvider.getList<Contact>("contacts", {
      pagination: ALL,
      sort: { field: "id", order: "ASC" },
      filter: {},
    }),
    dataProvider.getList<CallAssignment>("call_assignments", {
      pagination: ALL,
      sort: { field: "id", order: "ASC" },
      filter: {},
    }),
    dataProvider.getList<Deal>("deals", {
      pagination: ALL,
      sort: { field: "id", order: "ASC" },
      filter: {},
    }),
  ]);

  const dialers = sales.filter(
    (sale) =>
      !sale.disabled && (sale.role === "bde" || sale.role === "manager"),
  );
  let assigned = 0;
  const openBySales = new Map<string, CallAssignment[]>();
  for (const row of assignments) {
    if (row.status !== "open") continue;
    const key = String(row.sales_id);
    const list = openBySales.get(key) ?? [];
    list.push(row);
    openBySales.set(key, list);
  }

  const dealForContact = (contact: Contact) =>
    deals.find(
      (deal) =>
        !deal.archived_at &&
        deal.company_id === contact.company_id &&
        (deal.contact_ids ?? []).map(String).includes(String(contact.id)),
    );

  for (const sale of dialers) {
    const open = openBySales.get(String(sale.id)) ?? [];
    const openContactIds = new Set(open.map((row) => String(row.contact_id)));

    const dueCallbacks = contacts.filter(
      (contact) =>
        String(contact.assigned_to) === String(sale.id) &&
        !contact.do_not_contact &&
        contact.lead_stage &&
        !["interested", "not_interested", "recycled"].includes(
          contact.lead_stage,
        ) &&
        (contact.last_outcome === "callback" ||
          contact.last_outcome === "no_answer") &&
        (!contact.next_attempt_at ||
          contact.next_attempt_at.slice(0, 10) <= today) &&
        !openContactIds.has(String(contact.id)),
    );

    const newLeads = contacts
      .filter(
        (contact) =>
          (contact.assigned_to == null ||
            String(contact.assigned_to) === String(sale.id)) &&
          !contact.do_not_contact &&
          (contact.lead_stage === "new" || contact.lead_stage === "queued") &&
          !assignments.some(
            (row) =>
              row.status === "open" &&
              String(row.contact_id) === String(contact.id),
          ) &&
          !openContactIds.has(String(contact.id)),
      )
      .sort((left, right) => {
        const leftOwned = String(left.assigned_to) === String(sale.id) ? 0 : 1;
        const rightOwned =
          String(right.assigned_to) === String(sale.id) ? 0 : 1;
        return leftOwned - rightOwned;
      });

    const plan = planDailySlots({
      quota,
      openLeftover: open.length,
      dueCallbacks: dueCallbacks.length,
      newLeads: newLeads.length,
    });

    const toAssign: Contact[] = [
      ...dueCallbacks.slice(0, plan.callbacks),
      ...newLeads.slice(0, plan.news),
    ];

    for (const contact of toAssign) {
      if (
        contact.assigned_to == null ||
        String(contact.assigned_to) !== String(sale.id)
      ) {
        await dataProvider.update<Contact>("contacts", {
          id: contact.id,
          data: {
            assigned_to: sale.id,
            assigned_at: new Date().toISOString(),
            lead_stage:
              contact.lead_stage === "new" ? "queued" : contact.lead_stage,
          },
          previousData: contact,
        });
        contact.assigned_to = sale.id;
      } else if (contact.lead_stage === "new") {
        await dataProvider.update<Contact>("contacts", {
          id: contact.id,
          data: { lead_stage: "queued" },
          previousData: contact,
        });
        contact.lead_stage = "queued";
      }
      const deal = dealForContact(contact);
      await dataProvider.create<CallAssignment>("call_assignments", {
        data: {
          assignment_date: today,
          sales_id: sale.id as Identifier,
          contact_id: contact.id,
          company_id: contact.company_id ?? null,
          deal_id: deal?.id ?? null,
          status: "open",
          created_at: new Date().toISOString(),
        },
      });
      assigned += 1;
      openContactIds.add(String(contact.id));
    }
  }

  return {
    date: today,
    skipped: false,
    sales_processed: dialers.length,
    assigned,
    quota,
  };
};
