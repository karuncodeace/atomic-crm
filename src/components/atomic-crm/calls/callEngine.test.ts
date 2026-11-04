import { describe, expect, it } from "vitest";

import { planDailySlots, todayInCallTimezone } from "./callEngine";

describe("planDailySlots", () => {
  it("keeps a hard cap of 25 with leftovers first", () => {
    expect(
      planDailySlots({
        quota: 25,
        openLeftover: 5,
        dueCallbacks: 10,
        newLeads: 100,
      }),
    ).toEqual({
      leftover: 5,
      callbacks: 10,
      news: 10,
      total: 25,
      slotsLeft: 0,
    });
  });

  it("does not exceed leftovers beyond the quota", () => {
    expect(
      planDailySlots({
        quota: 25,
        openLeftover: 40,
        dueCallbacks: 10,
        newLeads: 10,
      }),
    ).toEqual({
      leftover: 25,
      callbacks: 0,
      news: 0,
      total: 25,
      slotsLeft: 0,
    });
  });

  it("fills only what is available under the cap", () => {
    expect(
      planDailySlots({
        quota: 25,
        openLeftover: 2,
        dueCallbacks: 3,
        newLeads: 4,
      }),
    ).toEqual({
      leftover: 2,
      callbacks: 3,
      news: 4,
      total: 9,
      slotsLeft: 16,
    });
  });
});

describe("todayInCallTimezone", () => {
  it("formats a fixed instant in Asia/Kolkata", () => {
    // 2026-03-15 22:30 UTC → 2026-03-16 04:00 IST
    expect(todayInCallTimezone(new Date("2026-03-15T22:30:00.000Z"))).toBe(
      "2026-03-16",
    );
  });
});
