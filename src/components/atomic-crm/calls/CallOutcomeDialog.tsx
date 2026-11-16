import { useState } from "react";
import {
  type Identifier,
  useDataProvider,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { CrmDataProvider } from "../providers/types";
import type { CallOutcome } from "../types";
import { CALL_OUTCOMES } from "./callEngine";
import { PackageChoices } from "../axicore/PackagePicker";
import {
  INTERESTED_STAGE,
  savePackage,
  sendPackageToAxiCore,
  type WebsitePackage,
} from "../axicore/packages";

export interface CallOutcomeInput {
  outcome: CallOutcome;
  notes: string | null;
  nextAttemptAt: string | null;
}

/** The lead's deal, used to store the website package on Interested. */
export interface OutcomeDeal {
  id: Identifier;
  company_id?: Identifier | null;
  categories?: string[] | null;
}

interface CallOutcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: Identifier | null;
  /** Resolves the lead's deal (or null when it has none). */
  getDeal: () => Promise<OutcomeDeal | null>;
  /** Records the outcome (queue call or follow-up call). */
  onSave: (input: CallOutcomeInput) => Promise<unknown>;
}

/**
 * "How did the call go?" — shared by My Calls (daily queue) and Follow-ups.
 * On Interested it asks for the website package first, so AxiCore has it
 * when the deal turns Interested.
 */
export const CallOutcomeDialog = ({
  open,
  onOpenChange,
  companyId,
  getDeal,
  onSave,
}: CallOutcomeDialogProps) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [notes, setNotes] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [pkg, setPkg] = useState<WebsitePackage | null>(null);

  const needsDate = outcome === "callback";
  const needsPackage = outcome === INTERESTED_STAGE;

  const submit = async () => {
    if (!outcome) return;
    if (needsPackage && !pkg) return;
    setSaving(true);
    try {
      if (needsPackage && pkg) {
        const deal = await getDeal();
        if (deal) {
          await savePackage(dataProvider, deal, pkg);
        } else {
          await sendPackageToAxiCore({ companyId, pkg });
        }
      }
      await onSave({
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
            {CALL_OUTCOMES.map(({ value }) => (
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
          {needsPackage && (
            <div className="space-y-1">
              <Label>Which website does the client want?</Label>
              <PackageChoices value={pkg} onChange={setPkg} />
            </div>
          )}
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
          <Button
            type="button"
            disabled={!outcome || saving || (needsPackage && !pkg)}
            onClick={submit}
          >
            {saving
              ? translate("ra.message.loading", { _: "Saving…" })
              : translate("resources.call_assignments.action.save_outcome")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
