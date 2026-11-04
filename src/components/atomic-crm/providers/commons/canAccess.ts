import type { SalesRole } from "../../types";

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
 * Shared product: BDE and admin (and manager) use the same menus and see the
 * same data. Disabled users never get a role from the auth provider, so they
 * never reach canAccess.
 */
export const canAccess = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  _role: SalesRole,
  _params: CanAccessParams<RecordType>,
) => true;
