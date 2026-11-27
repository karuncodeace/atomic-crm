import { audioContentType, recordingExtension } from "./salestrailCalls.ts";

/** A recording still missing this long after the call is given up on. */
export const RECORDING_GIVE_UP_MS = 24 * 60 * 60 * 1000;

export interface PendingRecording {
  id: number;
  salestrail_call_id: string;
  started_at: string;
  attempts: number;
}

export type RecordingUpdate =
  | {
      status: "stored";
      storage_path: string;
      attempts: number;
      last_error: null;
    }
  | { status: "pending" | "failed"; attempts: number; last_error: string };

export interface RecordingDeps {
  /** GET .../export/calls/{callId}/recording, redirects NOT followed. */
  requestRecording: (callId: string) => Promise<Response>;
  /** Download of the file URL SalesTrail redirects to. */
  download: (url: string) => Promise<Response>;
  upload: (
    path: string,
    body: ArrayBuffer,
    contentType: string,
  ) => Promise<void>;
  now: () => number;
}

const notYet = (
  row: PendingRecording,
  attempts: number,
  error: string,
  now: number,
): RecordingUpdate => ({
  status:
    now - Date.parse(row.started_at) > RECORDING_GIVE_UP_MS
      ? "failed"
      : "pending",
  attempts,
  last_error: error,
});

/**
 * One try at copying a call's recording from SalesTrail into our storage.
 * SalesTrail answers 404 until the phone has uploaded the recording, then a
 * 302 to the audio file.
 */
export const copyRecording = async (
  row: PendingRecording,
  deps: RecordingDeps,
): Promise<RecordingUpdate> => {
  const attempts = row.attempts + 1;
  try {
    const response = await deps.requestRecording(row.salestrail_call_id);
    if (response.status === 404) {
      return notYet(row, attempts, "recording not available yet", deps.now());
    }
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return notYet(
        row,
        attempts,
        `unexpected status ${response.status}`,
        deps.now(),
      );
    }

    const audio = await deps.download(location);
    if (!audio.ok) {
      return notYet(
        row,
        attempts,
        `download failed: ${audio.status}`,
        deps.now(),
      );
    }
    const body = await audio.arrayBuffer();
    const contentType = audioContentType(
      audio.headers.get("content-type"),
      new Uint8Array(body, 0, Math.min(body.byteLength, 16)),
    );
    const path = `${row.salestrail_call_id}.${recordingExtension(contentType)}`;
    await deps.upload(path, body, contentType);
    return { status: "stored", storage_path: path, attempts, last_error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return notYet(row, attempts, message, deps.now());
  }
};
