import { useState } from "react";
import {
  RecordContextProvider,
  useDataProvider,
  useListContext,
  useNotify,
  useRecordContext,
  useTranslate,
  type RaRecord,
} from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { Brochure, BrochureStatus } from "../types";
import { formatBrochureUrl } from "./brochureUrl";

type BrochureTab = "pending" | "all";

const BrochureList = () => {
  const [tab, setTab] = useState<BrochureTab>("all");

  return (
    <List
      key={tab}
      perPage={25}
      sort={{ field: "created_at", order: "DESC" }}
      filter={tab === "pending" ? { status: "pending" } : {}}
      actions={<BrochureTabs tab={tab} onChange={setTab} />}
      pagination={<ListPagination rowsPerPageOptions={[25, 50, 100]} />}
      disableSyncWithLocation
      storeKey={`brochures.${tab}`}
    >
      <BrochureListBody />
    </List>
  );
};

const BrochureTabs = ({
  tab,
  onChange,
}: {
  tab: BrochureTab;
  onChange: (tab: BrochureTab) => void;
}) => {
  const translate = useTranslate();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={tab === "all" ? "default" : "outline"}
        onClick={() => onChange("all")}
      >
        {translate("resources.brochures.tabs.all")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={tab === "pending" ? "default" : "outline"}
        onClick={() => onChange("pending")}
      >
        {translate("resources.brochures.tabs.approval")}
      </Button>
    </div>
  );
};

const BrochureListBody = () => {
  const { data, isPending, filterValues } = useListContext<Brochure>();
  const isMobile = useIsMobile();
  const translate = useTranslate();

  if (isPending) return null;
  if (!data?.length) {
    const waiting = filterValues?.status === "pending";
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
        <p className="text-lg font-medium">
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
    );
  }

  if (isMobile) return <BrochureCards />;
  return <BrochureTable />;
};

const BrochureTable = () => (
  <div className="overflow-x-auto">
    <DataTable<Brochure> bulkActionButtons={false} rowClick={false}>
      <DataTable.Col
        source="company_id"
        label="resources.brochures.fields.company_id"
        disableSort
      >
        <LinkedName source="company_id" reference="companies" />
      </DataTable.Col>
      <DataTable.Col
        source="contact_id"
        label="resources.brochures.fields.contact_id"
        disableSort
        className="hidden md:table-cell"
      >
        <LinkedName source="contact_id" reference="contacts" />
      </DataTable.Col>
      <DataTable.Col
        source="deal_id"
        label="resources.brochures.fields.deal_id"
        disableSort
        className="hidden lg:table-cell"
      >
        <LinkedName source="deal_id" reference="deals" />
      </DataTable.Col>
      <DataTable.Col
        source="title"
        label="resources.brochures.fields.title"
        className="max-w-40"
      >
        <Truncated source="title" />
      </DataTable.Col>
      <DataTable.Col
        source="brochure_url"
        label="resources.brochures.fields.brochure_url"
        disableSort
        className="min-w-48 max-w-72"
      >
        <BrochureLink />
      </DataTable.Col>
      <DataTable.Col
        source="created_at"
        label="resources.brochures.fields.created_at"
        className="hidden md:table-cell whitespace-nowrap"
      >
        <CreatedAt />
      </DataTable.Col>
      <DataTable.Col
        source="status"
        label="resources.brochures.fields.status"
        disableSort
      >
        <BrochureApprovalActions />
      </DataTable.Col>
    </DataTable>
  </div>
);

const BrochureCards = () => {
  const { data } = useListContext<Brochure>();
  if (!data) return null;
  return (
    <ul className="flex flex-col gap-3">
      {data.map((brochure) => (
        <BrochureCard key={brochure.id} brochure={brochure} />
      ))}
    </ul>
  );
};

const BrochureCard = ({ brochure }: { brochure: Brochure }) => {
  const translate = useTranslate();
  return (
    <li>
      <RecordContextProvider value={brochure}>
        <div className="flex flex-col gap-3 rounded-xl border p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{brochure.title || "—"}</p>
            <CreatedAt />
          </div>
          <BrochureLink />
          <dl className="grid grid-cols-1 gap-1 text-sm">
            <CardLink
              label={translate("resources.brochures.fields.company_id")}
              source="company_id"
              reference="companies"
            />
            <CardLink
              label={translate("resources.brochures.fields.contact_id")}
              source="contact_id"
              reference="contacts"
            />
            <CardLink
              label={translate("resources.brochures.fields.deal_id")}
              source="deal_id"
              reference="deals"
            />
          </dl>
          <BrochureApprovalActions />
        </div>
      </RecordContextProvider>
    </li>
  );
};

const CardLink = ({
  label,
  source,
  reference,
}: {
  label: string;
  source: "company_id" | "contact_id" | "deal_id";
  reference: string;
}) => (
  <div className="flex gap-2">
    <dt className="text-muted-foreground">{label}</dt>
    <dd>
      <LinkedName source={source} reference={reference} />
    </dd>
  </div>
);

const LinkedName = ({
  source,
  reference,
}: {
  source: "company_id" | "contact_id" | "deal_id";
  reference: string;
}) => {
  const record = useRecordContext<Brochure>();
  if (!record?.[source]) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <ReferenceField source={source} reference={reference} link="show">
      <RecordLabel />
    </ReferenceField>
  );
};

const RecordLabel = () => {
  const record = useRecordContext<RaRecord>();
  if (!record) return null;
  const name =
    (typeof record.name === "string" && record.name) ||
    [record.first_name, record.last_name].filter(Boolean).join(" ");
  if (!name) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={name} className="block max-w-40 truncate">
      {name}
    </span>
  );
};

const Truncated = ({ source }: { source: "title" }) => {
  const record = useRecordContext<Brochure>();
  const value = record?.[source];
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={value} className="block max-w-56 truncate">
      {value}
    </span>
  );
};

const BrochureLink = () => {
  const record = useRecordContext<Brochure>();
  if (!record?.brochure_url) {
    return <span className="text-muted-foreground">—</span>;
  }
  const { href, label } = formatBrochureUrl(record.brochure_url);
  if (!href) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={href}
      className="block max-w-72 truncate text-sm text-primary underline"
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </a>
  );
};

const CreatedAt = () => {
  const record = useRecordContext<Brochure>();
  if (!record?.created_at) return null;
  const date = new Date(record.created_at);
  const fullDate = date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const shortDate =
    date.getFullYear() === new Date().getFullYear()
      ? date.toLocaleDateString("en-US", { day: "numeric", month: "short" })
      : fullDate;
  return (
    <span
      title={fullDate}
      className="text-sm whitespace-nowrap text-muted-foreground"
    >
      {shortDate}
    </span>
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

  return (
    <div className="flex flex-col items-start gap-2">
      {record.status !== "pending" && (
        <Badge
          variant="outline"
          className={cn(
            record.status === "approved" &&
              "border-green-600/40 text-green-700 dark:text-green-300",
            record.status === "not_approved" &&
              "border-red-600/40 text-red-700 dark:text-red-300",
          )}
        >
          {translate(`resources.brochures.status.${record.status}`)}
        </Badge>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isUpdating || record.status === "approved"}
          onClick={() => setStatus("approved")}
        >
          {translate("resources.brochures.action.approve")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isUpdating || record.status === "not_approved"}
          onClick={() => setStatus("not_approved")}
        >
          {translate("resources.brochures.action.not_approve")}
        </Button>
      </div>
    </div>
  );
};

export default BrochureList;
