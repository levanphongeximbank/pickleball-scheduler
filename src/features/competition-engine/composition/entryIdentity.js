/**
 * Competition-unit identity seam for shared pool/qualification/knockout execution.
 *
 * Canonical execution identity = CompetitionEntry.entryId (competing unit).
 * participantId may remain as a transport/legacy alias ONLY when it equals
 * the canonical competition-entry token.
 *
 * PAIR/TEAM: person participant IDs are not acceptable substitutes for the
 * pair/team competition entry token.
 */

import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";

/**
 * @param {unknown} raw
 * @param {{ index?: number, requireIdentity?: boolean }} [options]
 * @returns {{ entryId: string, participantId: string, seedNumber?: number }|null}
 */
export function normalizeCompetitionUnitIdentity(raw, options = {}) {
  if (raw == null) {
    if (options.requireIdentity === false) return null;
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "competition unit identity required",
      { index: options.index }
    );
  }

  if (typeof raw === "string") {
    const entryId = raw.trim();
    if (!entryId) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "competition unit entryId required",
        { index: options.index }
      );
    }
    return { entryId, participantId: entryId };
  }

  if (typeof raw !== "object") {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "invalid competition unit identity shape",
      { index: options.index }
    );
  }

  const entryId = String(
    /** @type {{ entryId?: unknown }} */ (raw).entryId ||
      /** @type {{ participantId?: unknown }} */ (raw).participantId ||
      /** @type {{ id?: unknown }} */ (raw).id ||
      ""
  ).trim();

  if (!entryId) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "canonical entryId required (participantId alias only when equal to competition entry token)",
      { index: options.index }
    );
  }

  const alias = String(
    /** @type {{ participantId?: unknown }} */ (raw).participantId || ""
  ).trim();
  if (alias && alias !== entryId) {
    // Legacy alias must equal canonical competition-entry token.
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "participantId alias must equal canonical entryId for competition-unit identity",
      { entryId, participantId: alias, index: options.index }
    );
  }

  const seedNumber =
    Number.isFinite(Number(/** @type {{ seedNumber?: unknown }} */ (raw).seedNumber)) &&
    Number(/** @type {{ seedNumber?: unknown }} */ (raw).seedNumber) >= 1
      ? Number(/** @type {{ seedNumber?: unknown }} */ (raw).seedNumber)
      : undefined;

  return {
    entryId,
    participantId: entryId,
    ...(seedNumber != null ? { seedNumber } : {}),
  };
}

/**
 * @param {unknown[]} participants
 * @returns {{ entryId: string, participantId: string, seedNumber: number }[]}
 */
export function normalizeCompetitionUnitParticipants(participants) {
  const list = Array.isArray(participants) ? participants : [];
  const seen = new Set();
  const out = [];
  list.forEach((raw, index) => {
    const unit = normalizeCompetitionUnitIdentity(raw, { index });
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
      seedNumber: unit.seedNumber != null ? unit.seedNumber : index + 1,
    });
  });
  return out;
}
