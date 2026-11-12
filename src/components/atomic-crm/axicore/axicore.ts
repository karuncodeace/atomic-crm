/*
 * AxiCore 2.0: Codeace's three tools (SWOT pitch, brochure, proposal) inside the CRM.
 * The tools run in the AxiFlow engine (https://axiflow-v1.vercel.app). vercel.json rewrites these paths to it,
 * so they share this app's address and its login:
 *   /api/*          engine API (the CRM user's Supabase token goes as Authorization: Bearer)
 *   /axicore-app/   the tools screens, as their own full page
 *   /pdf/*          document PDFs
 * Who may open AxiCore 2.0: the roles in VITE_AXICORE_ROLES (default "admin,manager"); the engine checks the same list
 * (AXICORE_ROLES) on every call, so hiding the menu is not the only guard.
 */
import { getSupabaseClient } from "../providers/supabase/supabase";

export const AXICORE_ROLES: string[] = String(
  import.meta.env.VITE_AXICORE_ROLES || "admin,manager",
)
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

/** The tools app: its own full page (the sidebar item and the /axicore/* links go there). */
export const AXICORE_APP = "/axicore-app/";

export const canUseAxiCore = (role?: string | null) =>
  !!role && AXICORE_ROLES.includes(role);

/** fetch() to the engine with the CRM login (none in the demo build, where the local engine trusts this machine). */
export async function engineFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (import.meta.env.VITE_IS_DEMO !== "true") {
    try {
      const { data } = await getSupabaseClient().auth.getSession();
      const token = data?.session?.access_token;
      if (token) headers.set("authorization", `Bearer ${token}`);
    } catch {
      // no Supabase client: the engine answers 401
    }
  }
  const res = await fetch(path, { ...init, headers });
  const body = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : null;
  if (!res.ok) throw new Error(body?.error || `AxiCore answered ${res.status}`);
  return body;
}
