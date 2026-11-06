import { describe, expect, it } from "vitest";

import { canAccess, resolveRole } from "./canAccess";

describe("canAccess", () => {
  it("lets every active role reach the shared resources", () => {
    for (const role of ["admin", "manager", "bde"] as const) {
      for (const resource of [
        "sales",
        "configuration",
        "lead_import",
        "call_assignments",
        "contacts",
        "deals",
      ]) {
        expect(canAccess(role, { action: "list", resource })).toBe(true);
      }
    }
  });

  it("hides brochures from BDEs only", () => {
    expect(canAccess("bde", { action: "list", resource: "brochures" })).toBe(
      false,
    );
    expect(
      canAccess("manager", { action: "list", resource: "brochures" }),
    ).toBe(true);
    expect(canAccess("admin", { action: "list", resource: "brochures" })).toBe(
      true,
    );
  });
});

describe("resolveRole", () => {
  it("uses the stored role when it is valid", () => {
    expect(resolveRole({ role: "bde", administrator: false })).toBe("bde");
  });

  it("maps legacy records from the administrator flag", () => {
    expect(resolveRole({ administrator: true })).toBe("admin");
    expect(resolveRole({ administrator: false })).toBe("manager");
    expect(resolveRole({ role: "owner", administrator: false })).toBe(
      "manager",
    );
  });
});
