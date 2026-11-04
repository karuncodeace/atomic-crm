import { useQueryClient } from "@tanstack/react-query";
import { useNotify, useRecordContext, useTranslate, useUpdate } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Check, ExternalLink, FileText, MoreHorizontal, X } from "lucide-react";

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

export const CreatedAt = ({
  className,
  inline = false,
}: {
  className?: string;
  inline?: boolean;
}) => {
  const record = useRecordContext<Brochure>();
  if (!record?.created_at) return null;
  const date = new Date(record.created_at);
  const isThisYear = date.getFullYear() === new Date().getFullYear();
  const day = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(isThisYear ? {} : { year: "numeric" }),
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <time
      dateTime={record.created_at}
      title={date.toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short",
      })}
      className={cn("tabular-nums", className)}
    >
      {inline ? (
        `${day}, ${time}`
      ) : (
        <>
          {day}
          <span className="block text-xs text-muted-foreground">{time}</span>
        </>
      )}
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

export const BrochureActions = () => {
  const record = useRecordContext<Brochure>();
  const translate = useTranslate();
  const { decide, isPending } = useBrochureDecision(record);
  if (!record) return null;

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
              aria-label={translate("resources.brochures.fields.actions")}
            />
          }
        >
          {isPending ? (
            <Spinner className="size-4" />
          ) : (
            <MoreHorizontal className="size-4" aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
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
