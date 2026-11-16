import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** White dashboard surface: 12px radius, hairline border, barely-there shadow. */
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
      "rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(41,41,41,0.04)]",
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
      "text-[15px] font-semibold tracking-tight text-foreground",
      className,
    )}
  >
    {children}
  </h2>
);

/** Inline message for a panel that failed to load or has nothing to show. */
export const DashboardEmpty = ({ children }: { children: ReactNode }) => (
  <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
);
