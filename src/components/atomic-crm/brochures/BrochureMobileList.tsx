import { RecordContextProvider, useListContext } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";

import type { Brochure } from "../types";
import {
  BrochureActions,
  BrochureSummary,
  CreatedAt,
  StatusBadge,
} from "./BrochureParts";

const SKELETON_ROWS = 4;

export const BrochureMobileList = () => {
  const { data, isPending } = useListContext<Brochure>();

  if (isPending) {
    return (
      <ul className="flex flex-col gap-3" aria-busy="true">
        {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
          <li key={index} className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-5 w-1/3" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {data?.map((brochure) => (
        <RecordContextProvider key={brochure.id} value={brochure}>
          <li className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-2">
              <BrochureSummary className="flex-1" />
              <BrochureActions />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <StatusBadge status={brochure.status} />
              <CreatedAt inline className="text-xs text-muted-foreground" />
            </div>
          </li>
        </RecordContextProvider>
      ))}
    </ul>
  );
};
