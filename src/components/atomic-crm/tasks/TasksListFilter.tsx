import {
  ListContextProvider,
  ResourceContextProvider,
  useList,
  useTranslate,
} from "ra-core";

import { TasksIterator } from "./TasksIterator";

/** Same cap as the tasks fetch in TasksListByDueDate. */
const SHOW_ALL_PER_PAGE = 1000;

type TaskListProps = {
  tasks: any[];
  title: string;
  showContact?: boolean;
  isMobile: boolean;
  /** Show every task at once instead of a first page and "Load more". */
  showAll?: boolean;
};

export const TaskListFilter = ({
  tasks,
  title,
  showContact,
  isMobile,
  showAll = false,
}: TaskListProps) => {
  const translate = useTranslate();
  const listContext = useList({
    data: tasks,
    resource: "tasks",
    perPage: showAll ? SHOW_ALL_PER_PAGE : isMobile ? 10 : 5,
  });

  const { total } = listContext;

  if (!tasks?.length || !total) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
        {title}
      </p>
      <ResourceContextProvider value="tasks">
        <ListContextProvider value={listContext}>
          <TasksIterator showContact={showContact} />
        </ListContextProvider>
      </ResourceContextProvider>
      {total > listContext.perPage && (
        <div className="flex justify-center">
          <a
            href="#"
            onClick={(e) => {
              listContext.setPerPage(listContext.perPage + 10);
              e.preventDefault();
            }}
            className="text-sm underline hover:no-underline"
          >
            {translate("crm.common.load_more")}
          </a>
        </div>
      )}
    </div>
  );
};
