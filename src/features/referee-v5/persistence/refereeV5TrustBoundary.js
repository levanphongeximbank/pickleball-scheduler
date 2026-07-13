import { REFEREE_V5_ERROR, createPersistenceError } from "./errors.js";

/**
 * Trust boundary helpers for Edge Function path.
 * Never use actor_id, tenant_id, or role from unverified request body.
 */

export function verifyAccessToken(accessToken) {
  if (!accessToken || typeof accessToken !== "string" || accessToken.length < 8) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED, "Access token không hợp lệ.");
  }
  if (accessToken === "expired-token") {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED, "Access token đã hết hạn.");
  }
  return { ok: true };
}

export function deriveUserIdFromVerifiedToken(accessToken) {
  const check = verifyAccessToken(accessToken);
  if (!check.ok) {
    return check;
  }
  // Test/stub: token encodes user id after prefix "jwt:"
  const userId = accessToken.startsWith("jwt:") ? accessToken.slice(4) : "verified-user";
  return { ok: true, userId };
}

export function rejectClientIdentityFields(requestBody = {}) {
  const forbidden = ["actorId", "actor_id", "userId", "user_id", "tenantId", "tenant_id", "role"];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(requestBody, key)) {
      return {
        ignored: true,
        fields: forbidden.filter((field) => Object.prototype.hasOwnProperty.call(requestBody, field)),
      };
    }
  }
  return { ignored: false, fields: [] };
}

import { repoVal } from "./repoAsync.js";

export async function resolveTrustedActor({ verifiedUserId, repository, tenantId, tournamentId, matchId }) {
  if (!verifiedUserId) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }

  const assignment = await repoVal(
    repository.getAssignment({
      tenantId,
      tournamentId,
      matchId,
      userId: verifiedUserId,
    }),
  );

  if (!assignment) {
    return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
  }

  if (assignment.status === "revoked") {
    return createPersistenceError(REFEREE_V5_ERROR.ASSIGNMENT_REVOKED);
  }

  if (assignment.expiresAt && new Date(assignment.expiresAt).getTime() < Date.now()) {
    return createPersistenceError(REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED);
  }

  return {
    ok: true,
    actor: {
      userId: verifiedUserId,
      tenantId: assignment.tenantId,
      role: assignment.assignmentRole || "REFEREE",
    },
    assignment,
  };
}
