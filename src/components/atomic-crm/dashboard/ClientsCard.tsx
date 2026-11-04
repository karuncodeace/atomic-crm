import { startOfWeek } from "date-fns";
import { useGetList, useTranslate } from "ra-core";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { Avatar } from "../contacts/Avatar";
import type { Contact } from "../types";

const STACK_SIZE = 5;
const POPOVER_SIZE = 20;

/** Contacts at a glance: total, new this week, and the most recently seen. */
export const ClientsCard = ({ total }: { total: number | undefined }) => {
  const translate = useTranslate();
  const { total: newThisWeek } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "first_seen", order: "DESC" },
    filter: {
      "first_seen@gte": startOfWeek(new Date(), {
        weekStartsOn: 1,
      }).toISOString(),
    },
  });
  const { data: recent, isPending } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: POPOVER_SIZE },
    sort: { field: "last_seen", order: "DESC" },
  });

  const stack = (recent ?? []).slice(0, STACK_SIZE);
  const remaining = (total ?? 0) - stack.length;

  return (
    <section className="flex h-full flex-col gap-4 rounded-3xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-medium">
            {translate("resources.contacts.name", { smart_count: 2 })}
          </h2>
          {total === undefined ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <p className="text-4xl tracking-tight tabular-nums">
              {total.toLocaleString()}
            </p>
          )}
        </div>
        <Link
          to="/contacts"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {translate("crm.dashboard.view_all")}
        </Link>
      </div>

      <div className="border-y py-3 text-sm text-muted-foreground">
        {newThisWeek === undefined ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          translate("crm.dashboard.clients.new_this_week", {
            smart_count: newThisWeek,
          })
        )}
      </div>

      <div className="mt-auto flex items-center">
        {isPending ? (
          <Skeleton className="h-10 w-40 rounded-full" />
        ) : (
          <div className="flex -space-x-2 *:rounded-full *:ring-2 *:ring-card">
            {stack.map((contact) => (
              <Link
                key={contact.id}
                to={`/contacts/${contact.id}/show`}
                aria-label={`${contact.first_name} ${contact.last_name}`}
                className="outline-none focus-visible:ring-ring"
              >
                <Avatar
                  record={contact}
                  title={`${contact.first_name} ${contact.last_name}`}
                />
              </Link>
            ))}
            {remaining > 0 ? (
              <MoreContacts contacts={recent ?? []} remaining={remaining} />
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
};

const MoreContacts = ({
  contacts,
  remaining,
}: {
  contacts: Contact[];
  remaining: number;
}) => {
  const translate = useTranslate();
  return (
    <Popover>
      <PopoverTrigger
        aria-label={translate("crm.dashboard.clients.show_more", {
          count: remaining,
        })}
        className="relative flex size-10 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        +{remaining > 99 ? "99" : remaining}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {translate("crm.dashboard.clients.recently_seen")}
        </p>
        <ul className="max-h-72 overflow-y-auto">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <Link
                to={`/contacts/${contact.id}/show`}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-foreground no-underline outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <Avatar record={contact} width={25} height={25} />
                <span className="truncate">
                  {contact.first_name} {contact.last_name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          to="/contacts"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mt-1 w-full",
          )}
        >
          {translate("crm.dashboard.view_all")}
        </Link>
      </PopoverContent>
    </Popover>
  );
};
