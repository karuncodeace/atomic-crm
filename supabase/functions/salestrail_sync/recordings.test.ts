// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  copyRecording,
  RECORDING_GIVE_UP_MS,
  type PendingRecording,
  type RecordingDeps,
} from "./recordings";

const CALL_STARTED = Date.parse("2026-11-27T10:00:00Z");

const row: PendingRecording = {
  id: 7,
  salestrail_call_id: "12121212-2323-3434-4545-123412341234",
  started_at: new Date(CALL_STARTED).toISOString(),
  attempts: 2,
};

const buildDeps = (overrides: Partial<RecordingDeps> = {}): RecordingDeps => ({
  requestRecording: async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://blob.example/rec" },
    }),
  download: async () =>
    new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "audio/mp4" },
    }),
  upload: vi.fn(async () => {}),
  now: () => CALL_STARTED + 60_000,
  ...overrides,
});

describe("copyRecording", () => {
  it("stores the audio SalesTrail redirects to, named after the call", async () => {
    const deps = buildDeps();

    const update = await copyRecording(row, deps);

    expect(update).toEqual({
      status: "stored",
      storage_path: "12121212-2323-3434-4545-123412341234.m4a",
      attempts: 3,
      last_error: null,
    });
    expect(deps.upload).toHaveBeenCalledWith(
      "12121212-2323-3434-4545-123412341234.m4a",
      expect.any(ArrayBuffer),
      "audio/mp4",
    );
  });

  it("stores a recording SalesTrail serves as octet-stream as audio", async () => {
    const deps = buildDeps({
      download: async () =>
        new Response(new Uint8Array([0x49, 0x44, 0x33, 4, 0]), {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        }),
    });

    const update = await copyRecording(row, deps);

    expect(update).toMatchObject({
      status: "stored",
      storage_path: "12121212-2323-3434-4545-123412341234.mp3",
    });
    expect(deps.upload).toHaveBeenCalledWith(
      "12121212-2323-3434-4545-123412341234.mp3",
      expect.any(ArrayBuffer),
      "audio/mpeg",
    );
  });

  it("keeps waiting while the phone has not uploaded the recording yet", async () => {
    const update = await copyRecording(
      row,
      buildDeps({
        requestRecording: async () => new Response(null, { status: 404 }),
      }),
    );

    expect(update).toEqual({
      status: "pending",
      attempts: 3,
      last_error: "recording not available yet",
    });
  });

  it("gives up once the recording is still missing a day after the call", async () => {
    const update = await copyRecording(
      row,
      buildDeps({
        requestRecording: async () => new Response(null, { status: 404 }),
        now: () => CALL_STARTED + RECORDING_GIVE_UP_MS + 1,
      }),
    );

    expect(update.status).toBe("failed");
  });

  it("retries later when the download or upload fails", async () => {
    const failedDownload = await copyRecording(
      row,
      buildDeps({ download: async () => new Response(null, { status: 403 }) }),
    );
    const failedUpload = await copyRecording(
      row,
      buildDeps({
        upload: async () => {
          throw new Error("upload: bucket full");
        },
      }),
    );

    expect(failedDownload).toMatchObject({
      status: "pending",
      last_error: "download failed: 403",
    });
    expect(failedUpload).toMatchObject({
      status: "pending",
      last_error: "upload: bucket full",
    });
  });
});
