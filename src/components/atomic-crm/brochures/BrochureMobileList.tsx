import { RecordContextProvider, useListContext } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";

import type { Brochure } from "../types";
import {
  BrochureActions,
  BrochureSummary,
  CreatedAt,
  LinkedRecords,
  StatusBadge,
} from "./BrochureParts";

const SKELETON_ROWS = 4;

export const BrochureMobileList = ({ showStatus }: { showStatus: boolean }) => {
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
            <Skeleton className="h-8 w-full" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {data?.map((brochure) => (
        <RecordContextProvider key={brochure.id} value={brochure}>
          <li className="rounded-lg border bg-card">
            <div className="flex items-start gap-2 p-4 pb-3">
              <BrochureSummary className="flex-1" />
              {brochure.status !== "pending" ? <BrochureActions /> : null}
            </div>
            <div className="flex items-end justify-between gap-3 px-4 pb-4 text-sm">
              <LinkedRecords className="flex-1" />
              <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                {showStatus ? <StatusBadge status={brochure.status} /> : null}
                <CreatedAt className="text-xs text-muted-foreground" />
              </div>
            </div>
            {brochure.status === "pending" ? (
              <div className="border-t p-3">
                <BrochureActions fullWidth />
              </div>
            ) : null}
          </li>
        </RecordContextProvider>
      ))}
    </ul>
  );
};
