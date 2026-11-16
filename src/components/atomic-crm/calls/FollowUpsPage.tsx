import { useState } from "react";
import {
  type Identifier,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";
import { Phone } from "lucide-react";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { CrmDataProvider } from "../providers/types";
import type { Contact, Deal, Sale, SalesRole } from "../types";
import { CallOutcomeDialog, type OutcomeDeal } from "./CallOutcomeDialog";
import { todayInCallTimezone } from "./callEngine";

type FollowUpTab = "callback" | "not_answered";

const FOLLOW_UP_TABS: FollowUpTab[] = ["callback", "not_answered"];
const PAGE_SIZE = 200;

/**
 * Callback and Not answered leads. They are not part of the daily call
 * queue (which holds New leads only): they are worked from here, and a call
 * logged here records the outcome exactly like a queue call.
 */
export const FollowUpsPage = () => {
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const [tab, setTab] = useState<FollowUpTab>("callback");
  const role = (identity as { role?: SalesRole } | undefined)?.role;

  const callbacks = useFollowUps("callback");
  const notAnswered = useFollowUps("not_answered");
  const current = tab === "callback" ? callbacks : notAnswered;

  if (!identity) return null;

  return (
    <div className={cn("flex flex-col gap-4", isMobile && "px-3 pb-20")}>
      <div>
        <h1 className="text-xl font-semibold">
          {translate("crm.followups.title", { _: "Follow-ups" })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("crm.followups.subtitle", {
            _: "Leads to call again. They are not part of the daily call list.",
          })}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as FollowUpTab)}>
        <TabsList>
          {FOLLOW_UP_TABS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {translate(`crm.followups.tabs.${value}`, {
                _: value === "callback" ? "Callback" : "Not connected",
              })}
              <Badge variant="secondary" className="ml-2 rounded-full px-2">
                {(value === "callback" ? callbacks : notAnswered).total}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {current.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : current.error ? (
        <Card className="p-8 text-center text-sm text-destructive">
          {translate("crm.followups.error", {
            _: "Could not load follow-ups.",
          })}
        </Card>
      ) : current.data.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {translate(`crm.followups.empty.${tab}`, {
            _: "Nothing to follow up here.",
          })}
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {current.data.map((contact) => (
            <li key={contact.id}>
              <FollowUpCard contact={contact} showOwner={role === "admin"} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const useFollowUps = (status: FollowUpTab) => {
  const { data, total, isPending, error } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: PAGE_SIZE },
    sort: { field: "next_attempt_at", order: "ASC" },
    filter: { status, "lead_stage@not.is": null },
  });
  return { data: data ?? [], total: total ?? 0, isPending, error };
};

const FollowUpCard = ({
  contact,
  showOwner,
}: {
  contact: Contact;
  showOwner: boolean;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [open, setOpen] = useState(false);

  const name =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—";
  const phone = contact.phone_e164 || contact.whatsapp_number || "";

  const getDeal = async (): Promise<OutcomeDeal | null> => {
    const { data } = await dataProvider.getList<Deal>("deals", {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
      filter: {
        "contact_ids@cs": `{${contact.id}}`,
        "archived_at@is": null,
      },
    });
    return data[0] ?? null;
  };

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/contacts/${contact.id}/show`}
            className="font-medium hover:underline"
          >
            {contact.company_name || name}
          </Link>
          <DueBadge nextAttemptAt={contact.next_attempt_at} />
        </div>
        <p className="text-sm text-muted-foreground">
          {contact.company_name ? `${name}` : null}
          {phone ? (
            <>
              {contact.company_name ? " · " : null}
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Phone className="size-3" />
                {phone}
              </a>
            </>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {translate("crm.followups.attempts", {
            _: "Attempts: %{count}",
            count: contact.retry_count ?? 0,
          })}
          {contact.last_attempt_at ? (
            <>
              {" · "}
              {translate("crm.followups.last_called", {
                _: "Last called %{date}",
                date: formatDay(contact.last_attempt_at),
              })}
            </>
          ) : null}
          {showOwner ? (
            <>
              {" · "}
              <OwnerName salesId={contact.assigned_to} />
            </>
          ) : null}
        </p>
      </div>
      <Button type="button" onClick={() => setOpen(true)}>
        {translate("crm.followups.log_call", { _: "Log call" })}
      </Button>
      <CallOutcomeDialog
        open={open}
        onOpenChange={setOpen}
        companyId={contact.company_id}
        getDeal={getDeal}
        onSave={(input) =>
          dataProvider.recordFollowupOutcome({
            contactId: contact.id,
            ...input,
          })
        }
      />
    </Card>
  );
};

/** "Overdue" / "Due today" / "Due 18 Nov" from the next attempt date. */
const DueBadge = ({ nextAttemptAt }: { nextAttemptAt?: string | null }) => {
  const translate = useTranslate();
  if (!nextAttemptAt) {
    return (
      <Badge variant="outline">
        {translate("crm.followups.due_now", { _: "Due now" })}
      </Badge>
    );
  }
  const due = todayInCallTimezone(new Date(nextAttemptAt));
  const today = todayInCallTimezone();
  if (due < today) {
    return (
      <Badge variant="destructive">
        {translate("crm.followups.overdue", { _: "Overdue" })}
      </Badge>
    );
  }
  if (due === today) {
    return (
      <Badge>{translate("crm.followups.due_today", { _: "Due today" })}</Badge>
    );
  }
  return (
    <Badge variant="outline">
      {translate("crm.followups.due_on", {
        _: "Due %{date}",
        date: formatDay(nextAttemptAt),
      })}
    </Badge>
  );
};

const OwnerName = ({ salesId }: { salesId?: Identifier | null }) => {
  const translate = useTranslate();
  if (salesId == null) {
    return <>{translate("crm.common.not_assigned", { _: "Not assigned" })}</>;
  }
  return (
    <ReferenceField<{ id: Identifier; assigned_to: Identifier }, Sale>
      record={{ id: salesId, assigned_to: salesId }}
      source="assigned_to"
      reference="sales"
      link={false}
      render={({ referenceRecord }) =>
        referenceRecord
          ? `${referenceRecord.first_name} ${referenceRecord.last_name}`
          : null
      }
    />
  );
};

const formatDay = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

FollowUpsPage.path = "/follow-ups";
