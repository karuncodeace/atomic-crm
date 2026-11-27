import { cn } from "@/lib/utils";

/**
 * A compact date ("Nov 14", with the year when it is not the current one),
 * the full date and time in its tooltip. India time.
 */
export const ShortDate = ({
  value,
  className,
}: {
  value: string;
  className?: string;
}) => {
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
