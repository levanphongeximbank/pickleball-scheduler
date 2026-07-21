/**
 * CORE-06 Phase 1E — injected hardening policy surface.
 * Format owns reveal timing, grace, correction rights, late-submit rules.
 * CORE-06 never hard-codes tournament-specific schedules or role catalogs.
 */

import { createLineupPolicyResult } from "./lineupPolicy.js";
import { LINEUP_VISIBILITY_STATE } from "./lineupVisibilityState.js";

/**
 * @typedef {Object} LineupHardeningPolicy
 * @property {string} id
 * @property {(ctx: object) => import('./lineupPolicy.js').LineupPolicyResult|Promise<import('./lineupPolicy.js').LineupPolicyResult>} [authorizeViewerProjection]
 * @property {(ctx: object) => import('./lineupPolicy.js').LineupPolicyResult|Promise<import('./lineupPolicy.js').LineupPolicyResult>} [authorizeVisibilityTransition]
 * @property {(ctx: object) => import('./lineupDeadlinePhase.js').LineupDeadlineTimestamps|null|Promise<import('./lineupDeadlinePhase.js').LineupDeadlineTimestamps|null>} [resolveDeadlineTimestamps]
 * @property {(ctx: object) => boolean|Promise<boolean>} [requiresExpectedVersion]
 * @property {(ctx: object) => boolean|Promise<boolean>} [allowsLateMutation]
 * @property {(ctx: object) => boolean|Promise<boolean>} [allowsLockedCorrection]
 * @property {(ctx: object) => boolean|Promise<boolean>} [allowsVisibilityRegression]
 * @property {(ctx: object) => boolean|Promise<boolean>} [allowsVisibilityStageSkip]
 * @property {(ctx: object) => boolean|Promise<boolean>} [allowsReveal]
 * @property {(ctx: object) => boolean|Promise<boolean>} [allowsSlotCountLeak]
 * @property {(ctx: object) => string[]|Promise<string[]>} [permittedProjectionFields]
 */

/**
 * @param {unknown} policy
 * @returns {boolean}
 */
export function isLineupHardeningPolicy(policy) {
  return Boolean(
    policy &&
      typeof policy === "object" &&
      typeof /** @type {{ id?: unknown }} */ (policy).id === "string"
  );
}

/**
 * Fail-closed defaults: own-team private visibility; no regression; expectedVersion not mandatory.
 * @returns {LineupHardeningPolicy}
 */
export function createDefaultLineupHardeningPolicy() {
  return {
    id: "DEFAULT_LINEUP_HARDENING_POLICY",
    authorizeViewerProjection(ctx) {
      const relationship = String(ctx?.relationship || "").trim();
      const viewerScope = String(ctx?.viewerScope || "").trim();
      if (!viewerScope) {
        return createLineupPolicyResult({
          ok: false,
          code: "LINEUP_UNKNOWN_VIEWER_SCOPE",
          message: "Viewer scope is required",
        });
      }
      if (relationship === "OWN_TEAM") {
        return createLineupPolicyResult({ ok: true });
      }
      if (relationship === "OFFICIAL") {
        const state = String(ctx?.visibilityState || "");
        if (
          state === LINEUP_VISIBILITY_STATE.OFFICIALS_VISIBLE ||
          state === LINEUP_VISIBILITY_STATE.OPPONENT_VISIBLE ||
          state === LINEUP_VISIBILITY_STATE.PUBLIC
        ) {
          return createLineupPolicyResult({ ok: true });
        }
        return createLineupPolicyResult({
          ok: false,
          code: "LINEUP_AUTHORIZATION_DENIED",
          message: "Officials visibility not yet authorized",
        });
      }
      if (relationship === "OPPONENT") {
        const state = String(ctx?.visibilityState || "");
        if (
          state === LINEUP_VISIBILITY_STATE.OPPONENT_VISIBLE ||
          state === LINEUP_VISIBILITY_STATE.PUBLIC
        ) {
          return createLineupPolicyResult({ ok: true });
        }
        return createLineupPolicyResult({
          ok: false,
          code: "LINEUP_REVEAL_NOT_AUTHORIZED",
          message: "Opponent reveal not authorized",
        });
      }
      if (relationship === "PUBLIC") {
        if (String(ctx?.visibilityState || "") === LINEUP_VISIBILITY_STATE.PUBLIC) {
          return createLineupPolicyResult({ ok: true });
        }
        return createLineupPolicyResult({
          ok: false,
          code: "LINEUP_AUTHORIZATION_DENIED",
          message: "Public visibility not authorized",
        });
      }
      return createLineupPolicyResult({
        ok: false,
        code: "LINEUP_UNKNOWN_VIEWER_SCOPE",
        message: "Unknown viewer relationship",
      });
    },
    authorizeVisibilityTransition(ctx) {
      const from = String(ctx?.from || "");
      const to = String(ctx?.to || "");
      if (from === to) {
        return createLineupPolicyResult({ ok: true });
      }
      return createLineupPolicyResult({
        ok: true,
        details: { from, to },
      });
    },
    resolveDeadlineTimestamps() {
      return null;
    },
    requiresExpectedVersion() {
      return false;
    },
    allowsLateMutation() {
      return false;
    },
    allowsLockedCorrection() {
      // Fail closed: locked correction requires an explicit injected policy
      // that returns true. Phase 1C OVERRIDE callers must inject authorization.
      return false;
    },
    allowsVisibilityRegression() {
      return false;
    },
    allowsVisibilityStageSkip() {
      return false;
    },
    allowsReveal(ctx) {
      return (
        String(ctx?.to || "") === LINEUP_VISIBILITY_STATE.OPPONENT_VISIBLE ||
        String(ctx?.to || "") === LINEUP_VISIBILITY_STATE.PUBLIC
      );
    },
    allowsSlotCountLeak() {
      return false;
    },
    permittedProjectionFields(ctx) {
      const relationship = String(ctx?.relationship || "").trim();
      if (relationship === "OWN_TEAM" || relationship === "OFFICIAL") {
        return [
          "identity",
          "status",
          "visibilityState",
          "revision",
          "slots",
          "participantIds",
          "teamId",
          "competitionId",
          "tenantId",
          "contextId",
        ];
      }
      if (relationship === "OPPONENT" || relationship === "PUBLIC") {
        return [
          "identity",
          "status",
          "visibilityState",
          "revision",
          "slots",
          "participantIds",
          "teamId",
          "competitionId",
          "contextId",
        ];
      }
      return [];
    },
  };
}

/**
 * Build a hardening policy from overrides (tests / format adapters).
 * @param {Partial<LineupHardeningPolicy> & { id?: string }} [overrides]
 * @returns {LineupHardeningPolicy}
 */
export function createLineupHardeningPolicy(overrides = {}) {
  const base = createDefaultLineupHardeningPolicy();
  return {
    ...base,
    ...overrides,
    id:
      typeof overrides.id === "string" && overrides.id.trim() !== ""
        ? overrides.id.trim()
        : base.id,
  };
}
