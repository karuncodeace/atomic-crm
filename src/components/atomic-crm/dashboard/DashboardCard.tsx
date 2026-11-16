import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dashboard surface: 16px radius, hairline border, soft two-layer shadow
 * (--shadow-card), 24px padding. Every dashboard section uses it, so spacing
 * and depth stay the same everywhere.
 */
export const DashboardCard = ({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) => (
  <section
    id={id}
    className={cn(
      "rounded-2xl border border-border/80 bg-card p-5 shadow-card sm:p-6",
      className,
    )}
  >
    {children}
  </section>
);

export const DashboardCardTitle = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <h2
    className={cn(
      "text-[15px] leading-6 font-semibold tracking-tight text-foreground",
      className,
    )}
  >
    {children}
  </h2>
);

/** Standard card header: title, one-line description, optional right-hand slot. */
export const DashboardCardHeader = ({
  title,
  description,
  aside,
}: {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
    <div className="min-w-0">
      <DashboardCardTitle>{title}</DashboardCardTitle>
      {description ? (
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
    {aside ? <div className="shrink-0">{aside}</div> : null}
  </div>
);

/** Inline message for a panel that failed to load or has nothing to show. */
export const DashboardEmpty = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
    <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-foreground shadow-card">
      <Inbox className="size-5" strokeWidth={1.75} aria-hidden />
    </span>
    <p className="max-w-[16rem] text-sm text-muted-foreground">{children}</p>
  </div>
);
