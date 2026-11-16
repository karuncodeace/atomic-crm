import { useTranslate } from "ra-core";
import { Card } from "@/components/ui/card";

import { TopToolbar } from "../layout/TopToolbar";
import { PageHeader } from "../misc/PageHeader";
import { AddTask } from "./AddTask";
import { TasksListContent } from "./TasksListContent";

/** Full-page tasks list for the desktop sidebar entry. */
export const TasksPage = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="mb-0"
        title={translate("resources.tasks.name", { smart_count: 2 })}
        actions={
          <TopToolbar>
            <AddTask selectContact />
          </TopToolbar>
        }
      />
      <Card className="p-4">
        <TasksListContent />
      </Card>
    </div>
  );
};
