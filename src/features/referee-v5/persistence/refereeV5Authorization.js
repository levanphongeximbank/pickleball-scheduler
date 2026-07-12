import { REFEREE_V5_ERROR, createPersistenceError } from "./errors.js";

export function authorizeRefereeAccess(context) {
  const { actor, assignment, tenantId } = context;

  if (!actor?.userId) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED, "Thiếu actor.");
  }

  if (String(actor.tenantId) !== String(tenantId)) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }

  if (actor.role === "SUPER_ADMIN") {
    return { ok: true, role: "SUPER_ADMIN" };
  }

  if (!assignment) {
    return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
  }

  if (assignment.status === "revoked") {
    return createPersistenceError(REFEREE_V5_ERROR.ASSIGNMENT_REVOKED);
  }

  if (assignment.expiresAt && new Date(assignment.expiresAt).getTime() < Date.now()) {
    return createPersistenceError(REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED);
  }

  if (String(assignment.userId) !== String(actor.userId)) {
    return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
  }

  return { ok: true, role: assignment.assignmentRole || "REFEREE" };
}

export function canReadMatch(context) {
  return authorizeRefereeAccess(context);
}

export function canWriteMatch(context) {
  const auth = authorizeRefereeAccess(context);
  if (!auth.ok) {
    return auth;
  }
  if (auth.role === "SCOREKEEPER") {
    return { ok: true, role: auth.role, readOnly: false };
  }
  return auth;
}

export function assertClientCannotDirectInsert(tableName) {
  return createPersistenceError(
    REFEREE_V5_ERROR.TENANT_ACCESS_DENIED,
    `Client không được ${tableName} trực tiếp.`
  );
}
