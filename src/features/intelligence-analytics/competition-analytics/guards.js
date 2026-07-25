/**
 * Tenant / competition / version isolation guards (I&A-06).
 * Fail closed — never silently filter contamination into success.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { isNonEmptyString, isPlainObject } from "../contracts/shared.js";

const FACT_LIST_KEYS = Object.freeze([
  "participants",
  "entries",
  "registrations",
  "divisions",
  "categories",
  "teams",
  "rosters",
  "matches",
  "schedules",
  "assignments",
  "results",
  "standingsSnapshots",
  "rankingSnapshots",
]);

/**
 * @param {unknown} context
 * @param {unknown} snapshot
 * @param {{ allowMixedCompetitionVersions?: boolean }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function guardCompetitionAnalyticsSnapshot(context, snapshot, options = {}) {
  if (!isPlainObject(context)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_CONTEXT_INVALID,
        "guard requires CompetitionAnalyticsContext",
        "context"
      )
    );
  }
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SNAPSHOT_INVALID,
        "guard requires CompetitionAnalyticsSnapshot",
        "snapshot"
      )
    );
  }

  const expectedTenantId = context.tenantScope?.tenantId;
  const expectedCompetitionId = context.competitionId;
  const expectedVersion = context.competitionVersion;

  if (!isNonEmptyString(expectedTenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "Expected tenantId missing from context",
        "context.tenantScope.tenantId"
      )
    );
  }
  if (!isNonEmptyString(expectedCompetitionId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_ID_REQUIRED,
        "Expected competitionId missing from context",
        "context.competitionId"
      )
    );
  }

  const snapshotContext = snapshot.context;
  if (isPlainObject(snapshotContext)) {
    const snapTenant = snapshotContext.tenantScope?.tenantId;
    if (snapTenant && snapTenant !== expectedTenantId) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_TENANT_MISMATCH,
          "Snapshot tenant does not match requested context",
          "snapshot.context.tenantScope.tenantId",
          { expectedTenantId, actualTenantId: snapTenant }
        )
      );
    }
    if (
      snapshotContext.competitionId &&
      snapshotContext.competitionId !== expectedCompetitionId
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_ID_MISMATCH,
          "Snapshot competition does not match requested context",
          "snapshot.context.competitionId",
          {
            expectedCompetitionId,
            actualCompetitionId: snapshotContext.competitionId,
          }
        )
      );
    }
  }

  /** @type {Set<string>} */
  const tenantIds = new Set();
  /** @type {Set<string>} */
  const competitionIds = new Set();
  /** @type {Set<string>} */
  const versions = new Set();

  for (const key of FACT_LIST_KEYS) {
    const list = snapshot[key];
    if (!Array.isArray(list)) continue;
    for (let i = 0; i < list.length; i += 1) {
      const fact = list[i];
      if (!isPlainObject(fact)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
            `Invalid fact in ${key}[${i}]`,
            `${key}[${i}]`
          )
        );
      }
      if (fact.tenantId !== expectedTenantId) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.COMPETITION_TENANT_MISMATCH,
            "Fact tenant does not match requested context",
            `${key}[${i}].tenantId`,
            { expectedTenantId, actualTenantId: fact.tenantId }
          )
        );
      }
      if (fact.competitionId !== expectedCompetitionId) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.COMPETITION_ID_MISMATCH,
            "Fact competition does not match requested context",
            `${key}[${i}].competitionId`,
            {
              expectedCompetitionId,
              actualCompetitionId: fact.competitionId,
            }
          )
        );
      }
      tenantIds.add(String(fact.tenantId));
      competitionIds.add(String(fact.competitionId));
      if (isNonEmptyString(fact.competitionVersion)) {
        versions.add(String(fact.competitionVersion));
      }
    }
  }

  if (tenantIds.size > 1) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_ISOLATION_VIOLATION,
        "Mixed-tenant facts are not allowed",
        "snapshot",
        { tenantIds: [...tenantIds] }
      )
    );
  }
  if (competitionIds.size > 1) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_ISOLATION_VIOLATION,
        "Mixed-competition facts are not allowed",
        "snapshot",
        { competitionIds: [...competitionIds] }
      )
    );
  }

  const allowMixed = options.allowMixedCompetitionVersions === true;
  if (!allowMixed && versions.size > 1) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_VERSION_MIXED,
        "Competition versions must not be mixed without explicit policy",
        "snapshot",
        { competitionVersions: [...versions] }
      )
    );
  }
  if (
    !allowMixed &&
    expectedVersion &&
    versions.size === 1 &&
    !versions.has(expectedVersion)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_VERSION_MIXED,
        "Fact competitionVersion does not match requested context",
        "context.competitionVersion",
        {
          expectedVersion,
          actualVersions: [...versions],
        }
      )
    );
  }

  return ok(
    Object.freeze({
      tenantId: expectedTenantId,
      competitionId: expectedCompetitionId,
      ...(expectedVersion ? { competitionVersion: expectedVersion } : {}),
      factTenantCount: tenantIds.size,
      factCompetitionCount: competitionIds.size,
      factVersionCount: versions.size,
    })
  );
}
