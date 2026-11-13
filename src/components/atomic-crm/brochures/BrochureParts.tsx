import { useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCanAccess,
  useNotify,
  useRecordContext,
  useTranslate,
  useUpdate,
} from "ra-core";
import { Confirm } from "@/components/admin/confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  Check,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import type { Brochure, BrochureStatus } from "../types";
import { formatBrochureUrl } from "./brochureUrl";
import { engineFetch } from "../axicore/axicore";

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

type EngineDoc = { id: number; kind: string; status: string };

/**
 * Edit and Delete (owner, 2026-11-13: "add option in crm to delete brochure", "edit option also"), for admins and
 * managers (the AxiCore roles). Edit opens AxiCore's newest finished brochure of the company in its editor; a saved
 * edit sends the new PDF to the same CRM row. Delete asks AxiCore to remove the row and its PDF: the CRM's own rules
 * give signed-in users no delete on brochures.
 */
const useBrochureEditDelete = (record: Brochure | undefined) => {
  const { canAccess } = useCanAccess({ resource: "axicore", action: "access" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [working, setWorking] = useState(false);

  const edit = async () => {
    if (!record?.company_id) {
      notify("resources.brochures.notification.no_doc", { type: "warning" });
      return;
    }
    setWorking(true);
    try {
      const r = (await engineFetch(
        `/api/axicore/company/${record.company_id}/docs`,
      )) as { docs?: EngineDoc[] } | null;
      const doc = r?.docs?.find(
        (d) => d.kind === "brochure" && d.status === "ready",
      );
      if (doc) navigate(`/axicore/brochure/${doc.id}`);
      else
        notify("resources.brochures.notification.no_doc", { type: "warning" });
    } catch {
      notify("resources.brochures.notification.error", { type: "error" });
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    if (!record) return;
    setWorking(true);
    try {
      await engineFetch(`/api/axicore/brochures/${record.id}/delete`, {
        method: "POST",
      });
      queryClient.invalidateQueries({ queryKey: ["brochures"] });
      notify("resources.brochures.notification.deleted", { type: "success" });
    } catch (e) {
      notify((e as Error).message, { type: "error" });
    } finally {
      setWorking(false);
    }
  };

  return { canAccess: !!canAccess, edit, remove, working };
};

export const BrochureActions = () => {
  const record = useRecordContext<Brochure>();
  const translate = useTranslate();
  const { decide, isPending } = useBrochureDecision(record);
  const { canAccess, edit, remove, working } = useBrochureEditDelete(record);
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!record) return null;
  const busy = isPending || working;

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={busy}
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
          {busy ? (
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
          {canAccess ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={edit}>
                  <Pencil aria-hidden />
                  {translate("resources.brochures.action.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 aria-hidden />
                  {translate("resources.brochures.action.delete")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        isOpen={confirmOpen}
        title="resources.brochures.confirm_delete.title"
        content="resources.brochures.confirm_delete.content"
        translateOptions={{ title: record.title || "" }}
        confirm="resources.brochures.action.delete"
        confirmColor="warning"
        loading={working}
        onConfirm={async () => {
          await remove();
          setConfirmOpen(false);
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
};
