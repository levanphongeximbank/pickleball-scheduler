import { deepFreeze } from "./deepFreeze.js";
import {
  AUTHORIZATION_DECISION,
  AUTHORIZATION_DECISION_VALUES,
  LIFECYCLE_ACTION_VALUES,
} from "./constants.js";
import { buildSeedingScopeKey, normalizeSeedingScope } from "./normalizeSeedingScope.js";
import {
  normalizeOpaqueId,
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "./normalizeHelpers.js";

/**
 * @typedef {Object} LifecycleAuthorizationDecision
 * @property {string} decisionId
 * @property {string} decision
 * @property {string} lifecycleAction
 * @property {{ id: string } & Record<string, unknown>} actor
 * @property {import('./normalizeSeedingScope.js').SeedingScope} scope
 * @property {string} authorizationPolicyId
 * @property {string} authorizationPolicyVersion
 */

/**
 * Normalize an explicit lifecycle authorization decision.
 * Does not query roles, Identity, env flags, or Supabase.
 *
 * @param {unknown} raw
 * @param {{ expectedAction: string, resultScope: import('./normalizeSeedingScope.js').SeedingScope }} ctx
 * @returns {Readonly<LifecycleAuthorizationDecision>}
 */
export function normalizeLifecycleAuthorizationDecision(raw, ctx) {
  if (!ctx || typeof ctx !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "Authorization normalization context is required"
    );
  }
  if (!LIFECYCLE_ACTION_VALUES.has(ctx.expectedAction)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "expectedAction is invalid",
      { expectedAction: ctx.expectedAction }
    );
  }
  if (!ctx.resultScope || typeof ctx.resultScope !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "resultScope is required for authorization validation"
    );
  }

  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED,
      "authorizationDecision is required",
      { lifecycleAction: ctx.expectedAction }
    );
  }

  const input = /** @type {Record<string, unknown>} */ (raw);
  const decisionId = normalizeOpaqueId(input.decisionId);
  if (!decisionId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED,
      "authorizationDecision.decisionId is required"
    );
  }

  let decision = normalizeOpaqueId(input.decision);
  if (!decision && typeof input.authorizationDecision === "string") {
    decision = normalizeOpaqueId(input.authorizationDecision);
  }
  if (!decision || !AUTHORIZATION_DECISION_VALUES.has(decision)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED,
      "authorizationDecision.decision must be ALLOWED | DENIED | NOT_EVALUATED",
      { decision: input.decision }
    );
  }

  const lifecycleAction =
    normalizeOpaqueId(input.lifecycleAction) || ctx.expectedAction;
  if (lifecycleAction !== ctx.expectedAction) {
    throwSeedingError(
      SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED,
      "authorizationDecision.lifecycleAction does not match requested action",
      { lifecycleAction, expectedAction: ctx.expectedAction }
    );
  }

  const actorRaw = input.actor;
  if (actorRaw == null || typeof actorRaw !== "object" || Array.isArray(actorRaw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED,
      "authorizationDecision.actor is required"
    );
  }
  const actorId = normalizeOpaqueId(
    /** @type {Record<string, unknown>} */ (actorRaw).id
  );
  if (!actorId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED,
      "authorizationDecision.actor.id is required"
    );
  }

  const authScope = normalizeSeedingScope(input.scope || input.seedingScope);
  const resultKey = buildSeedingScopeKey(ctx.resultScope);
  const authKey = buildSeedingScopeKey(authScope);
  if (resultKey !== authKey) {
    throwSeedingError(
      SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED,
      "authorizationDecision.scope does not match result scope",
      { resultScopeKey: resultKey, authorizationScopeKey: authKey }
    );
  }

  const authorizationPolicyId = normalizeOpaqueId(
    input.authorizationPolicyId || input.policyId
  );
  const authorizationPolicyVersion = normalizeOpaqueId(
    input.authorizationPolicyVersion || input.policyVersion
  );
  if (!authorizationPolicyId || !authorizationPolicyVersion) {
    throwSeedingError(
      SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED,
      "authorization policy id and version provenance are required"
    );
  }

  if (decision === AUTHORIZATION_DECISION.DENIED) {
    throwSeedingError(
      SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED,
      "authorizationDecision is DENIED",
      { decisionId, lifecycleAction }
    );
  }
  if (decision === AUTHORIZATION_DECISION.NOT_EVALUATED) {
    throwSeedingError(
      SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED,
      "authorizationDecision is NOT_EVALUATED",
      { decisionId, lifecycleAction }
    );
  }
  if (decision !== AUTHORIZATION_DECISION.ALLOWED) {
    throwSeedingError(
      SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED,
      "authorizationDecision must be ALLOWED",
      { decision }
    );
  }

  return deepFreeze({
    decisionId,
    decision: AUTHORIZATION_DECISION.ALLOWED,
    lifecycleAction,
    actor: deepFreeze({
      .../** @type {Record<string, unknown>} */ (actorRaw),
      id: actorId,
    }),
    scope: authScope,
    authorizationPolicyId,
    authorizationPolicyVersion,
  });
}
