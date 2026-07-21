/**
 * CORE-06 Phase 1D — roster candidate normalization.
 * Does not mutate input roster. Opaque participant ids preserved.
 */

import { participantToken } from "../services/rosterMembership.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";

/**
 * Code-unit lexicographic compare (locale-independent).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareCanonicalStrings(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * @param {unknown} rosterSnapshot
 * @returns {{
 *   candidates: Array<{
 *     identityToken: string,
 *     person: { kind: string, id: string },
 *     attrs: Record<string, unknown>,
 *   }>,
 *   rosterId: string|null,
 *   rosterVersion: string|number|null,
 * }}
 */
export function normalizeRosterCandidates(rosterSnapshot) {
  if (rosterSnapshot == null || typeof rosterSnapshot !== "object") {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_ROSTER_SNAPSHOT,
      "Roster snapshot must be an object",
      {}
    );
  }

  const snap = /** @type {Record<string, unknown>} */ (rosterSnapshot);
  const members = Array.isArray(snap.members) ? snap.members : null;
  if (!members) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_ROSTER_SNAPSHOT,
      "Roster snapshot requires members array",
      {}
    );
  }

  if (members.length === 0) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.EMPTY_ROSTER,
      "Roster snapshot has no members",
      {}
    );
  }

  /** @type {Map<string, { identityToken: string, person: { kind: string, id: string }, attrs: Record<string, unknown> }>} */
  const byToken = new Map();

  for (let i = 0; i < members.length; i += 1) {
    const member = members[i];
    if (!member || typeof member !== "object") {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_ROSTER_SNAPSHOT,
        "Roster member must be an object",
        { index: i }
      );
    }
    const person = /** @type {{ person?: unknown }} */ (member).person;
    if (!person || typeof person !== "object") {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_ROSTER_SNAPSHOT,
        "Roster member requires person reference",
        { index: i }
      );
    }
    const kind = String(
      /** @type {{ kind?: unknown }} */ (person).kind || ""
    ).trim();
    const id = String(/** @type {{ id?: unknown }} */ (person).id || "").trim();
    if (!kind || !id) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_ROSTER_SNAPSHOT,
        "Roster person requires kind and id",
        { index: i }
      );
    }
    const token = participantToken(
      /** @type {import('../../participants/contracts/identity.js').ParticipantReference} */ ({
        kind,
        id,
      })
    );
    if (!token) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_ROSTER_SNAPSHOT,
        "Unable to derive participant identity token",
        { index: i }
      );
    }
    if (byToken.has(token)) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.DUPLICATE_ROSTER_MEMBER,
        "Duplicate roster member identity",
        { identityToken: token }
      );
    }
    byToken.set(token, {
      identityToken: token,
      person: Object.freeze({ kind, id }),
      attrs: Object.freeze({}),
    });
  }

  const candidates = [...byToken.values()].sort((a, b) =>
    compareCanonicalStrings(a.identityToken, b.identityToken)
  );

  return {
    candidates: candidates.map((c) =>
      Object.freeze({
        identityToken: c.identityToken,
        person: c.person,
        attrs: c.attrs,
      })
    ),
    rosterId:
      snap.id != null && String(snap.id).trim() !== ""
        ? String(snap.id).trim()
        : snap.rosterId != null && String(snap.rosterId).trim() !== ""
          ? String(snap.rosterId).trim()
          : null,
    rosterVersion:
      snap.version != null
        ? /** @type {string|number} */ (snap.version)
        : snap.rosterVersion != null
          ? /** @type {string|number} */ (snap.rosterVersion)
          : null,
  };
}

/**
 * @param {unknown} slotTemplate
 * @returns {Array<{ disciplineOrSideKey: string, index: number }>}
 */
export function normalizeSlotTemplate(slotTemplate) {
  if (slotTemplate == null || typeof slotTemplate !== "object") {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_SLOT_TEMPLATE,
      "Slot template must be an object",
      {}
    );
  }
  const rawSlots = /** @type {{ slots?: unknown }} */ (slotTemplate).slots;
  if (!Array.isArray(rawSlots) || rawSlots.length === 0) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_SLOT_TEMPLATE,
      "Slot template requires non-empty slots array",
      {}
    );
  }

  /** @type {Array<{ disciplineOrSideKey: string, index: number }>} */
  const slots = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (let i = 0; i < rawSlots.length; i += 1) {
    const slot = rawSlots[i];
    if (!slot || typeof slot !== "object") {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_SLOT_TEMPLATE,
        "Each slot template entry must be an object",
        { index: i }
      );
    }
    const disciplineOrSideKey = String(
      /** @type {{ disciplineOrSideKey?: unknown }} */ (slot)
        .disciplineOrSideKey || ""
    ).trim();
    const indexRaw = /** @type {{ index?: unknown }} */ (slot).index;
    const index =
      typeof indexRaw === "number" && Number.isInteger(indexRaw)
        ? indexRaw
        : Number.NaN;
    if (!disciplineOrSideKey || !Number.isInteger(index) || index < 0) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_SLOT_TEMPLATE,
        "Slot requires disciplineOrSideKey and non-negative integer index",
        { index: i }
      );
    }
    const key = `${disciplineOrSideKey}::${index}`;
    if (seen.has(key)) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_SLOT_TEMPLATE,
        "Duplicate slot template key",
        { slotKey: key }
      );
    }
    seen.add(key);
    slots.push({ disciplineOrSideKey, index });
  }

  slots.sort((a, b) => {
    const c = compareCanonicalStrings(
      a.disciplineOrSideKey,
      b.disciplineOrSideKey
    );
    if (c !== 0) return c;
    return a.index - b.index;
  });

  return slots.map((s) => Object.freeze({ ...s }));
}
