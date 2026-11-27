import { Draggable } from "@hello-pangea/dnd";
import { Clock } from "lucide-react";
import { useRedirect, RecordContextProvider } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { NumberField } from "@/components/admin/number-field";
import { Card, CardContent } from "@/components/ui/card";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { ShortDate } from "../misc/ShortDate";
import type { Deal } from "../types";
export const DealCard = ({ deal, index }: { deal: Deal; index: number }) => {
  if (!deal) return null;

  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <DealCardContent provided={provided} snapshot={snapshot} deal={deal} />
      )}
    </Draggable>
  );
};

export const DealCardContent = ({
  provided,
  snapshot,
  deal,
}: {
  provided?: any;
  snapshot?: any;
  deal: Deal;
}) => {
  const redirect = useRedirect();
  const handleClick = () => {
    redirect(`/deals/${deal.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  return (
    <div
      className="cursor-pointer"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
    >
      <RecordContextProvider value={deal}>
        <Card
          className={`py-3 transition-all duration-200 ${
            snapshot?.isDragging
              ? "opacity-90 transform rotate-1 shadow-lg"
              : "shadow-sm hover:shadow-md"
          }`}
        >
          <CardContent className="px-3 flex flex-col">
            <div className="flex-1 flex">
              <p className="flex-1 text-sm font-medium mb-2">
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  link={false}
                />
                {" - "}
                {deal.name}
              </p>
              <ReferenceField
                source="company_id"
                reference="companies"
                link={false}
              >
                <CompanyAvatar width={20} height={20} />
              </ReferenceField>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <NumberField
                source="amount"
                options={{
                  notation: "compact",
                  maximumFractionDigits: 1,
                }}
              />
              {deal.updated_at && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" aria-hidden />
                  <ShortDate value={deal.updated_at} className="text-xs" />
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};
