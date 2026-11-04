import { useQueryClient } from "@tanstack/react-query";
import {
  useNotify,
  useRecordContext,
  useTranslate,
  useUpdate,
  type RaRecord,
} from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  Building2,
  Check,
  ExternalLink,
  FileText,
  Handshake,
  MoreHorizontal,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import type { Brochure, BrochureStatus } from "../types";
import { formatBrochureUrl } from "./brochureUrl";

const STATUS_STYLES: Record<BrochureStatus, { badge: string; dot: string }> = {
  pending: {
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  approved: {
    badge:
      "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  not_approved: {
    badge: "border-red-600/30 bg-red-500/10 text-red-800 dark:text-red-200",
    dot: "bg-red-500",
  },
};

export const StatusBadge = ({ status }: { status: BrochureStatus }) => {
  const translate = useTranslate();
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", STATUS_STYLES[status].badge)}
    >
      <span
        className={cn("size-1.5 rounded-full", STATUS_STYLES[status].dot)}
        aria-hidden
      />
      {translate(`resources.brochures.status.${status}`)}
    </Badge>
  );
};

/** File tile + title + file name; the title opens the brochure in a new tab. */
export const BrochureSummary = ({ className }: { className?: string }) => {
  const record = useRecordContext<Brochure>();
  const translate = useTranslate();
  if (!record) return null;

  const title =
    record.title?.trim() || translate("resources.brochures.untitled");
  const { href, label } = record.brochure_url
    ? formatBrochureUrl(record.brochure_url)
    : { href: "", label: "" };

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-muted-foreground">
        <FileText className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            title={translate("resources.brochures.action.open")}
            className="group/title flex min-w-0 items-center gap-1.5 font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
          >
            <span className="truncate">{title}</span>
            <ExternalLink
              className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100"
              aria-hidden
            />
            <span className="sr-only">
              ({translate("resources.brochures.action.open")})
            </span>
          </a>
        ) : (
          <p className="truncate font-medium">{title}</p>
        )}
        <p
          className="truncate text-xs text-muted-foreground"
          title={href || undefined}
        >
          {label || translate("resources.brochures.no_file")}
        </p>
      </div>
    </div>
  );
};

const LINKS: Array<{
  source: "company_id" | "contact_id" | "deal_id";
  reference: string;
  icon: LucideIcon;
}> = [
  { source: "company_id", reference: "companies", icon: Building2 },
  { source: "contact_id", reference: "contacts", icon: UserRound },
  { source: "deal_id", reference: "deals", icon: Handshake },
];

export const LinkedRecords = ({ className }: { className?: string }) => {
  const record = useRecordContext<Brochure>();
  const translate = useTranslate();
  if (!record) return null;

  const links = LINKS.filter(({ source }) => record[source]);
  if (!links.length) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <ul className={cn("flex min-w-0 flex-col gap-1", className)}>
      {links.map(({ source, reference, icon: Icon }) => (
        <li key={source} className="flex min-w-0 items-center gap-2 text-sm">
          <Icon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="sr-only">
            {translate(`resources.brochures.fields.${source}`)}:
          </span>
          <ReferenceField source={source} reference={reference} link="show">
            <RecordLabel />
          </ReferenceField>
        </li>
      ))}
    </ul>
  );
};

const RecordLabel = () => {
  const record = useRecordContext<RaRecord>();
  if (!record) return null;
  const name =
    (typeof record.name === "string" && record.name) ||
    [record.first_name, record.last_name].filter(Boolean).join(" ");
  if (!name) return <span>—</span>;
  return (
    <span title={name} className="block truncate hover:underline">
      {name}
    </span>
  );
};

export const CreatedAt = ({ className }: { className?: string }) => {
  const record = useRecordContext<Brochure>();
  if (!record?.created_at) return null;
  const date = new Date(record.created_at);
  const isThisYear = date.getFullYear() === new Date().getFullYear();
  return (
    <time
      dateTime={record.created_at}
      title={date.toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short",
      })}
      className={cn("tabular-nums", className)}
    >
      {date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        ...(isThisYear ? {} : { year: "numeric" }),
      })}
      <span className="block text-xs text-muted-foreground">
        {date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </time>
  );
};

const useBrochureDecision = (record: Brochure | undefined) => {
  const [update, { isPending }] = useUpdate<Brochure>();
  const queryClient = useQueryClient();
  const notify = useNotify();

  const decide = (status: BrochureStatus) => {
    if (!record || status === record.status) return;
    update(
      "brochures",
      { id: record.id, data: { status }, previousData: record },
      {
        onSuccess: () => {
          // Refresh the current tab and the per-status counts together.
          queryClient.invalidateQueries({ queryKey: ["brochures"] });
          notify(`resources.brochures.notification.${status}`, {
            type: "success",
          });
        },
        onError: () => {
          notify("resources.brochures.notification.error", { type: "error" });
        },
      },
    );
  };

  return { decide, isPending };
};

/**
 * Pending brochures get explicit Approve / Decline buttons; decided ones keep
 * the row calm and tuck the change behind a menu to avoid accidental clicks.
 */
export const BrochureActions = ({
  fullWidth = false,
}: {
  fullWidth?: boolean;
}) => {
  const record = useRecordContext<Brochure>();
  const translate = useTranslate();
  const { decide, isPending } = useBrochureDecision(record);
  if (!record) return null;

  if (record.status === "pending") {
    return (
      <div
        className={cn(
          "flex items-center gap-2",
          fullWidth ? "grid grid-cols-2" : "justify-end",
        )}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => decide("not_approved")}
          className="gap-1.5 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="size-4" aria-hidden />
          {translate("resources.brochures.action.not_approve")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => decide("approved")}
          className="gap-1.5"
        >
          {isPending ? (
            <Spinner className="size-4" />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {translate("resources.brochures.action.approve")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          render={
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground"
              aria-label={translate("resources.brochures.change_decision")}
            />
          }
        >
          {isPending ? (
            <Spinner className="size-4" />
          ) : (
            <MoreHorizontal className="size-4" aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {translate("resources.brochures.change_decision")}
            </DropdownMenuLabel>
            <DropdownMenuItem
              disabled={record.status === "approved"}
              onClick={() => decide("approved")}
            >
              <Check aria-hidden />
              {translate("resources.brochures.action.approve")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={record.status === "not_approved"}
              onClick={() => decide("not_approved")}
            >
              <X aria-hidden />
              {translate("resources.brochures.action.not_approve")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
