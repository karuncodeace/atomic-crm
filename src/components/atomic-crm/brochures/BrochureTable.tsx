import { RecordContextProvider, useListContext, useTranslate } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { Brochure } from "../types";
import {
  BrochureActions,
  BrochureSummary,
  CreatedAt,
  LinkedRecords,
  StatusBadge,
} from "./BrochureParts";

const SKELETON_ROWS = 5;

export const BrochureTable = ({ showStatus }: { showStatus: boolean }) => {
  const { data, isPending } = useListContext<Brochure>();
  const translate = useTranslate();

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[38%] pl-4">
              {translate("resources.brochures.fields.brochure_url")}
            </TableHead>
            <TableHead>
              {translate("resources.brochures.fields.linked_to")}
            </TableHead>
            <TableHead className="w-32">
              {translate("resources.brochures.fields.created_at")}
            </TableHead>
            {showStatus ? (
              <TableHead className="w-32">
                {translate("resources.brochures.fields.status")}
              </TableHead>
            ) : null}
            <TableHead className="w-52 pr-4 text-right">
              <span className="sr-only">
                {translate("resources.brochures.fields.actions")}
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody aria-busy={isPending}>
          {isPending
            ? Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                <TableRow key={index} className="hover:bg-transparent">
                  <TableCell className="py-3 pl-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-10 rounded-lg" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  {showStatus ? (
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                  ) : null}
                  <TableCell className="pr-4">
                    <Skeleton className="ml-auto h-8 w-40" />
                  </TableCell>
                </TableRow>
              ))
            : data?.map((brochure) => (
                <RecordContextProvider key={brochure.id} value={brochure}>
                  <TableRow>
                    <TableCell className="max-w-0 py-3 pl-4">
                      <BrochureSummary />
                    </TableCell>
                    <TableCell className="max-w-0">
                      <LinkedRecords />
                    </TableCell>
                    <TableCell>
                      <CreatedAt />
                    </TableCell>
                    {showStatus ? (
                      <TableCell>
                        <StatusBadge status={brochure.status} />
                      </TableCell>
                    ) : null}
                    <TableCell className="pr-4">
                      <BrochureActions />
                    </TableCell>
                  </TableRow>
                </RecordContextProvider>
              ))}
        </TableBody>
      </Table>
    </div>
  );
};
