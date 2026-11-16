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
              quota,
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
