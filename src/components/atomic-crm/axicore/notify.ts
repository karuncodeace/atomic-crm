import type { DataProvider } from "ra-core";

import { engineFetch } from "./axicore";

/**
 * Tells AxiCore "something was just saved" after every save that matters to it (a new lead, a deal stage, a call
 * result, a brochure or proposal approval), so AxiCore reads the CRM within seconds instead of at its next check.
 * Saves close together (an import, a company and its deal) send one message. It never slows or blocks a save:
 * the message is sent after the save has finished, and a failure is only logged (AxiCore also checks every 5 minutes).
 */
const WATCHED = new Set([
  "companies",
  "contacts",
  "deals",
  "brochures",
  "proposal",
  "call_logs",
  "call_assignments",
]);
const WRITES = ["create", "update", "updateMany", "delete", "deleteMany"];
// custom CRM methods that change leads, deals or calls
const CUSTOM = [
  "importLeads",
  "recordCallOutcome",
  "unarchiveDeal",
  "mergeContacts",
];

let timer: ReturnType<typeof setTimeout> | null = null;
const reasons = new Set<string>();

export function tellAxiCore(reason: string) {
  if (import.meta.env.VITE_IS_DEMO === "true") return;
  reasons.add(reason);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const reason = [...reasons].join(", ").slice(0, 80);
    reasons.clear();
    engineFetch("/api/axicore/changed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
      keepalive: true,
    }).catch((error) =>
      console.warn("AxiCore was not told about a change", error),
    );
  }, 800);
}

/** Wraps the data provider so the saves listed above also tell AxiCore. Reads are unchanged. */
export function withAxiCoreNotify<T extends DataProvider>(provider: T): T {
  const wrapped: Record<string, unknown> = { ...provider };
  for (const name of WRITES) {
    const original = (provider as Record<string, any>)[name];
    if (typeof original !== "function") continue;
    wrapped[name] = async (resource: string, params: unknown) => {
      const result = await original.call(provider, resource, params);
      if (WATCHED.has(resource)) tellAxiCore(`${name} ${resource}`);
      return result;
    };
  }
  for (const name of CUSTOM) {
    const original = (provider as Record<string, any>)[name];
    if (typeof original !== "function") continue;
    wrapped[name] = async (...args: unknown[]) => {
      const result = await original.apply(provider, args);
      tellAxiCore(name);
      return result;
    };
  }
  return wrapped as T;
}
