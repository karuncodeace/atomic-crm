import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useCanAccess, useTranslate } from "ra-core";

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
};
const KIND: Record<Doc["kind"], string> = {
  script: "SWOT",
  brochure: "Brochure",
  proposal: "Proposal",
};

/**
 * The documents AxiCore made for this company (call script, brochure, proposal), for every CRM user.
 * Admins and managers also get a link to open each one in AxiCore 2.0.
 */
export const CompanyDocuments = ({
  companyId,
}: {
  companyId: number | string;
}) => {
  const translate = useTranslate();
  const { canAccess } = useCanAccess({ resource: "axicore", action: "access" });
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    engineFetch(`/api/axicore/company/${companyId}/docs`)
      .then((r) => live && setDocs(r?.docs || []))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [companyId]);

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
  // newest ready one per kind first, older versions are reachable in AxiCore 2.0
  const latest = (["script", "brochure", "proposal"] as const)
    .map((k) => docs.find((d) => d.kind === k))
    .filter(Boolean) as Doc[];

  return (
    <AsideSection title={title}>
      {latest.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing made for this company yet.
        </p>
      ) : (
        latest.map((d) => (
          <div key={d.id} className="flex items-center gap-2 py-1">
            <div className="grow min-w-0">
              <div className="font-medium">{KIND[d.kind]}</div>
              <div className="text-xs text-muted-foreground truncate">
                {d.status === "ready"
                  ? "Ready"
                  : d.status === "working"
                    ? "Being made"
                    : "Failed"}
                {d.source === "claude" ? " · written by Claude" : ""} ·{" "}
                {formatLocalizedDate(d.updated_at)}
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
        ))
      )}
    </AsideSection>
  );
};
