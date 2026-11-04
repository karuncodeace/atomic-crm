import { useTranslate } from "ra-core";
import { Card } from "@/components/ui/card";

import { TopToolbar } from "../layout/TopToolbar";
import { AddTask } from "./AddTask";
import { TasksListContent } from "./TasksListContent";

/** Full-page tasks list for the desktop sidebar entry. */
export const TasksPage = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {translate("resources.tasks.name", { smart_count: 2 })}
        </h1>
        <TopToolbar>
          <AddTask selectContact />
        </TopToolbar>
      </div>
      <Card className="p-4">
        <TasksListContent />
      </Card>
    </div>
  );
};
