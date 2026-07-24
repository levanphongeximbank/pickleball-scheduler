/**
 * Authorize Organizer commands via E2E-01 Identity port + CORE-02.
 * Never trusts client-sent grantedPermissions.
 */

import { authorizeCompetitionAction } from "../../integration/composition/createCompetitionRuntimePorts.js";
import { ORGANIZER_ERROR_CODE } from "../constants.js";
import { failOrganizer } from "../errors.js";
import { isNonEmptyString } from "../fingerprint.js";
import {
  isKnownOrganizerAction,
  resolveOrganizerActionPermissions,
} from "../permissions/organizerActionMap.js";

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asObject(value) {
  return value && typeof value === "object"
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * Reject client-supplied grants before evidence resolution.
 * @param {unknown} actor
 * @param {unknown} context
 */
export function rejectClientGrantedPermissions(actor, context) {
  const a = asObject(actor);
  const c = asObject(context);
  if (
    Array.isArray(a.grantedPermissions) ||
    Array.isArray(c.grantedPermissions) ||
    Array.isArray(asObject(c.subject).grantedPermissions)
  ) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED,
      "Client-supplied grantedPermissions are never trusted",
      { failClosed: true }
    );
  }
}

/**
 * @param {{
 *   action: string,
 *   actor: { actorId?: string, role?: string, [k: string]: unknown },
 *   tenantId: string,
 *   competitionId: string,
 *   venueId?: string|null,
 *   runtimePorts: { authorize?: Function, requireIntegrationContext?: Function, identityEvidencePort?: unknown },
 *   context?: Record<string, unknown>,
 * }} input
 */
export async function authorizeOrganizerCommand(input) {
  const action = String(input.action || "").trim();
  const actor = asObject(input.actor);
  const context = asObject(input.context);
  const tenantId = String(input.tenantId || "").trim();
  const competitionId = String(input.competitionId || "").trim();
  const venueId = isNonEmptyString(input.venueId)
    ? String(input.venueId).trim()
    : null;

  rejectClientGrantedPermissions(actor, context);

  if (!isNonEmptyString(actor.actorId)) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.MISSING_IDENTITY,
      "actor.actorId is required",
      {}
    );
  }
  if (!isNonEmptyString(actor.role)) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.MISSING_IDENTITY,
      "actor.role is required",
      {}
    );
  }
  if (!tenantId) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.MISSING_TENANT,
      "tenantId is required",
      {}
    );
  }
  if (!competitionId) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.MISSING_COMPETITION,
      "competitionId is required",
      {}
    );
  }
  if (!isKnownOrganizerAction(action)) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.INVALID_INPUT,
      `Unknown organizer action: ${action || "(empty)"}`,
      { action }
    );
  }

  const mapping = resolveOrganizerActionPermissions(action);
  if (mapping.requireVenue && !venueId) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.MISSING_VENUE,
      "venueId is required for this organizer action",
      { action, capability: mapping.capability }
    );
  }

  const ports = input.runtimePorts;
  if (!ports || typeof ports !== "object") {
    failOrganizer(
      ORGANIZER_ERROR_CODE.INVALID_INPUT,
      "runtimePorts bag is required",
      {}
    );
  }

  const subject = Object.freeze({
    actorId: String(actor.actorId).trim(),
    role: String(actor.role).trim(),
  });
  const scope = Object.freeze({
    tenantId,
    competitionId,
    ...(venueId ? { venueId } : {}),
  });

  if (typeof ports.requireIntegrationContext === "function") {
    ports.requireIntegrationContext({
      subject,
      scope,
      requireRole: true,
      requireVenue: mapping.requireVenue,
      requireClub: false,
    });
  }

  const authorize =
    typeof ports.authorize === "function"
      ? ports.authorize
      : (request) =>
          authorizeCompetitionAction(request, {
            evidencePort: ports.identityEvidencePort,
          });

  const decision = await authorize({
    subject,
    scope,
    action,
    requiredPermissions: [...mapping.requiredPermissions],
    context: Object.freeze({
      requireVenue: mapping.requireVenue,
      capability: mapping.capability,
      organizerAction: action,
      // Explicitly ignore any client grants that might have been nested.
      clientGrantsIgnored: true,
    }),
  });

  if (!decision || decision.allowed !== true) {
    const denyCode = String(
      decision?.denyReason || decision?.decisionCode || "PERMISSION_DENIED"
    );
    if (/CROSS_TENANT|SCOPE_MISMATCH/i.test(denyCode)) {
      failOrganizer(
        ORGANIZER_ERROR_CODE.CROSS_TENANT_REJECTED,
        decision?.reason || "Cross-tenant organizer action rejected",
        { action, capability: mapping.capability, decision }
      );
    }
    failOrganizer(
      ORGANIZER_ERROR_CODE.PERMISSION_DENIED,
      decision?.reason || `Permission denied for ${mapping.capability}`,
      {
        action,
        capability: mapping.capability,
        requiredPermissions: [...mapping.requiredPermissions],
        decision,
      }
    );
  }

  return Object.freeze({
    allowed: true,
    action,
    capability: mapping.capability,
    requiredPermissions: [...mapping.requiredPermissions],
    subject,
    scope,
    decision,
  });
}
