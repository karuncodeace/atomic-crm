import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useCanAccess, useNotify, useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { AsideSection } from "../misc/AsideSection";
import { formatLocalizedDate } from "../misc/RelativeDate";
import { engineFetch } from "./axicore";

type Doc = {
  id: number;
  kind: "script" | "brochure" | "proposal";
  title: string;
  status: string;
  source: string | null;
  updated_at: string;
  pdf: string | null;
  error?: string | null;
  detail?: string | null;
  can_retry?: boolean;
};
const KIND: Record<Doc["kind"], string> = {
  script: "SWOT",
  brochure: "Brochure",
  proposal: "Proposal",
};

/**
 * The documents AxiCore made for this company (SWOT, brochure, proposal), for every CRM user.
 * Admins and managers also get a link to open each one in AxiCore 2.0.
 * A document the AI could not make shows why and a Try again button (owner, 2026-11-13: "if any AI is failed or
 * any error show a try again button in crm"); AxiCore never fills in default text instead.
 */
export const CompanyDocuments = ({
  companyId,
}: {
  companyId: number | string;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const { canAccess } = useCanAccess({ resource: "axicore", action: "access" });
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);

  const load = useCallback(
    () =>
      engineFetch(`/api/axicore/company/${companyId}/docs`).then(
        (r) => setDocs(r?.docs || []),
        (e) => setError(e.message),
      ),
    [companyId],
  );
  useEffect(() => {
    load();
  }, [load]);

  // newest one per kind; older versions are reachable in AxiCore 2.0
  const latest = docs
    ? ((["script", "brochure", "proposal"] as const)
        .map((k) => docs.find((d) => d.kind === k))
        .filter(Boolean) as Doc[])
    : [];
  const working = latest.some((d) => d.status === "working");
  // while something is being made, look again every 15 s
  useEffect(() => {
    if (!working) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [working, load]);

  const tryAgain = async (d: Doc) => {
    setRetrying(d.id);
    try {
      await engineFetch(`/api/axicore/docs/${d.id}/retry`, { method: "POST" });
      notify(`${KIND[d.kind]}: being made again`, { type: "info" });
      await load();
    } catch (e) {
      notify(`${KIND[d.kind]}: ${(e as Error).message}`, { type: "error" });
    } finally {
      setRetrying(null);
    }
  };

  const title = translate("crm.axicore.documents", {
    _: "Documents (AxiCore)",
  });
  if (error) {
    return (
      <AsideSection title={title}>
        <p className="text-muted-foreground">
          Documents are not available right now.
        </p>
      </AsideSection>
    );
  }
  if (!docs) return null;

  return (
    <AsideSection title={title}>
      {latest.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing made for this company yet.
        </p>
      ) : (
        latest.map((d) => {
          // a failed newest version: the last finished one stays available
          const lastGood =
            d.status !== "ready"
              ? docs.find((x) => x.kind === d.kind && x.status === "ready")
              : null;
          return (
            <div key={d.id} className="py-1">
              <div className="flex items-center gap-2">
                <div className="grow min-w-0">
                  <div className="font-medium">{KIND[d.kind]}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {d.status === "ready"
                      ? "Ready"
                      : d.status === "working"
                        ? "Being made…"
                        : "Failed"}
                    {d.status === "ready" && d.source === "claude"
                      ? " · written by Claude"
                      : ""}{" "}
                    · {formatLocalizedDate(d.updated_at)}
                  </div>
                </div>
                {d.pdf ? (
                  <a
                    className="text-xs underline"
                    href={d.pdf}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF
                  </a>
                ) : lastGood?.pdf ? (
                  <a
                    className="text-xs underline"
                    href={lastGood.pdf}
                    target="_blank"
                    rel="noreferrer"
                    title="The last finished version"
                  >
                    Last PDF
                  </a>
                ) : null}
                {canAccess ? (
                  <Link
                    className="text-xs underline"
                    to={`/axicore/${d.kind}/${d.id}`}
                  >
                    Open
                  </Link>
                ) : null}
              </div>
              {d.status === "error" ? (
                <div className="mt-1 flex items-start gap-2">
                  <p
                    className="grow text-xs text-destructive"
                    title={d.detail || undefined}
                  >
                    {d.error || "The AI could not make it."}
                  </p>
                  {d.can_retry ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 text-xs"
                      disabled={retrying === d.id}
                      onClick={() => tryAgain(d)}
                    >
                      {retrying === d.id ? "Starting…" : "Try again"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </AsideSection>
  );
};
