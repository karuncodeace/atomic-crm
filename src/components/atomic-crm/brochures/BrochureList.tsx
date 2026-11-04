import { useGetList, useListContext, useTranslate } from "ra-core";
import { useSearchParams } from "react-router";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { CheckCircle2, FileText } from "lucide-react";

import type { Brochure, BrochureStatus } from "../types";
import { BrochureMobileList } from "./BrochureMobileList";
import { BrochureTable } from "./BrochureTable";

type BrochureTab = BrochureStatus | "all";

const TABS: BrochureTab[] = ["pending", "approved", "not_approved", "all"];
const DEFAULT_TAB: BrochureTab = "pending";

const isBrochureTab = (value: string | null): value is BrochureTab =>
  TABS.includes(value as BrochureTab);

/** The active tab lives in `?status=` so a refresh or shared link restores it. */
const useBrochureTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("status");
  const tab = isBrochureTab(raw) ? raw : DEFAULT_TAB;
  const setTab = (next: BrochureTab) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === DEFAULT_TAB) params.delete("status");
        else params.set("status", next);
        return params;
      },
      { replace: true },
    );
  return [tab, setTab] as const;
};

const useStatusCount = (status: BrochureStatus) =>
  useGetList<Brochure>("brochures", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "created_at", order: "DESC" },
    filter: { status },
  }).total;

const BrochureList = () => {
  const [tab, setTab] = useBrochureTab();
  const translate = useTranslate();
  const isMobile = useIsMobile();

  const pending = useStatusCount("pending");
  const approved = useStatusCount("approved");
  const declined = useStatusCount("not_approved");
  const counts: Record<BrochureTab, number | undefined> = {
    pending,
    approved,
    not_approved: declined,
    all:
      pending === undefined || approved === undefined || declined === undefined
        ? undefined
        : pending + approved + declined,
  };

  return (
    <List
      key={tab}
      title={translate("resources.brochures.page_title")}
      perPage={25}
      sort={{ field: "created_at", order: "DESC" }}
      filter={tab === "all" ? {} : { status: tab }}
      actions={false}
      pagination={<ListPagination rowsPerPageOptions={[25, 50, 100]} />}
      disableSyncWithLocation
      storeKey={`brochures.${tab}`}
      className={cn(isMobile && "px-1 pb-16")}
    >
      <p className="-mt-2 mb-5 max-w-2xl text-sm text-muted-foreground">
        {translate("resources.brochures.page_subtitle")}
      </p>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as BrochureTab)}
        className="mb-4"
      >
        <div className="-mx-1 overflow-x-auto border-b px-1">
          <TabsList variant="line" className="h-10 gap-4">
            {TABS.map((value) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-none gap-2 px-0.5"
              >
                {translate(
                  value === "all"
                    ? "resources.brochures.tabs.all"
                    : `resources.brochures.status.${value}`,
                )}
                <TabCount
                  value={counts[value]}
                  highlight={value === "pending"}
                />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <BrochureListBody tab={tab} isMobile={isMobile} />
    </List>
  );
};

const TabCount = ({
  value,
  highlight,
}: {
  value: number | undefined;
  highlight: boolean;
}) => {
  if (value === undefined) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums",
        highlight && value > 0
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
};

const BrochureListBody = ({
  tab,
  isMobile,
}: {
  tab: BrochureTab;
  isMobile: boolean;
}) => {
  const { data, isPending } = useListContext<Brochure>();

  if (!isPending && !data?.length) return <EmptyState tab={tab} />;

  return isMobile ? <BrochureMobileList /> : <BrochureTable />;
};

const EmptyState = ({ tab }: { tab: BrochureTab }) => {
  const translate = useTranslate();
  const isCaughtUp = tab === "pending";
  const Icon = isCaughtUp ? CheckCircle2 : FileText;

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          isCaughtUp
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium">
          {translate(
            isCaughtUp
              ? "resources.brochures.empty.approval_title"
              : "resources.brochures.empty.title",
          )}
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          {translate(
            isCaughtUp
              ? "resources.brochures.empty.approval_description"
              : "resources.brochures.empty.description",
          )}
        </p>
      </div>
    </div>
  );
};

export default BrochureList;
