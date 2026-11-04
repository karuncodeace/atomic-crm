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
  StatusBadge,
} from "./BrochureParts";

const SKELETON_ROWS = 5;

export const BrochureTable = () => {
  const { data, isPending } = useListContext<Brochure>();
  const translate = useTranslate();

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">
              {translate("resources.brochures.fields.brochure_url")}
            </TableHead>
            <TableHead className="w-40">
              {translate("resources.brochures.fields.created_at")}
            </TableHead>
            <TableHead className="w-36">
              {translate("resources.brochures.fields.status")}
            </TableHead>
            <TableHead className="w-14 pr-4">
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
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="pr-4">
                    <Skeleton className="ml-auto size-8" />
                  </TableCell>
                </TableRow>
              ))
            : data?.map((brochure) => (
                <RecordContextProvider key={brochure.id} value={brochure}>
                  <TableRow>
                    <TableCell className="max-w-0 py-3 pl-4">
                      <BrochureSummary />
                    </TableCell>
                    <TableCell>
                      <CreatedAt />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={brochure.status} />
                    </TableCell>
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
