import { useTranslate } from "ra-core";
import { cn } from "@/lib/utils";

import { ShortDate } from "./ShortDate";

/**
 * When the lead last answered a call, or "Not connected yet". Used by the
 * daily call list.
 */
export const ConnectedDate = ({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) => {
  const translate = useTranslate();
  if (!value) {
    return (
      <span
        className={cn(
          "text-sm whitespace-nowrap text-muted-foreground/60 italic",
          className,
        )}
      >
        {translate("crm.common.not_connected_yet", { _: "Not connected yet" })}
      </span>
    );
  }
  return <ShortDate value={value} className={className} />;
};
