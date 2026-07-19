/**
 * Phase 3E — normalize + validate CompetitionLineup (runtime-local).
 */

import {
  createCompetitionLineup,
  createCompetitionLineupSlot,
} from "../../participants/contracts/teamRosterLineup.js";
import { isCompetitionLineupStatus } from "../../participants/enums/statuses.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";
import {
  buildLineupSlotId,
  createLineupIdentity,
} from "../contracts/lineupIdentity.js";
import { assertLineupRosterMembership } from "./rosterMembership.js";

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup} lineup
 * @param {{ roster?: unknown, allowDuplicateParticipants?: boolean, requireSlots?: boolean }} [options]
 * @returns {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup}
 */
export function normalizeAndValidateLineup(lineup, options = {}) {
  if (!lineup || typeof lineup !== "object") {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
      "Lineup must be an object",
      {}
    );
  }

  const normalized = createCompetitionLineup(lineup);

  if (!normalized.competitionId) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
      "competitionId is required",
      {}
    );
  }
  if (!normalized.teamId) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
      "teamId is required",
      {}
    );
  }
  if (!normalized.contextId) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
      "contextId is required",
      {}
    );
  }
  if (!isCompetitionLineupStatus(normalized.status)) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.UNSUPPORTED_LINEUP_STATUS,
      "Unsupported lineup status",
      { status: normalized.status }
    );
  }
  if (
    typeof normalized.revision !== "number" ||
    !Number.isInteger(normalized.revision) ||
    normalized.revision < 1
  ) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
      "revision must be an integer >= 1",
      { revision: normalized.revision }
    );
  }

  const identity = createLineupIdentity({
    competitionId: normalized.competitionId,
    contextId: normalized.contextId,
    teamId: normalized.teamId,
  });

  if (normalized.identityKey && normalized.identityKey !== identity.key) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDENTITY_MISMATCH,
      "identityKey does not match deterministic lineup identity",
      {
        expected: identity.key,
        actual: normalized.identityKey,
      }
    );
  }

  const slots = (normalized.slots || []).map((slot, fallbackIndex) => {
    const index =
      typeof slot.index === "number" && Number.isInteger(slot.index)
        ? slot.index
        : fallbackIndex;
    const discipline = String(slot.disciplineOrSideKey || "").trim();
    const id =
      slot.id && String(slot.id).trim()
        ? String(slot.id)
        : buildLineupSlotId({
            lineupIdentityKey: identity.key,
            disciplineOrSideKey: discipline,
            index,
          });
    return createCompetitionLineupSlot({
      ...slot,
      id,
      disciplineOrSideKey: discipline,
      index,
    });
  });

  if (options.requireSlots === true && slots.length === 0) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_REQUIRED,
      "At least one lineup slot is required",
      { lineupId: identity.key }
    );
  }

  const withIdentity = createCompetitionLineup({
    ...normalized,
    id: normalized.id || identity.key,
    identityKey: identity.key,
    slots,
  });

  assertLineupRosterMembership(withIdentity, options.roster, {
    allowDuplicateParticipants: options.allowDuplicateParticipants === true,
  });

  return withIdentity;
}
