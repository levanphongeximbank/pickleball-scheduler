import { ROLES, normalizeRole } from "../../../auth/roles.js";

export function isCourtOwnerCandidate(user) {
  const role = normalizeRole(user?.role);
  return [ROLES.COURT_OWNER, ROLES.TENANT_OWNER].includes(role);
}
