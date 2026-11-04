import { formatDistanceToNowStrict } from "date-fns";
import { useGetIdentity, useGetList, useGetMany, useTranslate } from "ra-core";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquareText } from "lucide-react";

import { Avatar } from "../contacts/Avatar";
import type { Contact, ContactNote } from "../types";

const NOTES_SHOWN = 4;

/** The current user's latest contact notes, shown as message rows. */
export const RecentNotesCard = () => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const { data: notes, isPending } = useGetList<ContactNote>(
    "contact_notes",
    {
      pagination: { page: 1, perPage: NOTES_SHOWN },
      sort: { field: "date", order: "DESC" },
      filter: {},
    },
    { enabled: identity?.id != null },
  );
  const { data: contacts } = useGetMany<Contact>(
    "contacts",
    { ids: [...new Set((notes ?? []).map((note) => note.contact_id))] },
    { enabled: !!notes?.length },
  );

  return (
    <section className="flex h-full flex-col gap-3 rounded-3xl border bg-card p-5">
      <h2 className="text-base font-medium">
        {translate("crm.dashboard.latest_notes")}
      </h2>
      {isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : !notes?.length ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <MessageSquareText
            className="size-5 text-muted-foreground"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">
            {translate("crm.dashboard.notes_empty")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => {
            const contact = contacts?.find((c) => c.id === note.contact_id);
            const name = contact
              ? `${contact.first_name} ${contact.last_name}`
              : "";
            return (
              <li key={note.id}>
                <Link
                  to={`/contacts/${note.contact_id}/show`}
                  className="flex items-start gap-3 rounded-2xl bg-muted/60 p-3 text-foreground no-underline transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {contact ? (
                    <Avatar record={contact} />
                  ) : (
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {name || "—"}
                      </span>
                      <time
                        dateTime={note.date}
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        {formatDistanceToNowStrict(new Date(note.date), {
                          addSuffix: true,
                        })}
                      </time>
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {note.text}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
