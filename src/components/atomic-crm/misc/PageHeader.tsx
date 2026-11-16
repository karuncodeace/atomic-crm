import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Page title row shared by the custom pages (calls, follow-ups, tasks):
 * same size and spacing as the list pages' header (admin/list.tsx).
 */
export const PageHeader = ({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "mt-1 mb-5 flex flex-wrap items-end justify-between gap-3",
      className,
    )}
  >
    <div className="min-w-0">
      <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {actions ? (
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    ) : null}
  </div>
);

/** Friendly empty / error state: icon in a soft disc, message, optional action. */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
}) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
    <span
      className={cn(
        "flex size-12 items-center justify-center rounded-full shadow-card",
        tone === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-brand-soft text-foreground",
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
    </span>
    <div className="max-w-sm space-y-1">
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {action}
  </div>
);
