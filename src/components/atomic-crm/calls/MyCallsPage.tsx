import { useMemo, useState } from "react";
import {
  RecordContextProvider,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRecordContext,
  useRefresh,
  useTranslate,
} from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { CrmDataProvider } from "../providers/types";
import type { CallAssignment, CallOutcome, Contact } from "../types";
import { CALL_OUTCOMES, todayInCallTimezone } from "./callEngine";

const QUOTA = 25;

export const MyCallsPage = () => {
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const today = todayInCallTimezone();
  const [assigning, setAssigning] = useState(false);

  const { data: openRows = [], isPending: openPending } =
    useGetList<CallAssignment>("call_assignments", {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "assignment_date", order: "ASC" },
      filter: { status: "open" },
    });

  const { data: doneToday = [], isPending: donePending } =
    useGetList<CallAssignment>("call_assignments", {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "done_at", order: "DESC" },
      filter: { status: "done", assignment_date: today },
    });

  const isPending = openPending || donePending;
  const doneCount = doneToday.length;
  const openCount = openRows.length;

  const handleAssign = async () => {
    if (!dataProvider.assignDailyCalls) return;
    setAssigning(true);
    try {
      const result = await dataProvider.assignDailyCalls();
      refresh();
      if (result.skipped) {
        notify("resources.call_assignments.assign_skipped", { type: "info" });
      } else {
        notify("resources.call_assignments.assign_done", {
          type: "success",
          messageArgs: { assigned: result.assigned },
        });
      }
    } catch (error) {
      console.error(error);
      notify(
        error instanceof Error
          ? error.message
          : "resources.call_assignments.assign_error",
        { type: "error" },
      );
    } finally {
      setAssigning(false);
    }
  };

  if (!identity) return null;

  return (
    <div className={cn("flex flex-col gap-4", isMobile && "px-3 pb-20")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {translate("resources.call_assignments.name", { smart_count: 2 })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {translate("resources.call_assignments.progress", {
              done: doneCount,
              open: openCount,
              quota: QUOTA,
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={assigning}
          onClick={handleAssign}
        >
          {assigning
            ? translate("resources.call_assignments.assigning")
            : translate("resources.call_assignments.assign_today")}
        </Button>
      </div>

      {isPending ? null : openRows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {translate("resources.call_assignments.empty")}
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {openRows.map((row) => (
            <li key={row.id}>
              <RecordContextProvider value={row}>
                <CallAssignmentCard />
              </RecordContextProvider>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const CallAssignmentCard = () => {
  const record = useRecordContext<CallAssignment>();
  const translate = useTranslate();
  const [open, setOpen] = useState(false);

  if (!record) return null;

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-medium">
          <ReferenceField
            source="company_id"
            reference="companies"
            link="show"
            empty="—"
          >
            <TextField source="name" />
          </ReferenceField>
        </div>
        <div className="text-sm text-muted-foreground">
          <ReferenceField
            source="contact_id"
            reference="contacts"
            link={false}
            empty="—"
          >
            <ContactSummary />
          </ReferenceField>
        </div>
        <p className="text-xs text-muted-foreground">
          {translate("resources.call_assignments.fields.assignment_date")}:{" "}
          {record.assignment_date}
        </p>
      </div>
      <Button type="button" onClick={() => setOpen(true)}>
        {translate("resources.call_assignments.action.complete")}
      </Button>
      <CompleteCallDialog
        assignment={record}
        open={open}
        onOpenChange={setOpen}
      />
    </Card>
  );
};

const ContactSummary = () => {
  const contact = useRecordContext<Contact>();
  if (!contact) return null;
  const name = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ");
  const phone = contact.phone_e164 || contact.whatsapp_number || "";
  return (
    <span>
      {name || "—"}
      {phone ? ` · ${phone}` : ""}
    </span>
  );
};

const CompleteCallDialog = ({
  assignment,
  open,
  onOpenChange,
}: {
  assignment: CallAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [notes, setNotes] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [saving, setSaving] = useState(false);

  const needsDate = outcome === "callback";

  const submit = async () => {
    if (!outcome || !dataProvider.recordCallOutcome) return;
    setSaving(true);
    try {
      await dataProvider.recordCallOutcome({
        assignmentId: assignment.id,
        outcome,
        notes: notes.trim() || null,
        nextAttemptAt:
          needsDate && callbackAt
            ? new Date(`${callbackAt}T10:00:00+05:30`).toISOString()
            : null,
      });
      refresh();
      onOpenChange(false);
      notify(`resources.call_assignments.outcome.${outcome}`, {
        type: "info",
      });
    } catch (error) {
      console.error(error);
      notify(
        error instanceof Error ? error.message : "ra.notification.http_error",
        { type: "error" },
      );
    } finally {
      setSaving(false);
    }
  };

  const outcomeChoices = useMemo(() => CALL_OUTCOMES, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate("resources.call_assignments.complete_title")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {outcomeChoices.map(({ value }) => (
              <Button
                key={value}
                type="button"
                variant={outcome === value ? "default" : "outline"}
                onClick={() => setOutcome(value)}
              >
                {translate(`resources.call_assignments.outcome.${value}`)}
              </Button>
            ))}
          </div>
          {needsDate && (
            <div className="space-y-1">
              <Label htmlFor="callback-at">
                {translate("resources.call_assignments.fields.next_attempt_at")}
              </Label>
              <input
                id="callback-at"
                type="date"
                value={callbackAt}
                onChange={(event) => setCallbackAt(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="call-notes">
              {translate("resources.call_assignments.fields.notes")}
            </Label>
            <Textarea
              id="call-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {translate("ra.action.cancel")}
          </Button>
          <Button type="button" disabled={!outcome || saving} onClick={submit}>
            {saving
              ? translate("ra.message.loading", { _: "Saving…" })
              : translate("resources.call_assignments.action.save_outcome")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
