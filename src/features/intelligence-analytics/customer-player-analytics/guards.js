/**
 * Tenant / customer / player isolation guards (I&A-08).
 * Fail closed — never silently filter contamination into success.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { isNonEmptyString, isPlainObject } from "../contracts/shared.js";

const FACT_LIST_KEYS = Object.freeze([
  "customers",
  "customerLifecycles",
  "customerProfileCompleteness",
  "customerActivities",
  "players",
  "playerLifecycles",
  "playerProfileCompleteness",
  "playerActivities",
  "customerPlayerLinks",
  "playerCompetitionParticipations",
  "playerClubMemberships",
]);

const LINK_KEY = "customerPlayerLinks";

/**
 * @param {unknown} context
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function guardCustomerPlayerAnalyticsSnapshot(context, snapshot) {
  if (!isPlainObject(context)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_CONTEXT_INVALID,
        "guard requires CustomerPlayerAnalyticsContext",
        "context"
      )
    );
  }
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SNAPSHOT_INVALID,
        "guard requires CustomerPlayerAnalyticsSnapshot",
        "snapshot"
      )
    );
  }

  const expectedTenantId = context.tenantScope?.tenantId;
  const expectedCustomerId = context.customerId;
  const expectedPlayerId = context.playerId;

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
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_TENANT_MISMATCH,
          "Snapshot tenant does not match requested context",
          "snapshot.context.tenantScope.tenantId",
          { expectedTenantId, actualTenantId: snapTenant }
        )
      );
    }
    if (
      expectedCustomerId &&
      snapshotContext.customerId &&
      snapshotContext.customerId !== expectedCustomerId
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_CUSTOMER_MISMATCH,
          "Snapshot customer does not match requested context",
          "snapshot.context.customerId",
          {
            expectedCustomerId,
            actualCustomerId: snapshotContext.customerId,
          }
        )
      );
    }
    if (
      expectedPlayerId &&
      snapshotContext.playerId &&
      snapshotContext.playerId !== expectedPlayerId
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_PLAYER_MISMATCH,
          "Snapshot player does not match requested context",
          "snapshot.context.playerId",
          {
            expectedPlayerId,
            actualPlayerId: snapshotContext.playerId,
          }
        )
      );
    }
  }

  /** @type {Set<string>} */
  const tenantIds = new Set();
  /** @type {Set<string>} */
  const customerIds = new Set();
  /** @type {Set<string>} */
  const playerIds = new Set();

  for (const key of FACT_LIST_KEYS) {
    const list = snapshot[key];
    if (!Array.isArray(list)) continue;
    const isLink = key === LINK_KEY;
    for (let i = 0; i < list.length; i += 1) {
      const fact = list[i];
      if (!isPlainObject(fact)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
            `Invalid fact in ${key}[${i}]`,
            `${key}[${i}]`
          )
        );
      }

      if (fact.tenantId !== expectedTenantId) {
        return fail(
          analyticsError(
            isLink
              ? ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_LINK_TENANT_MISMATCH
              : ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_TENANT_MISMATCH,
            "Fact tenant does not match requested context",
            `${key}[${i}].tenantId`,
            { expectedTenantId, actualTenantId: fact.tenantId }
          )
        );
      }
      tenantIds.add(String(fact.tenantId));

      if (isNonEmptyString(fact.customerId)) {
        customerIds.add(String(fact.customerId));
        if (expectedCustomerId && fact.customerId !== expectedCustomerId) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_CUSTOMER_MISMATCH,
              "Fact customer does not match requested context",
              `${key}[${i}].customerId`,
              { expectedCustomerId, actualCustomerId: fact.customerId }
            )
          );
        }
      }

      if (isNonEmptyString(fact.playerId)) {
        playerIds.add(String(fact.playerId));
        if (expectedPlayerId && fact.playerId !== expectedPlayerId) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_PLAYER_MISMATCH,
              "Fact player does not match requested context",
              `${key}[${i}].playerId`,
              { expectedPlayerId, actualPlayerId: fact.playerId }
            )
          );
        }
      }
    }
  }

  if (tenantIds.size > 1) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_ISOLATION_VIOLATION,
        "Mixed-tenant facts are not allowed",
        "snapshot",
        { tenantIds: [...tenantIds] }
      )
    );
  }

  return ok(
    Object.freeze({
      tenantId: expectedTenantId,
      ...(expectedCustomerId ? { customerId: expectedCustomerId } : {}),
      ...(expectedPlayerId ? { playerId: expectedPlayerId } : {}),
      factTenantCount: tenantIds.size,
      factCustomerCount: customerIds.size,
      factPlayerCount: playerIds.size,
    })
  );
}
