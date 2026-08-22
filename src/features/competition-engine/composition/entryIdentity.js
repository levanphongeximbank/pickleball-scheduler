/**
 * Competition-unit identity seam for shared pool/qualification/knockout execution.
 *
 * Canonical execution identity = CompetitionEntry.entryId (competing unit).
 *
 * Admission-aware path (requireCanonicalEntryId=true):
 *   - requires explicit entryId (or CompetitionEntry identity key / entry.entryId)
 *   - does NOT silently promote participantId / id into entryId
 *
 * Legacy non-admission path:
 *   - may accept participantId as transport alias when compatibility requires it
 *
 * PAIR/TEAM: person participant IDs are never acceptable substitutes.
 */

import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";

/** @type {ReadonlySet<string>} */
const PAIR_TEAM_KINDS = new Set(["PAIR", "DOUBLES", "TEAM"]);

/**
 * @param {unknown} raw
 * @param {{
 *   index?: number,
 *   requireIdentity?: boolean,
 *   requireCanonicalEntryId?: boolean,
 *   competitionUnitKind?: string|null,
 * }} [options]
 * @returns {{ entryId: string, participantId: string, seedNumber?: number }|null}
 */
export function normalizeCompetitionUnitIdentity(raw, options = {}) {
  const requireCanonical = options.requireCanonicalEntryId === true;
  const unitKind = String(options.competitionUnitKind || "")
    .trim()
    .toUpperCase();
  const pairOrTeam = PAIR_TEAM_KINDS.has(unitKind);

  if (raw == null) {
    if (options.requireIdentity === false) return null;
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "competition unit identity required",
      { index: options.index }
    );
  }

  if (typeof raw === "string") {
    const token = raw.trim();
    if (!token) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "competition unit entryId required",
        { index: options.index }
      );
    }
    // Bare string is treated as an already-canonical entry token when provided
    // by the caller as competitionPopulation entryIds — not a person participantId promotion.
    if (requireCanonical && pairOrTeam) {
      // PAIR/TEAM bare tokens are allowed only as explicit entryId strings from the
      // competition population; person-shaped inputs must use object form with entryId.
      // Caller responsibility: do not pass person IDs as bare strings for PAIR/TEAM.
    }
    return { entryId: token, participantId: token };
  }

  if (typeof raw !== "object") {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "invalid competition unit identity shape",
      { index: options.index }
    );
  }

  const obj = /** @type {Record<string, unknown>} */ (raw);
  if (obj.displayName != null && obj.entryId == null) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "displayName is not competition-unit identity",
      { index: options.index }
    );
  }

  const explicitEntryId = String(
    obj.entryId ||
      (obj.competitionEntry &&
      typeof obj.competitionEntry === "object" &&
      /** @type {{ entryId?: unknown }} */ (obj.competitionEntry).entryId) ||
      (typeof obj.identityKey === "string" &&
      String(obj.identityKey).includes("::ENTRY::")
        ? obj.identityKey
        : "") ||
      ""
  ).trim();

  const participantOnly = String(obj.participantId || obj.id || "").trim();

  if (requireCanonical || pairOrTeam) {
    if (!explicitEntryId) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        pairOrTeam
          ? "PAIR/TEAM admission path requires explicit CompetitionEntry.entryId — participantId cannot masquerade as the competing unit"
          : "canonical admission path requires explicit entryId — participantId is not silently promoted",
        {
          index: options.index,
          competitionUnitKind: unitKind || null,
          participantId: participantOnly || null,
          PARTICIPANT_ID_SILENT_PROMOTION: false,
        }
      );
    }
    if (participantOnly && participantOnly !== explicitEntryId) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "participantId alias must equal canonical entryId when both are present",
        {
          entryId: explicitEntryId,
          participantId: participantOnly,
          index: options.index,
        }
      );
    }
    const seedNumber =
      Number.isFinite(Number(obj.seedNumber)) && Number(obj.seedNumber) >= 1
        ? Number(obj.seedNumber)
        : undefined;
    return {
      entryId: explicitEntryId,
      participantId: explicitEntryId,
      ...(seedNumber != null ? { seedNumber } : {}),
    };
  }

  // Legacy non-admission path: participantId/id may act as transport alias.
  const entryId = explicitEntryId || participantOnly;
  if (!entryId) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "entryId or participantId required",
      { index: options.index }
    );
  }
  if (
    explicitEntryId &&
    participantOnly &&
    participantOnly !== explicitEntryId
  ) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "participantId alias must equal canonical entryId",
      { entryId: explicitEntryId, participantId: participantOnly, index: options.index }
    );
  }

  const seedNumber =
    Number.isFinite(Number(obj.seedNumber)) && Number(obj.seedNumber) >= 1
      ? Number(obj.seedNumber)
      : undefined;

  return {
    entryId,
    participantId: entryId,
    ...(seedNumber != null ? { seedNumber } : {}),
  };
}

/**
 * @param {unknown[]} participants
 * @param {{
 *   requireCanonicalEntryId?: boolean,
 *   competitionUnitKind?: string|null,
 * }} [options]
 * @returns {{ entryId: string, participantId: string, seedNumber?: number }[]}
 */
export function normalizeCompetitionUnitParticipants(participants, options = {}) {
  const list = Array.isArray(participants) ? participants : [];
  const seen = new Set();
  const out = [];
  list.forEach((raw, index) => {
    const unit = normalizeCompetitionUnitIdentity(raw, {
      index,
      requireCanonicalEntryId: options.requireCanonicalEntryId === true,
      competitionUnitKind: options.competitionUnitKind,
    });
    if (!unit) return;
    if (seen.has(unit.entryId)) {
      failE2E02(
        E2E02_ERROR_CODE.DUPLICATE_PARTICIPANT,
        "duplicate competition unit entryId rejected",
        { entryId: unit.entryId }
      );
    }
    seen.add(unit.entryId);
    out.push({
      entryId: unit.entryId,
      participantId: unit.entryId,
      ...(unit.seedNumber != null ? { seedNumber: unit.seedNumber } : {}),
    });
  });
  return out;
}
