import { useRef, useState } from "react";
import { addDays, endOfDay, format, isToday, startOfDay } from "date-fns";
import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DashboardCard, DashboardCardTitle } from "./DashboardCard";
import { SCHEDULE_ANCHOR } from "./DashboardHero";
import { CallbacksList, CallsList, TasksDueList } from "./ScheduleLists";

type ScheduleTab = "calls" | "tasks" | "callbacks";

export interface ScheduleDay {
  /** YYYY-MM-DD (local), the call queue's assignment date format. */
  date: string;
  startIso: string;
  endIso: string;
  isToday: boolean;
}

const toScheduleDay = (day: Date): ScheduleDay => ({
  date: format(day, "yyyy-MM-dd"),
  startIso: startOfDay(day).toISOString(),
  endIso: endOfDay(day).toISOString(),
  isToday: isToday(day),
});

/** Left column: the selected day's calls, tasks and scheduled callbacks. */
export const SchedulePanel = () => {
  const translate = useTranslate();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [tab, setTab] = useState<ScheduleTab>("calls");
  const dateInputRef = useRef<HTMLInputElement>(null);
  const scheduleDay = toScheduleDay(day);

  return (
    <DashboardCard
      id={SCHEDULE_ANCHOR}
      className="flex max-h-[30rem] min-h-64 scroll-mt-20 flex-col gap-4 p-4 xl:absolute xl:inset-0 xl:max-h-none"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex shrink-0 items-center gap-1 rounded-full border border-border bg-background p-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label={translate("crm.dashboard.home.previous_day", {
              _: "Previous day",
            })}
            onClick={() => setDay((current) => addDays(current, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.()}
            className="cursor-pointer rounded-full px-1.5 text-xs font-medium whitespace-nowrap hover:underline"
            title={translate("crm.dashboard.home.pick_day", {
              _: "Pick a day",
            })}
          >
            {scheduleDay.isToday
              ? translate("crm.dashboard.panel.today")
              : day.toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={scheduleDay.date}
            onChange={(event) =>
              event.target.value &&
              setDay(startOfDay(new Date(`${event.target.value}T00:00:00`)))
            }
            className="sr-only"
            tabIndex={-1}
            aria-label={translate("crm.dashboard.home.pick_day", {
              _: "Pick a day",
            })}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label={translate("crm.dashboard.home.next_day", {
              _: "Next day",
            })}
            onClick={() => setDay((current) => addDays(current, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <DashboardCardTitle className="mr-auto ml-1 min-w-0 truncate">
          {translate("crm.dashboard.home.schedule", { _: "Schedule" })}
        </DashboardCardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={translate("crm.dashboard.home.more", {
                  _: "More options",
                })}
              />
            }
          >
            <MoreHorizontal aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDay(startOfDay(new Date()))}>
              {translate("crm.dashboard.home.back_to_today", {
                _: "Back to today",
              })}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/call_assignments" />}>
              {translate("crm.dashboard.home.open_call_queue", {
                _: "Open my call queue",
              })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as ScheduleTab)}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <TabsList className="w-full">
          <TabsTrigger value="calls">
            {translate("crm.dashboard.home.tab_calls", { _: "Calls" })}
          </TabsTrigger>
          <TabsTrigger value="tasks">
            {translate("resources.tasks.name", { smart_count: 2 })}
          </TabsTrigger>
          <TabsTrigger value="callbacks">
            {translate("crm.dashboard.home.tab_callbacks", { _: "Callbacks" })}
          </TabsTrigger>
        </TabsList>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
          <TabsContent value="calls">
            <CallsList day={scheduleDay} />
          </TabsContent>
          <TabsContent value="tasks">
            <TasksDueList day={scheduleDay} />
          </TabsContent>
          <TabsContent value="callbacks">
            <CallbacksList day={scheduleDay} />
          </TabsContent>
        </div>
      </Tabs>
    </DashboardCard>
  );
};
