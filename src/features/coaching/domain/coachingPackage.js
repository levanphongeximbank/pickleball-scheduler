/**
 * CoachingPackage definition + PackageEntitlement / usage (COACHING-01).
 * Owns entitlement/usage only — Finance owns price/invoice/payment/refund.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import {
  PACKAGE_ALLOWED_TRANSITIONS,
  PACKAGE_STATUS,
  isAllowedTransition,
  isPackageStatus,
} from "../constants/lifecycles.js";
import { optionalIsoTimestamp, requireIsoTimestamp } from "../constants/timestamps.js";
import { throwCoachingError } from "../errors/CoachingError.js";
import {
  assertExpectedVersion,
  optionalId,
  requireNonEmptyId,
} from "./scope.js";
import {
  bumpVersion,
  createScopedAggregateBase,
  optionalTrimmedString,
  requireNonNegativeInt,
  requirePositiveInt,
  requireTrimmedString,
  resolveNowIso,
} from "./helpers.js";

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createCoachingPackage(input = {}, deps = {}) {
  const status =
    input.status != null ? String(input.status) : PACKAGE_STATUS.DRAFT;
  if (!isPackageStatus(status)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid package status: ${status}`,
      { status }
    );
  }
  const sessionEntitlement = requirePositiveInt(
    input.sessionEntitlement ?? input.sessions,
    "sessionEntitlement"
  );
  return createScopedAggregateBase(input, deps, {
    idField: "packageId",
    idPrefix: "pkg",
    status,
    extra: {
      name: requireTrimmedString(input.name, "name", 200),
      description: optionalTrimmedString(input.description, "description"),
      sessionEntitlement,
      validityDays:
        input.validityDays == null
          ? null
          : requirePositiveInt(input.validityDays, "validityDays"),
      // Finance reference only — not a price SoT.
      externalPaymentReference: optionalId(
        input.externalPaymentReference,
        "externalPaymentReference"
      ),
    },
  });
}

/**
 * @param {object} pkg
 * @param {string} nextStatus
 * @param {{ nowIso?: () => string }} deps
 * @param {{ expectedVersion: number }} options
 */
export function transitionCoachingPackage(
  pkg,
  nextStatus,
  deps = {},
  options = {}
) {
  assertExpectedVersion(pkg, options.expectedVersion, "CoachingPackage");
  if (!isPackageStatus(nextStatus)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid package status: ${nextStatus}`,
      { status: nextStatus }
    );
  }
  if (
    !isAllowedTransition(pkg.status, nextStatus, PACKAGE_ALLOWED_TRANSITIONS)
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_TRANSITION,
      `Cannot transition CoachingPackage from ${pkg.status} to ${nextStatus}.`,
      { from: pkg.status, to: nextStatus }
    );
  }
  return bumpVersion(pkg, { status: nextStatus }, resolveNowIso(deps));
}

/**
 * Package entitlement / usage contract for a player enrollment.
 *
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createPackageEntitlement(input = {}, deps = {}) {
  const sessionsGranted = requirePositiveInt(
    input.sessionsGranted ?? input.sessionEntitlement,
    "sessionsGranted"
  );
  const sessionsConsumed =
    input.sessionsConsumed == null
      ? 0
      : requireNonNegativeInt(input.sessionsConsumed, "sessionsConsumed");
  if (sessionsConsumed > sessionsGranted) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      "sessionsConsumed cannot exceed sessionsGranted.",
      { sessionsConsumed, sessionsGranted }
    );
  }
  const validFrom = optionalIsoTimestamp(input.validFrom, "validFrom");
  const validTo = optionalIsoTimestamp(input.validTo, "validTo");
  if (validFrom && validTo && Date.parse(validTo) < Date.parse(validFrom)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      "validTo must be on or after validFrom.",
      { validFrom, validTo }
    );
  }
  return createScopedAggregateBase(input, deps, {
    idField: "entitlementId",
    idPrefix: "ent",
    status: input.status != null ? String(input.status) : "active",
    extra: {
      packageId: requireNonEmptyId(input.packageId, "packageId"),
      playerId: requireNonEmptyId(input.playerId, "playerId"),
      enrollmentId: optionalId(input.enrollmentId, "enrollmentId"),
      sessionsGranted,
      sessionsConsumed,
      sessionsRemaining: sessionsGranted - sessionsConsumed,
      validFrom,
      validTo,
      externalPaymentReference: optionalId(
        input.externalPaymentReference,
        "externalPaymentReference"
      ),
    },
  });
}

/**
 * Consume one session entitlement (usage).
 *
 * @param {object} entitlement
 * @param {{ nowIso?: () => string }} deps
 * @param {{ expectedVersion: number, at?: string }} options
 */
export function consumePackageEntitlement(
  entitlement,
  deps = {},
  options = {}
) {
  assertExpectedVersion(
    entitlement,
    options.expectedVersion,
    "PackageEntitlement"
  );
  if (entitlement.sessionsRemaining < 1) {
    throwCoachingError(
      COACHING_ERROR_CODES.ENTITLEMENT_EXHAUSTED,
      "Package entitlement has no remaining sessions.",
      { entitlementId: entitlement.entitlementId }
    );
  }
  const at = options.at
    ? requireIsoTimestamp(options.at, "at")
    : resolveNowIso(deps);
  if (
    entitlement.validTo &&
    Date.parse(at) > Date.parse(entitlement.validTo)
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_TRANSITION,
      "Cannot consume entitlement after validTo.",
      { validTo: entitlement.validTo, at }
    );
  }
  if (
    entitlement.validFrom &&
    Date.parse(at) < Date.parse(entitlement.validFrom)
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_TRANSITION,
      "Cannot consume entitlement before validFrom.",
      { validFrom: entitlement.validFrom, at }
    );
  }
  const sessionsConsumed = entitlement.sessionsConsumed + 1;
  return bumpVersion(
    entitlement,
    {
      sessionsConsumed,
      sessionsRemaining: entitlement.sessionsGranted - sessionsConsumed,
    },
    at
  );
}
