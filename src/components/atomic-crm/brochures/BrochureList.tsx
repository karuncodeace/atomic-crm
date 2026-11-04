import { useState } from "react";
import {
  RecordContextProvider,
  useDataProvider,
  useGetList,
  useListContext,
  useNotify,
  useRecordContext,
  useTranslate,
  type RaRecord,
} from "ra-core";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Building2,
  Check,
  ExternalLink,
  FileText,
  Handshake,
  UserRound,
  X,
} from "lucide-react";

import type { Brochure, BrochureStatus } from "../types";
import { formatBrochureUrl } from "./brochureUrl";

type BrochureTab = "pending" | "all";

const BrochureList = () => {
  const [tab, setTab] = useState<BrochureTab>("pending");
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const { total: pendingTotal } = useGetList<Brochure>("brochures", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "created_at", order: "DESC" },
    filter: { status: "pending" },
  });

  return (
    <List
      key={tab}
      title={translate("resources.brochures.page_title")}
      perPage={25}
      sort={{ field: "created_at", order: "DESC" }}
      filter={tab === "pending" ? { status: "pending" } : {}}
      actions={false}
      pagination={<ListPagination rowsPerPageOptions={[25, 50, 100]} />}
      disableSyncWithLocation
      storeKey={`brochures.${tab}`}
      className={cn(isMobile && "px-1 pb-16")}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">
          {translate("resources.brochures.page_subtitle")}
        </p>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as BrochureTab)}
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="pending" className="gap-2 px-3">
              {translate("resources.brochures.tabs.approval")}
              {typeof pendingTotal === "number" && pendingTotal > 0 ? (
                <Badge
                  variant="secondary"
                  className="h-5 min-w-5 justify-center rounded-full px-1.5 tabular-nums"
                >
                  {pendingTotal}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="all" className="px-3">
              {translate("resources.brochures.tabs.all")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <BrochureListBody />
    </List>
  );
};

const BrochureListBody = () => {
  const { data, isPending, filterValues } = useListContext<Brochure>();
  const translate = useTranslate();

  if (isPending) {
    return (
      <ul className="flex flex-col gap-3" aria-busy="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <li
            key={index}
            className="h-36 animate-pulse rounded-xl border bg-muted/40"
          />
        ))}
      </ul>
    );
  }

  if (!data?.length) {
    const waiting = filterValues?.status === "pending";
    return (
      <Card className="flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center shadow-none">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <FileText className="size-5 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-base font-medium">
            {translate(
              waiting
                ? "resources.brochures.empty.approval_title"
                : "resources.brochures.empty.title",
            )}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {translate("resources.brochures.empty.description")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {data.map((brochure) => (
        <li key={brochure.id}>
          <RecordContextProvider value={brochure}>
            <BrochureCard />
          </RecordContextProvider>
        </li>
      ))}
    </ul>
  );
};

const BrochureCard = () => {
  const record = useRecordContext<Brochure>();
  const translate = useTranslate();
  const isMobile = useIsMobile();

  if (!record) return null;

  return (
    <Card
      className={cn(
        "overflow-hidden p-0 shadow-none transition-colors",
        record.status === "pending" && "border-primary/25",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 p-4",
          !isMobile && "sm:flex-row sm:items-stretch sm:gap-0 sm:p-0",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold tracking-tight">
                  {record.title?.trim() ||
                    translate("resources.brochures.untitled")}
                </h3>
                <StatusBadge status={record.status} />
              </div>
              <CreatedAt />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <MetaLink
              icon={Building2}
              source="company_id"
              reference="companies"
              label={translate("resources.brochures.fields.company_id")}
            />
            <MetaLink
              icon={UserRound}
              source="contact_id"
              reference="contacts"
              label={translate("resources.brochures.fields.contact_id")}
            />
            <MetaLink
              icon={Handshake}
              source="deal_id"
              reference="deals"
              label={translate("resources.brochures.fields.deal_id")}
            />
          </div>

          <BrochureFileLink />
        </div>

        {!isMobile ? (
          <Separator orientation="vertical" className="hidden sm:block" />
        ) : (
          <Separator />
        )}

        <div
          className={cn(
            "flex shrink-0 flex-col justify-center gap-2 sm:w-52 sm:p-4",
            isMobile && "pt-0",
          )}
        >
          <BrochureApprovalActions />
        </div>
      </div>
    </Card>
  );
};

const StatusBadge = ({ status }: { status: BrochureStatus }) => {
  const translate = useTranslate();
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        status === "pending" &&
          "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        status === "approved" &&
          "border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        status === "not_approved" &&
          "border-red-600/40 bg-red-500/10 text-red-800 dark:text-red-200",
      )}
    >
      {translate(`resources.brochures.status.${status}`)}
    </Badge>
  );
};

const MetaLink = ({
  icon: Icon,
  source,
  reference,
  label,
}: {
  icon: typeof Building2;
  source: "company_id" | "contact_id" | "deal_id";
  reference: string;
  label: string;
}) => {
  const record = useRecordContext<Brochure>();
  if (!record?.[source]) return null;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{label}</span>
      <ReferenceField source={source} reference={reference} link="show">
        <RecordLabel />
      </ReferenceField>
    </div>
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
    <span title={name} className="truncate text-foreground hover:underline">
      {name}
    </span>
  );
};

const BrochureFileLink = () => {
  const record = useRecordContext<Brochure>();
  const translate = useTranslate();
  if (!record?.brochure_url) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate("resources.brochures.no_file")}
      </p>
    );
  }
  const { href, label } = formatBrochureUrl(record.brochure_url);
  if (!href) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate("resources.brochures.no_file")}
      </p>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={href}
      className={cn(
        buttonVariants({ variant: "secondary", size: "sm" }),
        "h-9 max-w-full justify-start gap-2 px-3 font-normal",
      )}
    >
      <FileText className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      <ExternalLink
        className="ml-auto size-3.5 shrink-0 opacity-60"
        aria-hidden
      />
      <span className="sr-only">
        {translate("resources.brochures.action.open")}
      </span>
    </a>
  );
};

const CreatedAt = () => {
  const record = useRecordContext<Brochure>();
  if (!record?.created_at) return null;
  const date = new Date(record.created_at);
  const fullDate = date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const shortDate = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === new Date().getFullYear()
      ? {}
      : { year: "numeric" }),
  });
  return (
    <time
      dateTime={record.created_at}
      title={fullDate}
      className="text-xs text-muted-foreground"
    >
      {shortDate}
    </time>
  );
};

const BrochureApprovalActions = () => {
  const record = useRecordContext<Brochure>();
  const dataProvider = useDataProvider();
  const { refetch } = useListContext<Brochure>();
  const notify = useNotify();
  const translate = useTranslate();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!record) return null;

  const setStatus = async (status: BrochureStatus) => {
    if (status === record.status) return;
    setIsUpdating(true);
    try {
      await dataProvider.update<Brochure>("brochures", {
        id: record.id,
        data: { status },
        previousData: record,
      });
      await refetch();
      notify(`resources.brochures.status.${status}`, { type: "info" });
    } catch (error) {
      console.error(error);
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const isPending = record.status === "pending";

  return (
    <div className="flex w-full flex-col gap-2">
      {!isPending ? (
        <p className="text-xs text-muted-foreground sm:text-center">
          {translate("resources.brochures.change_decision")}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={isUpdating || record.status === "approved"}
          onClick={() => setStatus("approved")}
        >
          <Check className="size-4" aria-hidden />
          {translate("resources.brochures.action.approve")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isUpdating || record.status === "not_approved"}
          onClick={() => setStatus("not_approved")}
        >
          <X className="size-4" aria-hidden />
          {translate("resources.brochures.action.not_approve")}
        </Button>
      </div>
    </div>
  );
};

export default BrochureList;
