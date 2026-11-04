import { useState } from "react";
import { ChevronDown, Plus, Upload } from "lucide-react";
import { CanAccess, useTranslate } from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { LeadImportDialog } from "../leads/LeadImportButton";

/** Desktop app bar shortcut — create a lead or import a CSV. */
export const NewRecordButton = () => {
  const translate = useTranslate();
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  return (
    <>
      <div className="flex items-stretch">
        <Button
          size="sm"
          className="gap-1.5 rounded-r-none"
          render={<Link to="/companies/create" />}
        >
          <Plus />
          {translate("resources.companies.action.new", { _: "New Company" })}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="sm"
                className="rounded-l-none border-l border-primary-foreground/20 px-2"
                aria-label={translate("resources.companies.action.more", {
                  _: "More create options",
                })}
              />
            }
          >
            <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              render={<Link to="/companies/create" />}
            >
              <Plus className="size-4" />
              {translate("resources.companies.action.create_one", {
                _: "Create one",
              })}
            </DropdownMenuItem>
            <CanAccess resource="lead_import" action="create">
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="size-4" />
                {translate("crm.lead_import.button", { _: "Import leads" })}
              </DropdownMenuItem>
            </CanAccess>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <LeadImportDialog
        open={importOpen}
        busy={importBusy}
        setBusy={setImportBusy}
        onClose={() => !importBusy && setImportOpen(false)}
      />
    </>
  );
};
