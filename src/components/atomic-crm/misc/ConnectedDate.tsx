import { useTranslate } from "ra-core";
import { cn } from "@/lib/utils";

/**
 * When the lead last answered a call ("Nov 14", with the year when it is not
 * the current one), or "Not connected yet". Used by the leads table and the
 * daily call list in place of the created date.
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
  const date = new Date(value);
  const fullDate = date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const label = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "Asia/Kolkata",
  });
  return (
    <span
      title={fullDate}
      className={cn(
        "text-sm whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
};
