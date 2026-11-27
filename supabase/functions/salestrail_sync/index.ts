import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { parseSalestrailCalls } from "./salestrailCalls.ts";
import { copyRecording, type PendingRecording } from "./recordings.ts";

// Runs every 5 minutes (pg_cron, see the call_recordings migration):
// 1. pulls the calls SalesTrail received since the last run and stores the
//    answered ones that match a lead (other calls are never stored);
// 2. copies the recordings that are ready into the private bucket.

const API_BASE = "https://standalone-api.salestrail.io";
const BUCKET = "call-recordings";
const STATE_ID = 1;
/** Overlap with the previous window, for calls uploaded late by a phone. */
const OVERLAP_MS = 10 * 60 * 1000;
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Recordings copied per run, to stay well within the function time limit. */
const RECORDINGS_PER_RUN = 15;

const apiUser = Deno.env.get("SALESTRAIL_API_USERNAME");
const apiPassword = Deno.env.get("SALESTRAIL_API_PASSWORD");
const syncSecret = Deno.env.get("SALESTRAIL_SYNC_SECRET");

const apiAuthorization = () => `Basic ${btoa(`${apiUser}:${apiPassword}`)}`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Constant-time comparison, so the secret cannot be guessed by timing. */
const sameSecret = (given: string, expected: string) => {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
};

const syncCalls = async () => {
  const state = await supabaseAdmin
    .from("salestrail_sync_state")
    .select("synced_until")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (state.error) throw new Error(`sync state: ${state.error.message}`);

  const now = Date.now();
  const last = state.data?.synced_until
    ? Date.parse(state.data.synced_until)
    : now - FIRST_RUN_LOOKBACK_MS;
  const from = new Date(Math.max(last - OVERLAP_MS, now - MAX_WINDOW_MS));
  const to = new Date(now);

  const url = new URL(`${API_BASE}/export/calls/byCreated/json`);
  url.searchParams.set("from", from.toISOString());
  url.searchParams.set("to", to.toISOString());
  const response = await fetch(url, {
    headers: { Authorization: apiAuthorization(), Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`SalesTrail call export failed: ${response.status}`);
  }

  const parsed = parseSalestrailCalls(await response.json());
  if (parsed.malformed > 0) {
    console.warn(`SalesTrail: skipped ${parsed.malformed} malformed call(s)`);
  }

  let stored = 0;
  for (const call of parsed.calls) {
    const { data, error } = await supabaseAdmin.rpc("record_salestrail_call", {
      p_call_id: call.callId,
      p_user_email: call.userEmail,
      p_phone: call.phone,
      p_is_inbound: call.isInbound,
      p_started_at: call.startedAt,
      p_duration_seconds: call.durationSeconds,
    });
    if (error) throw new Error(`record call ${call.callId}: ${error.message}`);
    if (data != null) stored += 1;
  }

  const saved = await supabaseAdmin
    .from("salestrail_sync_state")
    .upsert({ id: STATE_ID, synced_until: to.toISOString() });
  if (saved.error) throw new Error(`save sync state: ${saved.error.message}`);

  return {
    answered: parsed.calls.length,
    stored,
    ignored: parsed.ignored,
    malformed: parsed.malformed,
  };
};

const syncRecordings = async () => {
  const pending = await supabaseAdmin
    .from("call_recordings")
    .select("id, salestrail_call_id, started_at, attempts")
    .eq("status", "pending")
    .order("started_at", { ascending: true })
    .limit(RECORDINGS_PER_RUN);
  if (pending.error) throw new Error(`pending: ${pending.error.message}`);

  const counts = { stored: 0, waiting: 0, failed: 0 };
  for (const row of (pending.data ?? []) as PendingRecording[]) {
    const update = await copyRecording(row, {
      requestRecording: (callId) =>
        fetch(
          `${API_BASE}/export/calls/${encodeURIComponent(callId)}/recording`,
          {
            headers: { Authorization: apiAuthorization() },
            redirect: "manual",
          },
        ),
      download: (url) => fetch(url),
      upload: async (path, body, contentType) => {
        const { error } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(path, body, { contentType, upsert: true });
        if (error) throw new Error(`upload: ${error.message}`);
      },
      now: Date.now,
    });
    const { error } = await supabaseAdmin
      .from("call_recordings")
      .update(update)
      .eq("id", row.id);
    if (error) throw new Error(`update recording ${row.id}: ${error.message}`);
    if (update.status === "stored") counts.stored += 1;
    else if (update.status === "failed") counts.failed += 1;
    else counts.waiting += 1;
  }
  return counts;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  if (!syncSecret || !apiUser || !apiPassword) {
    console.error("SalesTrail sync is not configured (missing secrets)");
    return json({ error: "Not configured" }, 500);
  }
  if (!sameSecret(req.headers.get("x-sync-secret") ?? "", syncSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const calls = await syncCalls();
    const recordings = await syncRecordings();
    return json({ calls, recordings });
  } catch (error) {
    console.error("SalesTrail sync failed", error);
    return json({ error: "Sync failed" }, 500);
  }
});
