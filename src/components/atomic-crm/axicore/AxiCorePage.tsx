import { useEffect } from "react";
import { useCanAccess } from "ra-core";
import { useLocation } from "react-router";

import { AXICORE_APP } from "./axicore";

/**
 * /axicore/* : AxiCore 2.0 opens as its own full page (owner, 2026-11-06), not inside the CRM layout.
 * This route only forwards: /axicore/brochure/12 → /axicore-app/#/brochure/12 (links from the Documents panel).
 */
export const AxiCorePage = () => {
  const { canAccess, isPending } = useCanAccess({
    resource: "axicore",
    action: "access",
  });
  const location = useLocation();
  const sub = location.pathname.replace(/^\/axicore\/?/, "") || "tools";
  useEffect(() => {
    if (canAccess) window.location.assign(`${AXICORE_APP}#/${sub}`);
  }, [canAccess, sub]);
  if (isPending || canAccess) return null;
  return (
    <div className="p-8 text-sm text-muted-foreground">
      AxiCore 2.0 is for admins and managers. Ask an admin to change your role
      in Users.
    </div>
  );
};

AxiCorePage.path = "/axicore/*";
