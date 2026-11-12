import type { SalesRole } from "../../types";
import { canUseAxiCore } from "../../axicore/axicore";

// FIXME: This should be exported from the ra-core package
type CanAccessParams<
  RecordType extends Record<string, any> = Record<string, any>,
> = {
  action: string;
  resource: string;
  record?: RecordType;
};

const ROLES: readonly SalesRole[] = ["admin", "manager", "bde"];

/**
 * The role of a sales record. Records written before roles existed only carry
 * the administrator flag: they map to admin, or to manager (the full access
 * every non-admin user had before).
 */
export const resolveRole = (sale: {
  role?: string | null;
  administrator?: boolean | null;
}): SalesRole => {
  if (sale.role && ROLES.includes(sale.role as SalesRole)) {
    return sale.role as SalesRole;
  }
  return sale.administrator ? "admin" : "manager";
};

/**
 * Every role uses the same menus, except brochures, which BDEs never see.
 * Which rows each role sees is enforced by RLS, not here. Disabled users never
 * get a role from the auth provider, so they never reach canAccess.
 */
export const canAccess = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  role: SalesRole,
  params: CanAccessParams<RecordType>,
) =>
  params.resource === "axicore"
    ? canUseAxiCore(role) // AxiCore 2.0: admins and managers
    : !(role === "bde" && params.resource === "brochures");
