import { useMemo, useState } from "react";
import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { useGetIdentity, useGetList, useGetMany, useTranslate } from "ra-core";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CalendarCheck,
  Mail,
  Phone,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Avatar } from "../contacts/Avatar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Task } from "../types";

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;
const GROUP_TYPES = new Set(["meeting", "demo", "lunch"]);

const getTaskIcon = (type: string): LucideIcon => {
  if (GROUP_TYPES.has(type)) return Users;
  if (type === "call") return Phone;
  if (type === "email") return Mail;
  return UserRound;
};

const hasTime = (date: Date) =>
  date.getHours() !== 0 || date.getMinutes() !== 0;

/** Week strip + the current user's tasks due on the selected day. */
export const WeekAgenda = () => {
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const { identity } = useGetIdentity();
  const translate = useTranslate();

  const weekStart = startOfWeek(selectedDay, WEEK_OPTIONS);
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );

  const { data: tasks, isPending } = useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "due_date", order: "ASC" },
      filter: {
        sales_id: identity?.id,
        "due_date@gte": weekStart.toISOString(),
        "due_date@lte": endOfWeek(selectedDay, WEEK_OPTIONS).toISOString(),
      },
    },
    { enabled: identity?.id != null },
  );

  const dayTasks = useMemo(
    () =>
      (tasks ?? []).filter((task) =>
        isSameDay(new Date(task.due_date), selectedDay),
      ),
    [tasks, selectedDay],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-medium">
          {format(selectedDay, "MMMM yyyy")}
        </h2>
        {!isToday(selectedDay) ? (
          <button
            type="button"
            onClick={() => setSelectedDay(startOfDay(new Date()))}
            className="rounded-full text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {translate("crm.dashboard.panel.today")}
          </button>
        ) : null}
      </div>

      <div
        role="group"
        aria-label={translate("crm.dashboard.panel.week")}
        className="grid grid-cols-7 gap-1"
      >
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDay);
          const hasTasks = (tasks ?? []).some((task) =>
            isSameDay(new Date(task.due_date), day),
          );
          return (
            <button
              key={day.toISOString()}
              type="button"
              aria-pressed={isSelected}
              aria-label={format(day, "EEEE d MMMM")}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl py-2 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-card hover:text-foreground",
              )}
            >
              <span>{format(day, "EEEEE")}</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  !isSelected && isToday(day) && "text-foreground",
                )}
              >
                {format(day, "d")}
              </span>
              <span
                aria-hidden
                className={cn(
                  "size-1 rounded-full",
                  hasTasks
                    ? isSelected
                      ? "bg-primary-foreground"
                      : "bg-foreground/60"
                    : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      <AgendaList tasks={dayTasks} isPending={isPending} />
    </section>
  );
};

const AgendaList = ({
  tasks,
  isPending,
}: {
  tasks: Task[];
  isPending: boolean;
}) => {
  const translate = useTranslate();
  const { data: contacts } = useGetMany<Contact>(
    "contacts",
    { ids: [...new Set(tasks.map((task) => task.contact_id))] },
    { enabled: tasks.length > 0 },
  );

  if (isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-2xl bg-card" />
        ))}
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-4 py-6 text-center">
        <CalendarCheck className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          {translate("crm.dashboard.panel.empty_day")}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <AgendaItem
            task={task}
            contact={contacts?.find((c) => c.id === task.contact_id)}
          />
        </li>
      ))}
    </ul>
  );
};

const AgendaItem = ({ task, contact }: { task: Task; contact?: Contact }) => {
  const { taskTypes } = useConfigurationContext();
  const Icon = getTaskIcon(task.type);
  const due = new Date(task.due_date);
  const typeLabel =
    taskTypes.find((type) => type.value === task.type)?.label ?? task.type;
  const meta = [
    task.type && task.type !== "none" ? typeLabel : null,
    hasTime(due) ? format(due, "p") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const isDone = !!task.done_date;

  return (
    <Link
      to={`/contacts/${task.contact_id}/show`}
      className="flex items-center gap-3 rounded-2xl bg-card p-3 text-foreground no-underline transition-colors outline-none hover:bg-card/70 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-medium",
            isDone && "text-muted-foreground line-through",
          )}
        >
          {task.text}
        </span>
        {meta ? (
          <span className="block truncate text-xs text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </span>
      {contact ? (
        <Avatar
          record={contact}
          width={25}
          height={25}
          title={`${contact.first_name} ${contact.last_name}`}
        />
      ) : null}
    </Link>
  );
};
