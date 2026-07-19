/**
 * Phase 3E — roster membership + duplicate participant checks.
 */

import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";

/**
 * @param {import('../../participants/contracts/identity.js').ParticipantReference|null|undefined} person
 * @returns {string}
 */
export function participantToken(person) {
  if (!person || typeof person !== "object") return "";
  const kind = String(person.kind || "").trim();
  const id = String(person.id || "").trim();
  if (!kind || !id) return "";
  return `${kind}:${id}`;
}

/**
 * Build a set of roster member person tokens from an injected roster snapshot.
 * Accepts CompetitionRoster-like or { members: [{ person }] } shapes.
 *
 * @param {unknown} roster
 * @returns {Set<string>|null} null when roster not provided
 */
export function buildRosterMemberTokenSet(roster) {
  if (roster == null) return null;
  if (typeof roster !== "object") {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_ROSTER_MISMATCH,
      "Injected roster must be an object",
      {}
    );
  }
  const members = Array.isArray(
    /** @type {{ members?: unknown }} */ (roster).members
  )
    ? /** @type {{ members: unknown[] }} */ (roster).members
    : [];
  /** @type {Set<string>} */
  const tokens = new Set();
  for (const member of members) {
    if (!member || typeof member !== "object") continue;
    const person = /** @type {{ person?: unknown }} */ (member).person;
    const token = participantToken(
      /** @type {import('../../participants/contracts/identity.js').ParticipantReference} */ (
        person
      )
    );
    if (token) tokens.add(token);
  }
  return tokens;
}

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup} lineup
 * @param {unknown} [roster]
 * @param {{ allowDuplicateParticipants?: boolean }} [options]
 */
export function assertLineupRosterMembership(lineup, roster, options = {}) {
  const slots = Array.isArray(lineup?.slots) ? lineup.slots : [];
  const allowDuplicates = options.allowDuplicateParticipants === true;
  const rosterTokens = buildRosterMemberTokenSet(roster);

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Set<string>} */
  const slotKeys = new Set();

  for (const slot of slots) {
    if (!slot || typeof slot !== "object") {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_REQUIRED,
        "Lineup slot must be an object",
        { lineupId: lineup?.id }
      );
    }

    const discipline = String(slot.disciplineOrSideKey || "").trim();
    const index =
      typeof slot.index === "number" && Number.isInteger(slot.index)
        ? slot.index
        : -1;
    if (!discipline || index < 0) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_REQUIRED,
        "Each slot requires disciplineOrSideKey and non-negative index",
        { lineupId: lineup?.id }
      );
    }

    const slotKey = `${discipline}::${index}`;
    if (slotKeys.has(slotKey)) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_DUPLICATE,
        "Duplicate lineup slot key",
        { lineupId: lineup?.id, slotKey }
      );
    }
    slotKeys.add(slotKey);

    const token = participantToken(slot.person);
    if (!token) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
        "Slot person requires kind and id",
        { lineupId: lineup?.id, slotKey }
      );
    }

    if (!allowDuplicates && seen.has(token)) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_DUPLICATE_PARTICIPANT,
        "Duplicate participant in lineup slots",
        { lineupId: lineup?.id, participant: token }
      );
    }
    seen.add(token);

    if (rosterTokens && !rosterTokens.has(token)) {
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_PARTICIPANT_NOT_IN_ROSTER,
        "Lineup participant is not in injected roster",
        { lineupId: lineup?.id, participant: token }
      );
    }
  }
}
