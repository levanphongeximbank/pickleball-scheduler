/**
 * CORE-06 Phase 1E — fail-closed lineup visibility projection.
 * No UI-only hiding. No opponent reveal before authorization.
 */

import {
  createLineupVisibilityProjection,
  LINEUP_PROJECTION_FIELD,
} from "../contracts/visibilityProjection.js";
import {
  LINEUP_VISIBILITY_STATE,
  normalizeLineupVisibilityState,
} from "../contracts/lineupVisibilityState.js";
import { createLineupPolicyResult } from "../contracts/lineupPolicy.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { createDefaultLineupHardeningPolicy } from "../contracts/lineupHardeningPolicy.js";

/**
 * @param {object} request
 * @returns {string}
 */
function resolveRelationship(request) {
  const viewerTeamId =
    request.viewerScope && typeof request.viewerScope === "object"
      ? String(
          /** @type {{ teamId?: unknown }} */ (request.viewerScope).teamId || ""
        ).trim()
      : "";
  const ownerTeamId =
    request.lineup && typeof request.lineup === "object"
      ? String(
          /** @type {{ teamId?: unknown }} */ (request.lineup).teamId || ""
        ).trim()
      : "";

  const claimed =
    request.relationship != null && String(request.relationship).trim() !== ""
      ? String(request.relationship).trim().toUpperCase()
      : "";

  // Scope-validated relationships — never trust role/relationship name alone.
  if (claimed === "OWN_TEAM" || (!claimed && viewerTeamId && ownerTeamId)) {
    if (viewerTeamId && ownerTeamId && viewerTeamId === ownerTeamId) {
      return "OWN_TEAM";
    }
    if (claimed === "OWN_TEAM") {
      return ""; // claimed own-team without matching team scope → fail closed
    }
  }

  if (claimed === "OPPONENT") {
    if (viewerTeamId && ownerTeamId && viewerTeamId !== ownerTeamId) {
      return "OPPONENT";
    }
    return "";
  }

  if (claimed === "OFFICIAL" || claimed === "PUBLIC") {
    return claimed;
  }

  if (claimed) {
    return "";
  }

  return "";
}

/**
 * @param {object} request
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
function assertScopes(request) {
  const lineup =
    request.lineup && typeof request.lineup === "object" ? request.lineup : null;
  const viewerScope =
    request.viewerScope && typeof request.viewerScope === "object"
      ? request.viewerScope
      : null;
  const competitionScope =
    request.competitionScope && typeof request.competitionScope === "object"
      ? request.competitionScope
      : null;

  if (!viewerScope) {
    return {
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_UNKNOWN_VIEWER_SCOPE,
      message: "Viewer scope is required",
    };
  }

  const viewerRole = String(viewerScope.role || viewerScope.viewerRole || "")
    .trim();
  // Role name alone never authorizes — relationship must resolve via scope validation.
  const relationship = resolveRelationship(request);
  if (!viewerRole && !relationship) {
    return {
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_UNKNOWN_VIEWER_SCOPE,
      message: "Unknown viewer role or relationship",
    };
  }
  void relationship;

  const lineupTenant = lineup ? String(lineup.tenantId || "").trim() : "";
  const viewerTenant = String(viewerScope.tenantId || "").trim();
  const competitionTenant = competitionScope
    ? String(competitionScope.tenantId || "").trim()
    : viewerTenant;

  if (!viewerTenant || !lineupTenant || viewerTenant !== lineupTenant) {
    return {
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_CROSS_SCOPE_ACCESS_DENIED,
      message: "Cross-tenant lineup access denied",
    };
  }

  const lineupCompetition = lineup
    ? String(lineup.competitionId || "").trim()
    : "";
  const viewerCompetition = String(
    viewerScope.competitionId || competitionScope?.competitionId || ""
  ).trim();
  if (
    !viewerCompetition ||
    !lineupCompetition ||
    viewerCompetition !== lineupCompetition
  ) {
    return {
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_CROSS_SCOPE_ACCESS_DENIED,
      message: "Cross-competition lineup access denied",
    };
  }

  if (competitionTenant && competitionTenant !== lineupTenant) {
    return {
      ok: false,
      code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_CROSS_SCOPE_ACCESS_DENIED,
      message: "Competition tenant scope mismatch",
    };
  }

  return { ok: true };
}

/**
 * Build a redacted projection DTO — never mutates the source lineup.
 * @param {object|null} lineup
 * @param {string[]} permittedFields
 * @param {boolean} allowSlotCount
 * @returns {object|null}
 */
function buildProjectedLineup(lineup, permittedFields, allowSlotCount) {
  if (!lineup || typeof lineup !== "object") return null;
  const permitted = new Set(permittedFields);
  /** @type {Record<string, unknown>} */
  const out = {};

  if (permitted.has(LINEUP_PROJECTION_FIELD.IDENTITY)) {
    out.id = lineup.id ?? null;
    out.identityKey = lineup.identityKey ?? null;
  }
  if (permitted.has(LINEUP_PROJECTION_FIELD.STATUS)) {
    out.status = lineup.status ?? null;
  }
  if (permitted.has(LINEUP_PROJECTION_FIELD.VISIBILITY_STATE)) {
    out.visibilityState =
      lineup.visibilityState ?? LINEUP_VISIBILITY_STATE.PRIVATE;
  }
  if (permitted.has(LINEUP_PROJECTION_FIELD.REVISION)) {
    out.revision = lineup.revision ?? null;
  }
  if (permitted.has(LINEUP_PROJECTION_FIELD.TEAM_ID)) {
    out.teamId = lineup.teamId ?? null;
  }
  if (permitted.has(LINEUP_PROJECTION_FIELD.COMPETITION_ID)) {
    out.competitionId = lineup.competitionId ?? null;
  }
  if (permitted.has(LINEUP_PROJECTION_FIELD.TENANT_ID)) {
    out.tenantId = lineup.tenantId ?? null;
  }
  if (permitted.has(LINEUP_PROJECTION_FIELD.CONTEXT_ID)) {
    out.contextId = lineup.contextId ?? null;
  }

  const slots = Array.isArray(lineup.slots) ? lineup.slots : [];
  if (permitted.has(LINEUP_PROJECTION_FIELD.SLOTS)) {
    out.slots = slots.map((s) =>
      s && typeof s === "object"
        ? Object.freeze({
            id: s.id ?? null,
            disciplineOrSideKey: s.disciplineOrSideKey ?? null,
            index: s.index ?? null,
            person:
              permitted.has(LINEUP_PROJECTION_FIELD.PARTICIPANT_IDS) &&
              s.person &&
              typeof s.person === "object"
                ? Object.freeze({
                    kind: s.person.kind ?? null,
                    id: s.person.id ?? null,
                  })
                : null,
          })
        : null
    );
  } else if (
    allowSlotCount &&
    permitted.has(LINEUP_PROJECTION_FIELD.SLOT_COUNT)
  ) {
    out.slotCount = slots.length;
  }

  if (
    permitted.has(LINEUP_PROJECTION_FIELD.PARTICIPANT_IDS) &&
    !permitted.has(LINEUP_PROJECTION_FIELD.SLOTS)
  ) {
    out.participantIds = slots
      .map((s) =>
        s && s.person && typeof s.person === "object"
          ? `${String(s.person.kind || "")}:${String(s.person.id || "")}`
          : null
      )
      .filter(Boolean);
  }

  return Object.freeze(out);
}

/**
 * Fail-closed projection for a viewer.
 *
 * @param {object} request
 * @param {object} request.lineup
 * @param {object} [request.viewerActor]
 * @param {object} request.viewerScope
 * @param {object} [request.competitionScope]
 * @param {string} [request.relationship]
 * @param {import('../contracts/lineupHardeningPolicy.js').LineupHardeningPolicy} [request.visibilityPolicy]
 * @param {object} [request.revealState]
 * @param {string} request.evaluatedAt — explicit policy time (required)
 * @param {string} [request.source]
 * @returns {import('../contracts/visibilityProjection.js').LineupVisibilityProjection}
 */
export function projectLineupForViewer(request = {}) {
  const policy =
    request.visibilityPolicy || createDefaultLineupHardeningPolicy();
  const evaluatedAt =
    request.evaluatedAt != null && String(request.evaluatedAt).trim() !== ""
      ? String(request.evaluatedAt).trim()
      : null;

  const hidden = (reason, code, extraMeta = {}) =>
    createLineupVisibilityProjection({
      visible: false,
      visibilityState:
        normalizeLineupVisibilityState(request.lineup?.visibilityState) ||
        LINEUP_VISIBILITY_STATE.PRIVATE,
      reason,
      permittedFields: [],
      redactedFields: Object.values(LINEUP_PROJECTION_FIELD),
      projectedLineup: null,
      metadata: Object.freeze({
        code,
        evaluatedAt,
        source: request.source ?? null,
        // Never include slots / participant identities when hidden.
        ...extraMeta,
      }),
    });

  if (!evaluatedAt) {
    return hidden(
      "evaluatedAt is required",
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_CLOCK_REQUIRED
    );
  }

  const scopeCheck = assertScopes(request);
  if (!scopeCheck.ok) {
    return hidden(scopeCheck.message, scopeCheck.code);
  }

  const relationship = resolveRelationship(request);
  if (!relationship) {
    return hidden(
      "Unknown viewer relationship",
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_UNKNOWN_VIEWER_SCOPE
    );
  }

  const visibilityState =
    normalizeLineupVisibilityState(request.lineup?.visibilityState) ||
    LINEUP_VISIBILITY_STATE.PRIVATE;

  const revealState =
    request.revealState && typeof request.revealState === "object"
      ? request.revealState
      : {};
  const revealAuthorized = revealState.authorized === true;
  const revealReady = revealState.ready === true;

  if (
    (relationship === "OPPONENT" || relationship === "PUBLIC") &&
    (visibilityState === LINEUP_VISIBILITY_STATE.OPPONENT_VISIBLE ||
      visibilityState === LINEUP_VISIBILITY_STATE.PUBLIC)
  ) {
    if (!revealAuthorized || !revealReady) {
      return hidden(
        "Opponent/public reveal not authorized or not ready",
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVEAL_NOT_AUTHORIZED,
        { revealAuthorized, revealReady }
      );
    }
  }

  // Lifecycle status alone must never reveal.
  void request.lineup?.status;

  const authCtx = {
    relationship,
    viewerScope: request.viewerScope,
    viewerActor: request.viewerActor ?? null,
    visibilityState,
    revealState,
    evaluatedAt,
    lineup: {
      tenantId: request.lineup?.tenantId ?? null,
      competitionId: request.lineup?.competitionId ?? null,
      teamId: request.lineup?.teamId ?? null,
      identityKey: request.lineup?.identityKey ?? null,
      visibilityState,
      status: request.lineup?.status ?? null,
      revision: request.lineup?.revision ?? null,
    },
  };

  let decision = createLineupPolicyResult({ ok: false });
  if (typeof policy.authorizeViewerProjection === "function") {
    decision = createLineupPolicyResult(
      policy.authorizeViewerProjection(authCtx)
    );
  }
  if (decision.ok !== true) {
    return hidden(
      decision.message || "Projection denied",
      decision.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_AUTHORIZATION_DENIED
    );
  }

  const permittedFields =
    typeof policy.permittedProjectionFields === "function"
      ? [...(policy.permittedProjectionFields(authCtx) || [])]
      : [];
  const allowSlotCount =
    typeof policy.allowsSlotCountLeak === "function"
      ? policy.allowsSlotCountLeak(authCtx) === true
      : false;

  if (!allowSlotCount) {
    const idx = permittedFields.indexOf(LINEUP_PROJECTION_FIELD.SLOT_COUNT);
    if (idx >= 0) permittedFields.splice(idx, 1);
  }

  const allFields = Object.values(LINEUP_PROJECTION_FIELD);
  const redactedFields = allFields.filter((f) => !permittedFields.includes(f));

  const projected = buildProjectedLineup(
    request.lineup,
    permittedFields,
    allowSlotCount
  );

  return createLineupVisibilityProjection({
    visible: true,
    visibilityState,
    reason: "projection_authorized",
    permittedFields,
    redactedFields,
    projectedLineup: projected,
    metadata: Object.freeze({
      code: null,
      evaluatedAt,
      source: request.source ?? null,
      relationship,
      revealAuthorized,
      revealReady,
    }),
  });
}
