/**
 * Phase 3C — normalize + validate CompetitionRegistration (runtime-local).
 */

import { createCompetitionRegistration } from "../../participants/contracts/entryRegistration.js";
import {
  COMPETITION_REGISTRATION_STATUS,
  isCompetitionRegistrationStatus,
} from "../../participants/enums/statuses.js";
import { isRegistrationKind } from "../enums/registrationKinds.js";
import { isRegistrationSourceType } from "../enums/registrationSourceTypes.js";
import { REGISTRATION_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { RegistrationRuntimeError } from "../errors/RegistrationRuntimeError.js";
import { createRegistrationIdentity } from "../contracts/registrationIdentity.js";

/**
 * @param {import('../../participants/contracts/entryRegistration.js').CompetitionRegistration} registration
 * @returns {import('../../participants/contracts/entryRegistration.js').CompetitionRegistration}
 */
export function normalizeAndValidateRegistration(registration) {
  if (!registration || typeof registration !== "object") {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
      "Registration must be an object",
      {}
    );
  }

  const normalized = createCompetitionRegistration(registration);

  if (!normalized.id) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
      "registrationId is required",
      {}
    );
  }
  if (!normalized.competitionId) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
      "competitionId is required",
      {}
    );
  }
  if (!isRegistrationKind(normalized.registrationKind)) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_KIND,
      "Unsupported or missing registrationKind",
      { registrationKind: normalized.registrationKind }
    );
  }
  if (!isRegistrationSourceType(normalized.sourceType)) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_SOURCE,
      "Unsupported or missing sourceType",
      { sourceType: normalized.sourceType }
    );
  }
  if (!normalized.sourceId) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
      "sourceId is required",
      {}
    );
  }
  if (!isCompetitionRegistrationStatus(normalized.status)) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_STATUS,
      "Unsupported registration status",
      { status: normalized.status }
    );
  }

  // OD-10
  if (
    normalized.status === COMPETITION_REGISTRATION_STATUS.WAITLISTED &&
    normalized.entryId
  ) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
      "WAITLISTED registration must not reference an active Entry (OD-10)",
      { entryId: normalized.entryId }
    );
  }

  for (const ref of normalized.memberRefs || []) {
    if (!ref || !ref.kind || !String(ref.id || "").trim()) {
      throw new RegistrationRuntimeError(
        REGISTRATION_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
        "Each memberRef requires kind and id",
        { registrationId: normalized.id }
      );
    }
  }

  const identity = createRegistrationIdentity({
    competitionId: normalized.competitionId,
    registrationKind: normalized.registrationKind,
    stableSourceIdentity: normalized.sourceId,
  });

  if (normalized.identityKey && normalized.identityKey !== identity.key) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
      "identityKey does not match deterministic identity",
      {
        expected: identity.key,
        actual: normalized.identityKey,
      }
    );
  }

  return createCompetitionRegistration({
    ...normalized,
    identityKey: identity.key,
  });
}

/**
 * Guest refs must survive mapping (never silently dropped).
 * @param {unknown} source
 * @param {import('../../participants/contracts/entryRegistration.js').CompetitionRegistration} registration
 */
export function assertGuestPreserved(source, registration) {
  if (!source || typeof source !== "object") return;
  const playerIds = Array.isArray(source.playerIds) ? source.playerIds : [];
  const playerById =
    source.__playerById && typeof source.__playerById === "object"
      ? source.__playerById
      : null;
  // Detect guests from source player list markers when present on source itself
  const sourceFlagsGuest =
    source.playerType === "guest" ||
    source.isGuest === true ||
    (Array.isArray(source.guests) && source.guests.length > 0);

  if (!sourceFlagsGuest && !playerById) return;

  const guestIds = new Set();
  if (sourceFlagsGuest && source.id) guestIds.add(String(source.id));
  for (const id of playerIds) {
    const p = playerById?.[id];
    if (p && (p.isGuest === true || p.playerType === "guest")) {
      guestIds.add(String(id));
    }
  }
  if (guestIds.size === 0) return;

  const mappedIds = new Set(
    (registration.memberRefs || [])
      .filter((r) => r.kind === "GUEST")
      .map((r) => String(r.id))
  );
  for (const gid of guestIds) {
    if (!mappedIds.has(gid)) {
      throw new RegistrationRuntimeError(
        REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION_MAPPING,
        "Guest registration must be preserved",
        { guestId: gid, registrationId: registration.id }
      );
    }
  }
}
