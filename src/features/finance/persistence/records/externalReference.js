/**
 * Typed external subject references (Phase 1E).
 * Finance stores references only — never duplicated entity profiles.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import { optionalRecordId, requireRecordId } from "../validation/recordValidation.js";

export const EXTERNAL_REFERENCE_KIND = Object.freeze({
  VENUE: "VENUE",
  CLUB: "CLUB",
  COMPETITION: "COMPETITION",
  REGISTRATION: "REGISTRATION",
  ENTRY: "ENTRY",
  BOOKING: "BOOKING",
  PLAYER: "PLAYER",
  CUSTOMER: "CUSTOMER",
});

export const EXTERNAL_REFERENCE_KIND_VALUES = Object.freeze(
  Object.values(EXTERNAL_REFERENCE_KIND)
);

/**
 * @param {object} input
 * @returns {Readonly<{ kind: string, id: string }>|null}
 */
export function createExternalReference(input) {
  if (input == null) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "External reference must be an object when provided.",
      { field: "externalReference" }
    );
  }
  const kind = requireRecordId(input.kind, "kind");
  if (!EXTERNAL_REFERENCE_KIND_VALUES.includes(kind)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      `Unknown external reference kind: ${kind}.`,
      { field: "kind", received: kind }
    );
  }
  const id = requireRecordId(input.id ?? input.referenceId, "id");
  // Reject profile-like payload duplication
  for (const forbidden of [
    "fullName",
    "email",
    "phone",
    "profile",
    "personalProfile",
    "displayName",
  ]) {
    if (input[forbidden] != null) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
        `External reference must not include profile field: ${forbidden}.`,
        { field: forbidden }
      );
    }
  }
  return Object.freeze({ kind, id });
}

/**
 * @param {unknown} refs
 * @returns {ReadonlyArray<Readonly<{ kind: string, id: string }>>}
 */
export function normalizeExternalReferences(refs) {
  if (refs == null) return Object.freeze([]);
  if (!Array.isArray(refs)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "externalReferences must be an array when provided.",
      { field: "externalReferences" }
    );
  }
  return Object.freeze(refs.map((r) => createExternalReference(r)).filter(Boolean));
}

/**
 * Build typed refs from flat domain fields without duplicating profiles.
 *
 * @param {object} source
 * @returns {ReadonlyArray<Readonly<{ kind: string, id: string }>>}
 */
export function externalReferencesFromDomainFields(source = {}) {
  /** @type {Array<{ kind: string, id: string }>} */
  const refs = [];
  const push = (kind, id) => {
    const value = optionalRecordId(id, kind);
    if (value) refs.push({ kind, id: value });
  };
  push(EXTERNAL_REFERENCE_KIND.VENUE, source.venueId);
  push(EXTERNAL_REFERENCE_KIND.CLUB, source.clubId);
  push(EXTERNAL_REFERENCE_KIND.COMPETITION, source.competitionRef ?? source.competitionId);
  push(EXTERNAL_REFERENCE_KIND.REGISTRATION, source.registrationRef ?? source.registrationId);
  push(EXTERNAL_REFERENCE_KIND.ENTRY, source.entryRef ?? source.entryId);
  push(EXTERNAL_REFERENCE_KIND.BOOKING, source.bookingRef ?? source.bookingId);
  push(EXTERNAL_REFERENCE_KIND.PLAYER, source.playerRef ?? source.playerId);
  push(EXTERNAL_REFERENCE_KIND.CUSTOMER, source.customerRef ?? source.customerId);
  if (source.subjectRef && typeof source.subjectRef === "string") {
    // Opaque subject remains a CUSTOMER-like external ref when untyped.
    push(EXTERNAL_REFERENCE_KIND.CUSTOMER, source.subjectRef);
  }
  return normalizeExternalReferences(refs);
}
