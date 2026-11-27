/**
 * Parsing of the SalesTrail Pull API call export
 * (GET /export/calls/byCreated/json). The field names follow SalesTrail's
 * documented call payload (callId, userEmail, number, inbound, answered,
 * duration, startTime). Anything malformed is skipped, never trusted.
 */

export interface SalestrailCall {
  callId: string;
  userEmail: string | null;
  phone: string;
  isInbound: boolean;
  startedAt: string;
  durationSeconds: number;
}

export interface ParsedCalls {
  /** Answered calls with a duration: the only ones that can have a recording. */
  calls: SalestrailCall[];
  /** Unanswered or zero-length calls, ignored on purpose. */
  ignored: number;
  /** Entries that did not look like a call at all. */
  malformed: number;
}

const LIST_KEYS = ["calls", "data", "items", "content", "results"];

const asList = (json: unknown): unknown[] => {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    for (const key of LIST_KEYS) {
      const value = (json as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const parseOne = (item: unknown): SalestrailCall | "ignored" | null => {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;

  const callId = text(raw.callId) ?? text(raw.id);
  const phone = text(raw.formattedNumber) ?? text(raw.number);
  const startTime = text(raw.startTime);
  if (!callId || !phone || !startTime || Number.isNaN(Date.parse(startTime))) {
    return null;
  }

  const duration = Number(raw.duration);
  if (raw.answered !== true || !Number.isFinite(duration) || duration <= 0) {
    return "ignored";
  }

  return {
    callId,
    userEmail: text(raw.userEmail)?.toLowerCase() ?? null,
    phone,
    isInbound: raw.inbound === true,
    startedAt: new Date(startTime).toISOString(),
    durationSeconds: Math.round(duration),
  };
};

export const parseSalestrailCalls = (json: unknown): ParsedCalls => {
  const result: ParsedCalls = { calls: [], ignored: 0, malformed: 0 };
  for (const item of asList(json)) {
    const call = parseOne(item);
    if (call === null) result.malformed += 1;
    else if (call === "ignored") result.ignored += 1;
    else result.calls.push(call);
  }
  return result;
};

const EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/amr": "amr",
  "audio/3gpp": "3gp",
};

/** File extension for a recording, from its content type (mp3 by default). */
export const recordingExtension = (contentType: string | null): string =>
  EXTENSIONS[(contentType ?? "").split(";")[0].trim().toLowerCase()] ?? "mp3";

const startsWith = (bytes: Uint8Array, signature: string, offset = 0) =>
  [...signature].every(
    (char, index) => bytes[offset + index] === char.charCodeAt(0),
  );

/**
 * The audio type of a recording. SalesTrail's file storage serves recordings
 * as application/octet-stream, which the bucket refuses, so the type is read
 * from the file's first bytes when the header is not an audio type.
 */
export const audioContentType = (
  headerType: string | null,
  bytes: Uint8Array,
): string => {
  const declared = (headerType ?? "").split(";")[0].trim().toLowerCase();
  if (declared.startsWith("audio/")) return declared;

  if (startsWith(bytes, "ftyp", 4)) {
    return startsWith(bytes, "3gp", 8) ? "audio/3gpp" : "audio/mp4";
  }
  if (startsWith(bytes, "RIFF") && startsWith(bytes, "WAVE", 8)) {
    return "audio/wav";
  }
  if (startsWith(bytes, "OggS")) return "audio/ogg";
  if (startsWith(bytes, "#!AMR")) return "audio/amr";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf) {
    return "audio/webm";
  }
  // ADTS AAC: 0xFFF1 / 0xFFF9 (checked before the wider MP3 frame sync)
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return "audio/aac";
  // ID3 tag, or an MP3 frame sync, and the fallback
  return "audio/mpeg";
};
