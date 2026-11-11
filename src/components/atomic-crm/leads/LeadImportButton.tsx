import { useCallback, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import * as Papa from "papaparse";
import {
  Form,
  useDataProvider,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";
import { FileField } from "@/components/admin/file-field";
import { FileInput } from "@/components/admin/file-input";
import { FormToolbar } from "@/components/admin/simple-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { CrmDataProvider } from "../providers/types";
import {
  mergeReports,
  prepareLeadRecords,
  rejectsToCsv,
  type LeadImportResult,
} from "./leadImport";

const SAMPLE_CSV = `lead date,company,website,vertical,phone,whatsApp_number,email,Social Media URLs,address,place,priority,business_description,Decision Makers,Category
15/03/2026,Acme Foods,https://acmefoods.in,FMCG,9876543210,9876543210,ravi@acmefoods.in,"https://instagram.com/acmefoods, https://facebook.com/acmefoods",MG Road,Kochi,high,Wholesale spices and oils,"1. Ravi Kumar — Owner — +91 98765 43210
2. Anita Menon — Purchase Manager — +91 98470 12345",E-commerce
`;

/**
 * Imports calling leads from a CSV: company + contact + New-stage deal.
 * Uses `import_leads` (or its FakeRest twin), with client-side column mapping
 * and phone / email normalization first.
 */
export const LeadImportButton = ({
  variant = "outline",
  size = "default",
}: {
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
} = {}) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        disabled={busy}
        className="flex items-center gap-2 cursor-pointer"
      >
        <Upload /> {translate("crm.lead_import.button", { _: "Import leads" })}
      </Button>
      <LeadImportDialog
        open={open}
        busy={busy}
        setBusy={setBusy}
        onClose={() => !busy && setOpen(false)}
      />
    </>
  );
};

export const LeadImportDialog = ({
  open,
  busy,
  setBusy,
  onClose,
}: {
  open: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<LeadImportResult | null>(null);
  const [sourceRows, setSourceRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setReport(null);
      setSourceRows([]);
    }
  }, [open]);

  const sampleUrl = `data:text/csv;name=leads_sample.csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`;

  const handleStart = useCallback(async () => {
    if (!file || busy) return;
    setBusy(true);
    setReport(null);
    try {
      if (typeof dataProvider.importLeads !== "function") {
        throw new Error(
          "Lead import is not available in this build. Redeploy the app.",
        );
      }
      const records = await parseCsvAsText(file);
      const { leads, invalid } = prepareLeadRecords(records);
      setSourceRows(records);
      const server =
        leads.length === 0
          ? {
              batch_id: null,
              created: 0,
              duplicates: 0,
              invalid: 0,
              rows: [],
            }
          : await dataProvider.importLeads(file.name, leads);
      const merged = mergeReports(server, invalid);
      setReport(merged);
      refresh();
      notify("crm.lead_import.complete", {
        type: merged.created > 0 ? "success" : "warning",
        messageArgs: {
          created: merged.created,
          duplicates: merged.duplicates,
          invalid: merged.invalid,
        },
      });
    } catch (error) {
      console.error("lead import failed", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : translate("crm.lead_import.error");
      notify(message, { type: "error" });
    } finally {
      setBusy(false);
    }
  }, [busy, dataProvider, file, notify, refresh, setBusy, translate]);

  const rejectsHref =
    report && sourceRows.length
      ? `data:text/csv;name=leads_rejects.csv;charset=utf-8,${encodeURIComponent(rejectsToCsv(report.rows, sourceRows))}`
      : null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-6 p-6 sm:max-w-2xl sm:p-8">
        <Form className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>
              {translate("crm.lead_import.title", { _: "Import leads" })}
            </DialogTitle>
          </DialogHeader>

          <Alert>
            <AlertDescription className="flex flex-col gap-4">
              {translate("crm.lead_import.sample_hint")}
              <Link
                to={sampleUrl}
                download="leads_sample.csv"
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
              >
                {translate("crm.lead_import.sample_download", {
                  _: "Download CSV sample",
                })}
              </Link>
            </AlertDescription>
          </Alert>

          <FileInput
            source="csv"
            label="crm.lead_import.csv_file"
            accept={{
              "text/csv": [".csv"],
              "application/vnd.ms-excel": [".csv"],
              "text/plain": [".csv"],
            }}
            onChange={(value) => {
              setFile(asBrowserFile(value));
              setReport(null);
            }}
          >
            <FileField source="src" title="title" target="_blank" />
          </FileInput>

          {report && (
            <Alert>
              <AlertDescription>
                {translate("crm.lead_import.summary", {
                  _: "Created %{created}, duplicates %{duplicates}, invalid %{invalid}",
                  created: report.created,
                  duplicates: report.duplicates,
                  invalid: report.invalid,
                })}
                {rejectsHref && report.created < sourceRows.length && (
                  <div className="mt-3">
                    <Link
                      to={rejectsHref}
                      download="leads_rejects.csv"
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-fit",
                      )}
                    >
                      {translate("crm.lead_import.download_rejects", {
                        _: "Download rejects",
                      })}
                    </Link>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </Form>

        <div className="flex justify-start">
          <FormToolbar>
            <Button onClick={handleStart} disabled={!file || busy}>
              {busy
                ? translate("crm.lead_import.in_progress", {
                    _: "Import in progress…",
                  })
                : translate("crm.lead_import.start", { _: "Start import" })}
            </Button>
          </FormToolbar>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** FileInput stores `{ rawFile, src, title }`; Papa needs the browser File. */
const asBrowserFile = (value: unknown): File | null => {
  if (value instanceof File) return value;
  if (
    value &&
    typeof value === "object" &&
    "rawFile" in value &&
    (value as { rawFile: unknown }).rawFile instanceof File
  ) {
    return (value as { rawFile: File }).rawFile;
  }
  return null;
};

const parseCsvAsText = (file: File) =>
  new Promise<Record<string, unknown>[]>((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      // Keep phone / zip / dates as strings (no dynamic typing).
      dynamicTyping: false,
      complete(results) {
        if (results.errors.length && !results.data.length) {
          reject(
            new Error(
              results.errors[0]?.message || "Could not parse this CSV file",
            ),
          );
          return;
        }
        resolve(results.data);
      },
      error(error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    });
  });
