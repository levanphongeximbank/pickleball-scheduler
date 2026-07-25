/**
 * Tenant / currency / ranking-system / rating-system / player / team /
 * competition isolation guards (I&A-09). Fail closed — never silently
 * filter contamination into success.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { isNonEmptyString, isPlainObject } from "../contracts/shared.js";

const FACT_LIST_KEYS = Object.freeze([
  "transactions",
  "invoices",
  "payments",
  "refunds",
  "settlements",
  "receivables",
  "recognizedAmounts",
  "rankingSystems",
  "rankingSnapshots",
  "rankingPositions",
  "ratingSnapshots",
  "ratingChanges",
  "participations",
  "matches",
  "outcomes",
]);

/**
 * @param {unknown} context
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function guardFinanceRankingPerformanceAnalyticsSnapshot(context, snapshot) {
  if (!isPlainObject(context)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_CONTEXT_INVALID,
        "guard requires FinanceRankingPerformanceAnalyticsContext",
        "context"
      )
    );
  }
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SNAPSHOT_INVALID,
        "guard requires FinanceRankingPerformanceAnalyticsSnapshot",
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

  const expectedCurrencyCode = context.currencyCode;
  const expectedRankingSystemId = context.rankingSystemId;
  const expectedRankingSystemVersion = context.rankingSystemVersion;
  const expectedRatingSystemId = context.ratingSystemId;
  const expectedRatingSystemVersion = context.ratingSystemVersion;
  const expectedPlayerId = context.playerId;
  const expectedTeamId = context.teamId;
  const expectedCompetitionId = context.competitionId;

  const snapshotContext = snapshot.context;
  if (isPlainObject(snapshotContext)) {
    const snapTenant = snapshotContext.tenantScope?.tenantId;
    if (snapTenant && snapTenant !== expectedTenantId) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_TENANT_MISMATCH,
          "Snapshot tenant does not match requested context",
          "snapshot.context.tenantScope.tenantId",
          { expectedTenantId, actualTenantId: snapTenant }
        )
      );
    }
  }

  /** @type {Set<string>} */
  const tenantIds = new Set();

  for (const key of FACT_LIST_KEYS) {
    const list = snapshot[key];
    if (!Array.isArray(list)) continue;
    for (let i = 0; i < list.length; i += 1) {
      const fact = list[i];
      if (!isPlainObject(fact)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
            `Invalid fact in ${key}[${i}]`,
            `${key}[${i}]`
          )
        );
      }

      if (fact.tenantId !== expectedTenantId) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_TENANT_MISMATCH,
            "Fact tenant does not match requested context",
            `${key}[${i}].tenantId`,
            { expectedTenantId, actualTenantId: fact.tenantId }
          )
        );
      }
      tenantIds.add(String(fact.tenantId));

      if (
        expectedCurrencyCode &&
        isPlainObject(fact.amount) &&
        fact.amount.currencyCode &&
        fact.amount.currencyCode !== expectedCurrencyCode
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_CURRENCY_MISMATCH,
            "Fact currency does not match requested context",
            `${key}[${i}].amount.currencyCode`,
            {
              expectedCurrencyCode,
              actualCurrencyCode: fact.amount.currencyCode,
            }
          )
        );
      }

      if (
        expectedRankingSystemId &&
        fact.rankingSystemId &&
        fact.rankingSystemId !== expectedRankingSystemId
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RANKING_SYSTEM_MISMATCH,
            "Fact ranking system does not match requested context",
            `${key}[${i}].rankingSystemId`,
            {
              expectedRankingSystemId,
              actualRankingSystemId: fact.rankingSystemId,
            }
          )
        );
      }
      if (
        expectedRankingSystemVersion &&
        fact.rankingSystemVersion &&
        fact.rankingSystemVersion !== expectedRankingSystemVersion
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RANKING_VERSION_MISMATCH,
            "Fact ranking system version does not match requested context",
            `${key}[${i}].rankingSystemVersion`,
            {
              expectedRankingSystemVersion,
              actualRankingSystemVersion: fact.rankingSystemVersion,
            }
          )
        );
      }

      if (
        expectedRatingSystemId &&
        fact.ratingSystemId &&
        fact.ratingSystemId !== expectedRatingSystemId
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RATING_SYSTEM_MISMATCH,
            "Fact rating system does not match requested context",
            `${key}[${i}].ratingSystemId`,
            {
              expectedRatingSystemId,
              actualRatingSystemId: fact.ratingSystemId,
            }
          )
        );
      }
      if (
        expectedRatingSystemVersion &&
        fact.ratingSystemVersion &&
        fact.ratingSystemVersion !== expectedRatingSystemVersion
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RATING_VERSION_MISMATCH,
            "Fact rating system version does not match requested context",
            `${key}[${i}].ratingSystemVersion`,
            {
              expectedRatingSystemVersion,
              actualRatingSystemVersion: fact.ratingSystemVersion,
            }
          )
        );
      }

      if (
        expectedPlayerId &&
        fact.entityType === "player" &&
        isNonEmptyString(fact.entityId) &&
        fact.entityId !== expectedPlayerId
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_PLAYER_MISMATCH,
            "Fact player entity does not match requested context",
            `${key}[${i}].entityId`,
            { expectedPlayerId, actualEntityId: fact.entityId }
          )
        );
      }
      if (
        expectedTeamId &&
        fact.entityType === "team" &&
        isNonEmptyString(fact.entityId) &&
        fact.entityId !== expectedTeamId
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_TEAM_MISMATCH,
            "Fact team entity does not match requested context",
            `${key}[${i}].entityId`,
            { expectedTeamId, actualEntityId: fact.entityId }
          )
        );
      }
      if (
        expectedCompetitionId &&
        isNonEmptyString(fact.competitionId) &&
        fact.competitionId !== expectedCompetitionId
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_COMPETITION_MISMATCH,
            "Fact competition does not match requested context",
            `${key}[${i}].competitionId`,
            { expectedCompetitionId, actualCompetitionId: fact.competitionId }
          )
        );
      }
    }
  }

  if (tenantIds.size > 1) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_ISOLATION_VIOLATION,
        "Mixed-tenant facts are not allowed",
        "snapshot",
        { tenantIds: [...tenantIds] }
      )
    );
  }

  return ok(
    Object.freeze({
      tenantId: expectedTenantId,
      ...(expectedCurrencyCode ? { currencyCode: expectedCurrencyCode } : {}),
      ...(expectedRankingSystemId ? { rankingSystemId: expectedRankingSystemId } : {}),
      ...(expectedRatingSystemId ? { ratingSystemId: expectedRatingSystemId } : {}),
      ...(expectedPlayerId ? { playerId: expectedPlayerId } : {}),
      ...(expectedTeamId ? { teamId: expectedTeamId } : {}),
      ...(expectedCompetitionId ? { competitionId: expectedCompetitionId } : {}),
      factTenantCount: tenantIds.size,
    })
  );
}
