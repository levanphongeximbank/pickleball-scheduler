/**
 * Domain-level actor authorization for verification / adjustment (Phase 1E).
 * Caller-supplied context only. Does not import Auth/RBAC runtime.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  getScopeTenantId,
  requireExplicitPlayerRatingScope,
} from "../contracts/scopeContract.js";
import {
  clonePlain,
  deepFreeze,
  failContract,
  isNonEmptyString,
  requireNonEmptyString,
  requireValidTimestamp,
} from "../contracts/shared.js";
import { PLAYER_RATING_CAPABILITY } from "./constants.js";

/**
 * @typedef {Object} RatingOperationActorContext
 * @property {string} actorId
 * @property {string} actorType
 * @property {string[]} capabilities
 * @property {string} [tenantId]
 * @property {'global'|undefined} [globalScope]
 * @property {string} reason
 * @property {string} correlationId
 * @property {string} operationId
 * @property {string|number} occurredAt
 */

/**
 * Collect capability names from capabilities[] and/or permissions[].
 * Does not trust client booleans such as isAdmin / serverAuthorized alone.
 *
 * @param {Record<string, unknown>} raw
 * @returns {string[]}
 */
function collectCapabilities(raw) {
  /** @type {string[]} */
  const out = [];
  const sources = [raw.capabilities, raw.permissions];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      if (isNonEmptyString(item)) out.push(String(item).trim());
    }
  }
  if (isNonEmptyString(raw.permission)) {
    out.push(String(raw.permission).trim());
  }
  if (isNonEmptyString(raw.capability)) {
    out.push(String(raw.capability).trim());
  }
  return [...new Set(out)];
}

/**
 * @param {unknown} actorInput
 * @param {{
 *   requiredCapability: string,
 *   unauthorizedCode: string,
 *   operationScope: import('../contracts/scopeContract.js').PlayerRatingScope,
 * }} options
 * @returns {Readonly<RatingOperationActorContext>}
 */
export function authorizeRatingOperation(actorInput, options) {
  const unauthorizedCode = options.unauthorizedCode;
  const requiredCapability = requireNonEmptyString(
    options.requiredCapability,
    "requiredCapability"
  );
  const operationScope = requireExplicitPlayerRatingScope(options.operationScope);

  if (!actorInput || typeof actorInput !== "object") {
    failContract(
      unauthorizedCode,
      "Rating operation requires explicit actor context",
      { actor: actorInput }
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (actorInput);

  if (!isNonEmptyString(raw.actorId)) {
    failContract(
      unauthorizedCode,
      "Rating operation requires actorId (fail closed)",
      { actor: actorInput }
    );
  }

  if (raw.isAdmin === true && !collectCapabilities(raw).includes(requiredCapability)) {
    failContract(
      unauthorizedCode,
      "Client-provided isAdmin is not trusted without required capability",
      { actorId: raw.actorId, requiredCapability }
    );
  }

  const capabilities = collectCapabilities(raw);
  if (!capabilities.includes(requiredCapability)) {
    failContract(
      unauthorizedCode,
      `Missing required capability: ${requiredCapability}`,
      { actorId: raw.actorId, requiredCapability, capabilities }
    );
  }

  const actorType = requireNonEmptyString(raw.actorType, "actorType");
  const reason = requireNonEmptyString(raw.reason, "reason");
  const correlationId = requireNonEmptyString(raw.correlationId, "correlationId");
  const operationId = requireNonEmptyString(raw.operationId, "operationId");
  const occurredAt = requireValidTimestamp(raw.occurredAt, "occurredAt");

  const hasGlobal =
    raw.globalScope === "global" ||
    raw.scopeKind === "global" ||
    (raw.scope &&
      typeof raw.scope === "object" &&
      /** @type {{ kind?: unknown }} */ (raw.scope).kind === "global");

  const actorTenantId = isNonEmptyString(raw.tenantId)
    ? String(raw.tenantId).trim()
    : null;

  if (!hasGlobal && !actorTenantId) {
    failContract(
      unauthorizedCode,
      "Actor must supply tenantId or explicit global scope",
      { actorId: raw.actorId }
    );
  }

  if (operationScope.kind === "global") {
    if (!hasGlobal) {
      failContract(
        unauthorizedCode,
        "Actor global scope required for global rating operation",
        { actorId: raw.actorId }
      );
    }
  } else {
    const scopeTenantId = getScopeTenantId(operationScope);
    if (hasGlobal) {
      // Global actor may operate across tenants when explicitly global.
    } else if (actorTenantId !== scopeTenantId) {
      failContract(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED,
        "Actor tenantId does not match operation scope (fail closed)",
        {
          actorId: raw.actorId,
          actorTenantId,
          scopeTenantId,
        }
      );
    }
  }

  /** @type {RatingOperationActorContext} */
  const context = {
    actorId: String(raw.actorId).trim(),
    actorType,
    capabilities: Object.freeze([...capabilities]),
    reason,
    correlationId,
    operationId,
    occurredAt,
  };

  if (actorTenantId) context.tenantId = actorTenantId;
  if (hasGlobal) context.globalScope = "global";

  return deepFreeze(clonePlain(context));
}

/**
 * @param {unknown} actorInput
 * @param {import('../contracts/scopeContract.js').PlayerRatingScope} operationScope
 */
export function authorizeVerificationActor(actorInput, operationScope) {
  return authorizeRatingOperation(actorInput, {
    requiredCapability: PLAYER_RATING_CAPABILITY.VERIFY,
    unauthorizedCode:
      PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_VERIFICATION,
    operationScope,
  });
}

/**
 * @param {unknown} actorInput
 * @param {import('../contracts/scopeContract.js').PlayerRatingScope} operationScope
 */
export function authorizeAdjustmentActor(actorInput, operationScope) {
  return authorizeRatingOperation(actorInput, {
    requiredCapability: PLAYER_RATING_CAPABILITY.ADJUST,
    unauthorizedCode:
      PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_MANUAL_ADJUSTMENT,
    operationScope,
  });
}
