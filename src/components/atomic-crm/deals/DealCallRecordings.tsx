import { useQuery } from "@tanstack/react-query";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import {
  RecordContextProvider,
  useGetList,
  useTranslate,
  type Identifier,
} from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Card, CardContent } from "@/components/ui/card";

import { ShortDate } from "../misc/ShortDate";
import { getSupabaseClient } from "../providers/supabase/supabase";
import type { CallRecording } from "../types";

const BUCKET = "call-recordings";
/** Signed audio links live one hour; they are refetched before expiring. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * The SalesTrail recordings of the calls made to this lead, newest first.
 * Renders nothing when the lead has none.
 */
export const DealCallRecordings = ({ dealId }: { dealId: Identifier }) => {
  const translate = useTranslate();
  const { data } = useGetList<CallRecording>("call_recordings", {
    filter: { deal_id: dealId },
    sort: { field: "started_at", order: "DESC" },
    pagination: { page: 1, perPage: 50 },
  });
  if (!data?.length) return null;

  return (
    <Card>
      <CardContent>
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium border-b pb-1">
            {translate("resources.call_recordings.name", {
              smart_count: 2,
              _: "Call recordings",
            })}
          </h2>
          <ul className="flex flex-col divide-y">
            {data.map((recording) => (
              <RecordContextProvider key={recording.id} value={recording}>
                <CallRecordingRow recording={recording} />
              </RecordContextProvider>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
};

const CallRecordingRow = ({ recording }: { recording: CallRecording }) => {
  const translate = useTranslate();
  const Direction = recording.is_inbound ? PhoneIncoming : PhoneOutgoing;
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Direction
          className="size-4 text-muted-foreground"
          aria-label={translate(
            recording.is_inbound
              ? "resources.call_recordings.inbound"
              : "resources.call_recordings.outbound",
          )}
        />
        <ShortDate value={recording.started_at} />
        <span className="text-muted-foreground">
          {formatDuration(recording.duration_seconds)}
        </span>
        {recording.sales_id != null && (
          <ReferenceField source="sales_id" reference="sales" link={false}>
            <span className="text-muted-foreground">
              <TextField source="first_name" /> <TextField source="last_name" />
            </span>
          </ReferenceField>
        )}
      </div>
      <RecordingAudio recording={recording} />
    </li>
  );
};

const RecordingAudio = ({ recording }: { recording: CallRecording }) => {
  const translate = useTranslate();
  const path = recording.status === "stored" ? recording.storage_path : null;
  const { data: url, isError } = useQuery({
    queryKey: ["call_recording_url", path],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .storage.from(BUCKET)
        .createSignedUrl(path as string, SIGNED_URL_TTL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: (SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000,
  });

  if (recording.status === "pending") {
    return (
      <p className="text-xs text-muted-foreground italic">
        {translate("resources.call_recordings.pending")}
      </p>
    );
  }
  if (recording.status === "failed" || isError) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {translate("resources.call_recordings.unavailable")}
      </p>
    );
  }
  if (!url) return null;
  return (
    <audio controls preload="none" src={url} className="h-9 w-full max-w-md">
      <track kind="captions" />
    </audio>
  );
};

/** "4:05" for 245 seconds. */
const formatDuration = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
};
