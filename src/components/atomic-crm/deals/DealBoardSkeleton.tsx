import { Skeleton } from "@/components/ui/skeleton";

const COLUMNS = 5;
const CARDS = [3, 4, 2, 3, 4];

/** Placeholder for the leads board while the first page of leads loads. */
export const DealBoardSkeleton = () => (
  <div className="flex gap-4 overflow-hidden" aria-busy="true">
    {Array.from({ length: COLUMNS }, (_, column) => (
      <div key={column} className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col items-center gap-1.5 py-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
        {Array.from({ length: CARDS[column] }, (_, card) => (
          <Skeleton key={card} className="h-[104px] rounded-2xl" />
        ))}
      </div>
    ))}
  </div>
);
