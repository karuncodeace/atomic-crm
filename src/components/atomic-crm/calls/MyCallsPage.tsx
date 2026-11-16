import { useState } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { CrmDataProvider } from "../providers/types";
import type { CallAssignment, Contact, SalesRole } from "../types";
import { todayInCallTimezone } from "./callEngine";
import { CallOutcomeDialog, type OutcomeDeal } from "./CallOutcomeDialog";
import { ConnectedDate } from "../misc/ConnectedDate";
import { EmptyState, PageHeader } from "../misc/PageHeader";
import { PhoneCall } from "lucide-react";

const quotaForRole = (role?: string) => (role === "manager" ? 10 : 25);

export const MyCallsPage = () => {
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const today = todayInCallTimezone();
  const [assigning, setAssigning] = useState(false);
  const role = (identity as { role?: SalesRole } | undefined)?.role;
  const ownQueue = role === "bde" || role === "manager";
  const quota = quotaForRole(role);

  const { data: openRows = [], isPending: openPending } =
    useGetList<CallAssignment>("call_assignments", {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "assignment_date", order: "ASC" },
      filter: ownQueue
        ? { status: "open", sales_id: identity?.id }
        : { status: "open" },
    });

  const { data: doneToday = [], isPending: donePending } =
    useGetList<CallAssignment>("call_assignments", {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "done_at", order: "DESC" },
      filter: ownQueue
        ? { status: "done", assignment_date: today, sales_id: identity?.id }
        : { status: "done", assignment_date: today },
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
    <div className={cn("flex flex-col gap-3", isMobile && "px-3 pb-20")}>
      <PageHeader
        title={translate("resources.call_assignments.name", {
          smart_count: 2,
        })}
        description={translate("resources.call_assignments.progress", {
          done: doneCount,
          open: openCount,
          quota,
        })}
        actions={
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
        }
      />
      <DailyProgress done={doneCount} quota={quota} />

      {isPending ? null : openRows.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title={translate("crm.calls.empty_title", {
            _: "Your call list is empty",
          })}
          description={translate("resources.call_assignments.empty")}
        />
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
    <Card className="flex flex-col gap-4 p-4 transition-shadow hover:shadow-raised sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <span
        className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-foreground sm:flex"
        aria-hidden
      >
        <PhoneCall className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-[15px] font-semibold">
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
          {translate("crm.common.connected_at", { _: "Connected" })}:{" "}
          <ReferenceField
            source="contact_id"
            reference="contacts"
            link={false}
            empty="—"
            render={({ referenceRecord }) => (
              <ConnectedDate
                value={
                  (referenceRecord as Contact | undefined)?.last_connected_at
                }
                className="text-xs"
              />
            )}
          />
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
  const dataProvider = useDataProvider<CrmDataProvider>();

  const getDeal = async (): Promise<OutcomeDeal | null> => {
    if (!assignment.deal_id) return null;
    const dealId = assignment.deal_id;
    return dataProvider
      .getOne("deals", { id: dealId })
      .then((r) => r.data)
      .catch(() => ({
        id: dealId,
        company_id: assignment.company_id,
        categories: [],
      }));
  };

  return (
    <CallOutcomeDialog
      open={open}
      onOpenChange={onOpenChange}
      companyId={assignment.company_id}
      getDeal={getDeal}
      onSave={(input) =>
        dataProvider.recordCallOutcome({
          assignmentId: assignment.id,
          ...input,
        })
      }
    />
  );
};

/** Today's calls against the daily target, as a slim progress bar. */
const DailyProgress = ({ done, quota }: { done: number; quota: number }) => {
  const share = quota > 0 ? Math.min(Math.round((done / quota) * 100), 100) : 0;
  return (
    <div className="mb-2 flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand/70 to-brand transition-[width] duration-700 ease-out"
          style={{ width: `${share}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground tabular-nums">
        {share}%
      </span>
    </div>
  );
};
