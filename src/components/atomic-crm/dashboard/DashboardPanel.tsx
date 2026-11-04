import { useState } from "react";
import { useGetIdentity, useTranslate } from "ra-core";
import { CalendarDays } from "lucide-react";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { TasksList } from "./TasksList";
import { WeekAgenda } from "./WeekAgenda";

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const ProfileCard = () => {
  const { identity, isPending } = useGetIdentity();
  const translate = useTranslate();

  if (isPending) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }
  if (!identity) return null;

  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <Avatar className="size-20">
        {identity.avatar ? <AvatarImage src={identity.avatar} alt="" /> : null}
        <AvatarFallback className="text-xl font-medium">
          {getInitials(identity.fullName ?? "")}
        </AvatarFallback>
        <AvatarBadge className="size-4! bg-success ring-4 ring-panel" />
      </Avatar>
      <div className="space-y-1">
        <p className="text-base font-semibold">{identity.fullName}</p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          {translate("crm.dashboard.panel.online")}
        </p>
      </div>
    </div>
  );
};

const PanelContent = () => {
  const [showAllTasks, setShowAllTasks] = useState(false);
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-6">
      <ProfileCard />
      <WeekAgenda />
      {showAllTasks ? <TasksList /> : null}
      <Button
        type="button"
        variant="outline"
        className="w-full bg-transparent"
        aria-expanded={showAllTasks}
        onClick={() => setShowAllTasks((value) => !value)}
      >
        {translate(
          showAllTasks
            ? "crm.dashboard.panel.hide_tasks"
            : "crm.dashboard.panel.all_tasks",
        )}
      </Button>
    </div>
  );
};

/** Inset gray panel shown beside the dashboard on wide screens. */
export const DashboardPanel = () => (
  <aside className="hidden rounded-3xl bg-panel p-5 xl:block">
    <PanelContent />
  </aside>
);

/** On narrower screens the same panel opens as a slide-over drawer. */
export const DashboardPanelDrawer = () => {
  const translate = useTranslate();
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 xl:hidden" />
        }
      >
        <CalendarDays aria-hidden />
        {translate("crm.dashboard.panel.open")}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(22rem,100vw)] overflow-y-auto bg-panel p-5"
      >
        <SheetHeader className="p-0">
          <SheetTitle>{translate("crm.dashboard.panel.title")}</SheetTitle>
        </SheetHeader>
        <PanelContent />
      </SheetContent>
    </Sheet>
  );
};
