/**
 * Tenant / entity / currency / ranking isolation guards (I&A-10).
 * Fail closed — never silently filter contamination into success.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { isNonEmptyString, isPlainObject } from "../contracts/shared.js";

const ENTITY_KEYS = Object.freeze([
  "venueId",
  "courtId",
  "clubId",
  "competitionId",
  "customerId",
  "playerId",
  "teamId",
  "entityId",
  "rankingSystemId",
  "rankingSystemVersion",
  "ratingSystemId",
  "ratingSystemVersion",
]);

/**
 * @param {unknown} context
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function guardOperationalSignalsSnapshot(context, snapshot) {
  if (!isPlainObject(context)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONTEXT_INVALID,
        "guard requires AlertEvaluationContext",
        "context"
      )
    );
  }
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SNAPSHOT_INVALID,
        "guard requires OperationalSignalsSnapshot",
        "snapshot"
      )
    );
  }

  const expectedTenantId = context.tenantScope?.tenantId;
  if (!isNonEmptyString(expectedTenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "Expected tenantId missing from context",
        "context.tenantScope.tenantId"
      )
    );
  }

  const snapshotContext = snapshot.context;
  if (isPlainObject(snapshotContext)) {
    const snapTenant = snapshotContext.tenantScope?.tenantId;
    if (snapTenant && snapTenant !== expectedTenantId) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_TENANT_MISMATCH,
          "Snapshot tenant does not match requested context",
          "snapshot.context.tenantScope.tenantId",
          { expectedTenantId, actualTenantId: snapTenant }
        )
      );
    }
  }

  const signals = snapshot.signals;
  if (!Array.isArray(signals)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SNAPSHOT_INVALID,
        "snapshot.signals must be an array",
        "snapshot.signals"
      )
    );
  }

  /** @type {Set<string>} */
  const tenantIds = new Set();
  /** @type {Set<string>} */
  const currencies = new Set();

  for (let i = 0; i < signals.length; i += 1) {
    const signal = signals[i];
    if (!isPlainObject(signal)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
          `Invalid signal at signals[${i}]`,
          `signals[${i}]`
        )
      );
    }

    if (signal.tenantId !== expectedTenantId) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_TENANT_MISMATCH,
          "Signal tenant does not match requested context",
          `signals[${i}].tenantId`,
          { expectedTenantId, actualTenantId: signal.tenantId }
        )
      );
    }
    tenantIds.add(String(signal.tenantId));

    if (isNonEmptyString(signal.currencyCode)) {
      currencies.add(String(signal.currencyCode));
      if (
        context.currencyCode &&
        signal.currencyCode !== context.currencyCode
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CURRENCY_MISMATCH,
            "Signal currency does not match context currency",
            `signals[${i}].currencyCode`,
            {
              expectedCurrencyCode: context.currencyCode,
              actualCurrencyCode: signal.currencyCode,
            }
          )
        );
      }
    }

    const entityScope = isPlainObject(signal.entityScope)
      ? signal.entityScope
      : {};
    for (const key of ENTITY_KEYS) {
      if (context[key] && entityScope[key] && entityScope[key] !== context[key]) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_ENTITY_MISMATCH,
            `Signal entityScope.${key} does not match context`,
            `signals[${i}].entityScope.${key}`,
            { expected: context[key], actual: entityScope[key] }
          )
        );
      }
    }

    if (
      context.rankingSystemId &&
      entityScope.rankingSystemId &&
      entityScope.rankingSystemId !== context.rankingSystemId
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_ISOLATION_VIOLATION,
          "Ranking system mismatch",
          `signals[${i}].entityScope.rankingSystemId`
        )
      );
    }
    if (
      context.rankingSystemVersion &&
      entityScope.rankingSystemVersion &&
      entityScope.rankingSystemVersion !== context.rankingSystemVersion
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_ISOLATION_VIOLATION,
          "Ranking system version mismatch",
          `signals[${i}].entityScope.rankingSystemVersion`
        )
      );
    }
  }

  if (tenantIds.size > 1) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_ISOLATION_VIOLATION,
        "Mixed-tenant signals are not allowed",
        "snapshot.signals",
        { tenantIds: [...tenantIds] }
      )
    );
  }

  if (context.currencyCode && currencies.size > 1) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CURRENCY_MISMATCH,
        "Mixed-currency signals are not allowed under a currency-scoped context",
        "snapshot.signals",
        { currencies: [...currencies] }
      )
    );
  }

  return ok(Object.freeze({ guarded: true }));
}
