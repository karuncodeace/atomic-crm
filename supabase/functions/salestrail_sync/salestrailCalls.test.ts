// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseSalestrailCalls, recordingExtension } from "./salestrailCalls";

const answeredCall = {
  userId: "11111111-user-id22-3333-444444444444",
  userName: "Test Man",
  userEmail: "Test.Man@Mail.com",
  callId: "12121212-2323-3434-4545-123412341234",
  source: "android",
  startTime: "2026-11-27T10:05:37Z",
  duration: 300,
  answered: true,
  inbound: false,
  number: "09876543210",
  formattedNumber: "+919876543210",
  createdAt: "2026-11-27T10:08:16.316843Z",
};

describe("parseSalestrailCalls", () => {
  it("keeps an answered call with its lead number, BDE email and duration", () => {
    const { calls } = parseSalestrailCalls([answeredCall]);

    expect(calls).toEqual([
      {
        callId: "12121212-2323-3434-4545-123412341234",
        userEmail: "test.man@mail.com",
        phone: "+919876543210",
        isInbound: false,
        startedAt: "2026-11-27T10:05:37.000Z",
        durationSeconds: 300,
      },
    ]);
  });

  it("ignores unanswered and zero-length calls, which have no recording", () => {
    const result = parseSalestrailCalls([
      { ...answeredCall, callId: "a", answered: false },
      { ...answeredCall, callId: "b", duration: 0 },
    ]);

    expect(result.calls).toEqual([]);
    expect(result.ignored).toBe(2);
  });

  it("counts entries without a call id, number or valid start time as malformed", () => {
    const result = parseSalestrailCalls([
      { ...answeredCall, callId: undefined },
      { ...answeredCall, number: "", formattedNumber: null },
      { ...answeredCall, startTime: "yesterday-ish" },
      "not a call",
    ]);

    expect(result.calls).toEqual([]);
    expect(result.malformed).toBe(4);
  });

  it("reads the calls from a wrapped list and falls back to the raw number", () => {
    const { calls } = parseSalestrailCalls({
      data: [{ ...answeredCall, formattedNumber: undefined }],
    });

    expect(calls.map((call) => call.phone)).toEqual(["09876543210"]);
  });

  it("returns nothing for a response that is not a list of calls", () => {
    expect(parseSalestrailCalls({ error: "nope" }).calls).toEqual([]);
    expect(parseSalestrailCalls(null).calls).toEqual([]);
  });
});

describe("recordingExtension", () => {
  it("maps the audio content type to a file extension, mp3 by default", () => {
    expect(recordingExtension("audio/mp4")).toBe("m4a");
    expect(recordingExtension("audio/mpeg; charset=binary")).toBe("mp3");
    expect(recordingExtension(null)).toBe("mp3");
  });
});
