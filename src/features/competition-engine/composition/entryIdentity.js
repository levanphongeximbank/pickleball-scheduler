/**
 * Competition-unit identity seam for shared pool/qualification/knockout execution.
 *
 * Canonical execution identity = CompetitionEntry.entryId (competing unit).
 *
 * Admission-aware path (requireCanonicalEntryId=true):
 *   - requires proven entryId (object.entryId / competitionEntry.entryId / ::ENTRY:: identity key)
 *   - bare strings are NOT silently promoted to entryId
 *   - participantId is never promoted to entryId
 *
 * Legacy non-admission path:
 *   - may accept participantId / bare string as transport identity
 */

import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";

/** @type {ReadonlySet<string>} */
const PAIR_TEAM_KINDS = new Set(["PAIR", "DOUBLES", "TEAM"]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isProvenEntryIdentityKey(value) {
  return typeof value === "string" && value.includes("::ENTRY::");
}

/**
 * Extract explicit/proven CompetitionEntry.entryId from an object — never from participantId/id.
 * @param {Record<string, unknown>} obj
 * @returns {string}
 */
function extractProvenEntryId(obj) {
  const direct = String(obj.entryId || "").trim();
  if (direct) return direct;
  if (obj.competitionEntry && typeof obj.competitionEntry === "object") {
    const nested = String(
      /** @type {{ entryId?: unknown }} */ (obj.competitionEntry).entryId || ""
    ).trim();
    if (nested) return nested;
  }
  if (isProvenEntryIdentityKey(obj.identityKey)) {
    return String(obj.identityKey).trim();
  }
  return "";
}

/**
 * @param {unknown} raw
 * @param {{
 *   index?: number,
 *   requireIdentity?: boolean,
 *   requireCanonicalEntryId?: boolean,
 *   competitionUnitKind?: string|null,
 * }} [options]
 * @returns {{ entryId: string|null, participantId: string|null, seedNumber?: number }|null}
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
        "competition unit identity required",
        { index: options.index }
      );
    }
    if (requireCanonical) {
      if (isProvenEntryIdentityKey(token)) {
        return { entryId: token, participantId: token };
      }
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "canonical admission path rejects bare-string promotion — wrap proven entryId as { entryId }",
        {
          index: options.index,
          BARE_STRING_CANONICAL_PROMOTION: false,
          PARTICIPANT_ID_SILENT_PROMOTION: false,
        }
      );
    }
    // Legacy: bare string = participantId transport (not a proven entryId claim).
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

  const provenEntryId = extractProvenEntryId(obj);
  const participantOnly = String(obj.participantId || obj.id || "").trim();

  if (requireCanonical || pairOrTeam) {
    if (!provenEntryId) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        pairOrTeam
          ? "PAIR/TEAM admission path requires explicit CompetitionEntry.entryId — participantId cannot masquerade as the competing unit"
          : "canonical admission path requires proven entryId — participantId is not silently promoted",
        {
          index: options.index,
          competitionUnitKind: unitKind || null,
          participantId: participantOnly || null,
          PARTICIPANT_ID_SILENT_PROMOTION: false,
        }
      );
    }
    if (participantOnly && participantOnly !== provenEntryId) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "participantId alias must equal canonical entryId when both are present",
        {
          entryId: provenEntryId,
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
      entryId: provenEntryId,
      participantId: participantOnly || provenEntryId,
      ...(seedNumber != null ? { seedNumber } : {}),
    };
  }

  // Legacy non-admission path.
  if (provenEntryId) {
    if (participantOnly && participantOnly !== provenEntryId) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "participantId alias must equal canonical entryId",
        {
          entryId: provenEntryId,
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
      entryId: provenEntryId,
      participantId: participantOnly || provenEntryId,
      ...(seedNumber != null ? { seedNumber } : {}),
    };
  }

  if (!participantOnly) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "entryId or participantId required",
      { index: options.index }
    );
  }

  const seedNumber =
    Number.isFinite(Number(obj.seedNumber)) && Number(obj.seedNumber) >= 1
      ? Number(obj.seedNumber)
      : undefined;

  // Legacy transport: participantId used as execution token without claiming proven entryId.
  return {
    entryId: participantOnly,
    participantId: participantOnly,
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
    if (!unit || !unit.entryId) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "proven competition unit entryId required",
        { index }
      );
    }
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
      participantId: unit.participantId || unit.entryId,
      ...(unit.seedNumber != null ? { seedNumber: unit.seedNumber } : {}),
    });
  });
  return out;
}
