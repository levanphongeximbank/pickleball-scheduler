/**
 * CORE-12 Phase 1D-B1 — invoke injected AvailabilitySnapshotProvider.
 *
 * Certifies Promise / sync compatibility. No Venue CAA import. No assigner call.
 * No retry / timeout infrastructure (timeout deferred to future runtime policy).
 */

import { createAvailabilityEligibilityQuery } from "../../contracts/availabilityEligibilityQuery.js";
import { createEligibilitySnapshot } from "../../contracts/eligibilitySnapshot.js";
import { AVAILABILITY_BRIDGE_CODE } from "../../contracts/availabilityBridgeCodes.js";
import { isCourtAssignmentContractError } from "../../errors/CourtAssignmentContractError.js";
import { isAvailabilitySnapshotProvider } from "../../ports/availabilitySnapshotProvider.js";

/**
 * @param {unknown} err
 * @returns {{ code: string, message: string, details: object }}
 */
function normalizeProviderRejection(err) {
  if (isCourtAssignmentContractError(err)) {
    return {
      code: err.code,
      message: err.message,
      details: err.details ?? {},
    };
  }
  if (err && typeof err === "object") {
    const code =
      "code" in err && typeof /** @type {{ code?: unknown }} */ (err).code === "string"
        ? /** @type {{ code: string }} */ (err).code
        : AVAILABILITY_BRIDGE_CODE.PROVIDER_REJECTED;
    const message =
      err instanceof Error
        ? err.message
        : "code" in err &&
            typeof /** @type {{ message?: unknown }} */ (err).message === "string"
          ? /** @type {{ message: string }} */ (err).message
          : "AvailabilitySnapshotProvider rejected";
    return {
      code,
      message,
      details: {
        name:
          err instanceof Error
            ? err.name
            : String(/** @type {{ name?: unknown }} */ (err).name ?? "Error"),
      },
    };
  }
  return {
    code: AVAILABILITY_BRIDGE_CODE.PROVIDER_REJECTED,
    message: String(err ?? "AvailabilitySnapshotProvider rejected"),
    details: {},
  };
}

/**
 * @param {unknown} provider
 * @param {object} queryPartial
 * @returns {Promise<
 *   | { ok: true, query: object, snapshot: object }
 *   | { ok: false, code: string, message: string, details: object }
 * >}
 */
export async function invokeAvailabilitySnapshotProvider(provider, queryPartial) {
  if (!isAvailabilitySnapshotProvider(provider)) {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.MISSING_AVAILABILITY_PROVIDER,
      message:
        "AvailabilitySnapshotProvider is missing or does not implement resolveEligibilitySnapshot",
      details: {},
    };
  }

  let query;
  try {
    query = createAvailabilityEligibilityQuery(queryPartial);
  } catch (err) {
    if (isCourtAssignmentContractError(err)) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      };
    }
    throw err;
  }

  let raw;
  try {
    raw = await Promise.resolve(
      provider.resolveEligibilitySnapshot(query)
    );
  } catch (err) {
    const normalized = normalizeProviderRejection(err);
    return {
      ok: false,
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
    };
  }

  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.PROVIDER_RESULT_INVALID,
      message: "AvailabilitySnapshotProvider returned a non-object result",
      details: { resultType: raw == null ? "null" : typeof raw },
    };
  }

  try {
    const snapshot = createEligibilitySnapshot({
      .../** @type {object} */ (raw),
      tenantId: /** @type {object} */ (raw).tenantId ?? query.tenantId,
      clubId: /** @type {object} */ (raw).clubId ?? query.clubId,
      venueId: /** @type {object} */ (raw).venueId ?? query.venueId,
      competitionId:
        /** @type {object} */ (raw).competitionId ?? query.competitionId,
      timezone: /** @type {object} */ (raw).timezone ?? query.timezone,
      windowStart: /** @type {object} */ (raw).windowStart ?? query.windowStart,
      windowEnd: /** @type {object} */ (raw).windowEnd ?? query.windowEnd,
      civilDate: /** @type {object} */ (raw).civilDate ?? query.civilDate,
      civilStartTime:
        /** @type {object} */ (raw).civilStartTime ?? query.civilStartTime,
      civilEndTime:
        /** @type {object} */ (raw).civilEndTime ?? query.civilEndTime,
      queryFingerprint:
        /** @type {object} */ (raw).queryFingerprint ?? query.queryFingerprint,
    });

    if (
      snapshot.tenantId !== query.tenantId ||
      snapshot.clubId !== query.clubId ||
      snapshot.venueId !== query.venueId ||
      snapshot.competitionId !== query.competitionId
    ) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.ELIGIBILITY_SCOPE_MISMATCH,
        message: "EligibilitySnapshot scope does not match availability query",
        details: {
          queryScope: {
            tenantId: query.tenantId,
            clubId: query.clubId,
            venueId: query.venueId,
            competitionId: query.competitionId,
          },
          snapshotScope: {
            tenantId: snapshot.tenantId,
            clubId: snapshot.clubId,
            venueId: snapshot.venueId,
            competitionId: snapshot.competitionId,
          },
        },
      };
    }

    if (snapshot.queryFingerprint !== query.queryFingerprint) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.QUERY_FINGERPRINT_MISMATCH,
        message: "EligibilitySnapshot.queryFingerprint does not match query",
        details: {
          queryFingerprint: query.queryFingerprint,
          snapshotQueryFingerprint: snapshot.queryFingerprint,
        },
      };
    }

    if (
      snapshot.windowStart !== query.windowStart ||
      snapshot.windowEnd !== query.windowEnd ||
      snapshot.timezone !== query.timezone
    ) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
        message: "EligibilitySnapshot window does not match query window",
        details: {},
      };
    }

    return { ok: true, query, snapshot };
  } catch (err) {
    if (isCourtAssignmentContractError(err)) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      };
    }
    throw err;
  }
}
