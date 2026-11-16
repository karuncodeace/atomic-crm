import { useState } from "react";
import { Upload } from "lucide-react";
import { CanAccess, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";

import { LeadImportDialog } from "../leads/LeadImportButton";

/**
 * Desktop app bar shortcut: import leads from a CSV (roles allowed to).
 * The "New company" button was removed on request (owner, 2026-11-16).
 */
export const NewRecordButton = () => {
  const translate = useTranslate();
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  return (
    <CanAccess resource="lead_import" action="create">
      <Button size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
        <Upload />
        {translate("crm.lead_import.button", { _: "Import leads" })}
      </Button>
      <LeadImportDialog
        open={importOpen}
        busy={importBusy}
        setBusy={setImportBusy}
        onClose={() => !importBusy && setImportOpen(false)}
      />
    </CanAccess>
  );
};
