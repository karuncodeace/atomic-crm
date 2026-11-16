import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const initialsOf = (firstName?: string, lastName?: string) =>
  `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";

/** Small round avatar for a sales user: photo, or initials on a warm chip. */
export const PersonAvatar = ({
  firstName,
  lastName,
  avatar,
  className,
}: {
  firstName?: string;
  lastName?: string;
  /** Only the image URL is used (a sales RAFile fits). */
  avatar?: { src?: string } | null;
  className?: string;
}) => (
  <Avatar
    className={cn("size-7", className)}
    title={[firstName, lastName].filter(Boolean).join(" ")}
  >
    {avatar?.src ? <AvatarImage src={avatar.src} alt="" /> : null}
    <AvatarFallback className="bg-brand-soft text-[10px] font-semibold text-foreground">
      {initialsOf(firstName, lastName)}
    </AvatarFallback>
  </Avatar>
);
