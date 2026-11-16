import type { ReactNode } from "react";
import { useGetList, useGetMany, useTranslate, type Identifier } from "ra-core";
import { Link } from "react-router";
import { ArrowUpRight, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { Contact, Sale } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { DashboardEmpty } from "./DashboardCard";
import { PersonAvatar } from "./PersonAvatar";
import type { ScheduleDay } from "./SchedulePanel";

type Tone = "open" | "done" | "late";

const TONE_CLASSES: Record<Tone, string> = {
  open: "bg-brand-soft text-foreground ring-brand/50",
  done: "bg-success/10 text-success ring-success/20",
  late: "bg-destructive/10 text-destructive ring-destructive/20",
};

const timeOf = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

/** One schedule item: title, related lead, note, time, channel, owner, status, action. */
const ActivityCard = ({
  title,
  related,
  description,
  time,
  channel,
  owner,
  status,
  tone,
  to,
}: {
  title: string;
  related?: string;
  description?: string;
  time?: string | null;
  channel: string;
  owner?: Sale;
  status: string;
  tone: Tone;
  to: string;
}) => (
  <article className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-brand/70">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="truncate text-[13px] font-semibold text-foreground">
          {title}
        </h3>
        {related ? (
          <p className="truncate text-xs text-muted-foreground">{related}</p>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
          TONE_CLASSES[tone],
        )}
      >
        {status}
      </span>
    </div>
    {description ? (
      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
        {description}
      </p>
    ) : null}
    <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
      {time ? (
        <span className="font-medium text-foreground tabular-nums">{time}</span>
      ) : null}
      <span className="inline-flex items-center gap-1">
        <Phone className="size-3" aria-hidden />
        {channel}
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        {owner ? (
          <PersonAvatar
            firstName={owner.first_name}
            lastName={owner.last_name}
            avatar={owner.avatar}
            className="size-6"
          />
        ) : null}
        <Link
          to={to}
          aria-label={title}
          className="flex size-6 items-center justify-center rounded-full bg-secondary text-foreground transition-colors group-hover:bg-brand"
        >
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </span>
    </div>
  </article>
);

const ListState = ({
  isPending,
  error,
  count,
  empty,
  children,
}: {
  isPending: boolean;
  error: unknown;
  count: number;
  empty: string;
  children: ReactNode;
}) => {
  const translate = useTranslate();
  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-lg" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <DashboardEmpty>
        {translate("crm.dashboard.home.load_error", {
          _: "Could not load this list. Try refreshing.",
        })}
      </DashboardEmpty>
    );
  }
  if (count === 0) return <DashboardEmpty>{empty}</DashboardEmpty>;
  return <div className="flex flex-col gap-2">{children}</div>;
};

const uniqueIds = (ids: (Identifier | null | undefined)[]) => [
  ...new Set(ids.filter((id): id is Identifier => id != null)),
];

/** Contacts (with company name) and sales users referenced by a list. */
const useRelated = (
  contactIds: (Identifier | null | undefined)[],
  salesIds: (Identifier | null | undefined)[],
) => {
  const contactKeys = uniqueIds(contactIds);
  const salesKeys = uniqueIds(salesIds);
  const { data: contacts } = useGetMany<Contact>(
    "contacts_summary",
    { ids: contactKeys },
    { enabled: contactKeys.length > 0 },
  );
  const { data: sales } = useGetMany<Sale>(
    "sales",
    { ids: salesKeys },
    { enabled: salesKeys.length > 0 },
  );
  return {
    contactOf: (id?: Identifier | null) =>
      contacts?.find((contact) => contact.id === id),
    saleOf: (id?: Identifier | null) => sales?.find((sale) => sale.id === id),
  };
};

const contactName = (contact?: Contact) =>
  contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
    : "…";

const PER_PAGE = 100;

/** Leads on Callback whose callback falls on the day (today also shows overdue ones). */
export const CallbacksList = ({ day }: { day: ScheduleDay }) => {
  const translate = useTranslate();
  const { data, isPending, error } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: PER_PAGE },
    sort: { field: "next_attempt_at", order: "ASC" },
    filter: {
      status: "callback",
      "next_attempt_at@lte": day.endIso,
      ...(day.isToday ? {} : { "next_attempt_at@gte": day.startIso }),
    },
  });
  const contacts = data ?? [];
  const { saleOf } = useRelated(
    [],
    contacts.map((contact) => contact.assigned_to),
  );

  return (
    <ListState
      isPending={isPending}
      error={error}
      count={contacts.length}
      empty={translate("crm.dashboard.home.no_callbacks", {
        _: "No callbacks scheduled for this day.",
      })}
    >
      {contacts.map((contact) => {
        const isLate =
          !!contact.next_attempt_at &&
          new Date(contact.next_attempt_at) < new Date(day.startIso);
        return (
          <ActivityCard
            key={contact.id}
            title={contactName(contact)}
            related={contact.company_name}
            description={
              isLate
                ? translate("crm.dashboard.home.callback_missed", {
                    _: "Callback was due %{date}",
                    date: new Date(
                      contact.next_attempt_at!,
                    ).toLocaleDateString(),
                  })
                : undefined
            }
            time={timeOf(contact.next_attempt_at)}
            channel={translate("crm.dashboard.home.channel_phone", {
              _: "Phone call",
            })}
            owner={saleOf(contact.assigned_to)}
            status={
              isLate
                ? translate("crm.dashboard.home.status_late", { _: "Overdue" })
                : translate("crm.dashboard.home.status_due", { _: "Due" })
            }
            tone={isLate ? "late" : "open"}
            to={`/contacts/${contact.id}/show`}
          />
        );
      })}
    </ListState>
  );
};

/** Leads that answered a call on the day (newest first), with their stage. */
export const RecentConnectedList = ({ day }: { day: ScheduleDay }) => {
  const translate = useTranslate();
  const { noteStatuses } = useConfigurationContext();
  const { data, isPending, error } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: PER_PAGE },
    sort: { field: "last_connected_at", order: "DESC" },
    filter: {
      "last_connected_at@gte": day.startIso,
      "last_connected_at@lte": day.endIso,
    },
  });
  const contacts = data ?? [];
  const { saleOf } = useRelated(
    [],
    contacts.map((contact) => contact.assigned_to),
  );

  return (
    <ListState
      isPending={isPending}
      error={error}
      count={contacts.length}
      empty={translate("crm.dashboard.home.no_recent", {
        _: "No leads connected on this day.",
      })}
    >
      {contacts.map((contact) => (
        <ActivityCard
          key={contact.id}
          title={contactName(contact)}
          related={contact.company_name}
          time={timeOf(contact.last_connected_at)}
          channel={translate("crm.dashboard.home.channel_phone", {
            _: "Phone call",
          })}
          owner={saleOf(contact.assigned_to)}
          status={
            noteStatuses.find((status) => status.value === contact.status)
              ?.label ?? contact.status
          }
          tone={contact.status === "interested" ? "done" : "open"}
          to={`/contacts/${contact.id}/show`}
        />
      ))}
    </ListState>
  );
};
