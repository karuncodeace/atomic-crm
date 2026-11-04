import { useGetIdentity, useGetList, useTranslate } from "ra-core";

import type { Contact } from "../types";
import { ClientsCard } from "./ClientsCard";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardKpis } from "./DashboardKpis";
import { DashboardPanel, DashboardPanelDrawer } from "./DashboardPanel";
import { DealsChart } from "./DealsChart";
import { HotContacts } from "./HotContacts";
import { RecentNotesCard } from "./RecentNotesCard";
import { Welcome } from "./Welcome";

export const Dashboard = () => {
  const { total: totalContact, isPending: isPendingContact } =
    useGetList<Contact>("contacts", {
      pagination: { page: 1, perPage: 1 },
    });

  const { total: totalDeal, isPending: isPendingDeal } = useGetList("deals", {
    pagination: { page: 1, perPage: 1 },
  });

  const isPending = isPendingContact || isPendingDeal;

  if (isPending) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <DashboardGreeting />
        <DashboardKpis totalContacts={totalContact} totalDeals={totalDeal} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            <RecentNotesCard />
          </div>
          <div className="min-w-0 lg:col-span-5">
            <ClientsCard total={totalContact} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-5">
            {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
            <HotContacts />
          </div>
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
            {totalDeal ? <DealsChart /> : null}
            <DashboardActivityLog />
          </div>
        </div>
      </div>
      <DashboardPanel />
    </div>
  );
};

const DashboardGreeting = () => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const firstName = identity?.fullName?.split(" ")[0] ?? "";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {firstName
            ? translate("crm.dashboard.welcome_back", { name: firstName })
            : translate("ra.page.dashboard")}
        </h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>
      <DashboardPanelDrawer />
    </div>
  );
};
