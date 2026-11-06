import {
  useCanAccess,
  useGetIdentity,
  useGetList,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  FileClock,
  Handshake,
  PhoneCall,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Brochure, CallAssignment } from "../types";

type KpiTone = "yellow" | "blue" | "lavender";

const TONES: Record<KpiTone, string> = {
  yellow: "bg-kpi-yellow",
  blue: "bg-kpi-blue",
  lavender: "bg-kpi-lavender",
};

interface KpiCardProps {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  tone: KpiTone;
  to: string;
}

/** Pastel card: label top-left, big number bottom-left, icon chip bottom-right. */
const KpiCard = ({ label, value, icon: Icon, tone, to }: KpiCardProps) => (
  <Link
    to={to}
    className={cn(
      "group flex min-h-36 flex-col justify-between rounded-3xl p-5 text-kpi-foreground no-underline transition-[filter] outline-none hover:brightness-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50",
      TONES[tone],
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm font-medium">{label}</span>
      <ArrowUpRight
        className="size-4 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70"
        aria-hidden
      />
    </div>
    <div className="flex items-end justify-between gap-2">
      {value === undefined ? (
        <Skeleton className="h-10 w-20 bg-black/10 dark:bg-white/10" />
      ) : (
        <span className="text-4xl font-normal tracking-tight tabular-nums">
          {value.toLocaleString()}
        </span>
      )}
      <span className="flex size-9 items-center justify-center rounded-full bg-background/70 text-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
    </div>
  </Link>
);

const PendingBrochuresKpi = () => {
  const translate = useTranslate();
  // Same query as the sidebar badge and brochures page, so they share a cache.
  const { total } = useGetList<Brochure>("brochures", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "created_at", order: "DESC" },
    filter: { status: "pending" },
  });
  return (
    <KpiCard
      label={translate("crm.dashboard.kpi.pending_brochures")}
      value={total}
      icon={FileClock}
      tone="lavender"
      to="/brochures"
    />
  );
};

/** BDEs see their open calls instead of brochures. */
const OpenCallsKpi = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const { total } = useGetList<CallAssignment>(
    "call_assignments",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "assignment_date", order: "ASC" },
      filter: { status: "open", sales_id: identity?.id },
    },
    { enabled: identity?.id != null },
  );
  return (
    <KpiCard
      label={translate("crm.dashboard.kpi.open_calls", { _: "Open calls" })}
      value={total}
      icon={PhoneCall}
      tone="lavender"
      to="/call_assignments"
    />
  );
};

const ThirdKpi = () => {
  const { canAccess, isPending } = useCanAccess({
    resource: "brochures",
    action: "list",
  });
  if (isPending) return null;
  return canAccess ? <PendingBrochuresKpi /> : <OpenCallsKpi />;
};

export const DashboardKpis = ({
  totalContacts,
  totalDeals,
}: {
  totalContacts: number | undefined;
  totalDeals: number | undefined;
}) => {
  const translate = useTranslate();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label={translate("resources.contacts.name", { smart_count: 2 })}
        value={totalContacts}
        icon={Users}
        tone="yellow"
        to="/contacts"
      />
      <KpiCard
        label={translate("resources.deals.name", { smart_count: 2 })}
        value={totalDeals}
        icon={Handshake}
        tone="blue"
        to="/deals"
      />
      <ThirdKpi />
    </div>
  );
};
