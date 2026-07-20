/**
 * CORE-06 Phase 1C — revision helpers (append-only history).
 * Requires injected ISO timestamps — no system clock inside helpers.
 */

import {
  createCompetitionLineupRevision,
  createCompetitionLineupSlot,
} from "../../participants/contracts/teamRosterLineup.js";
import { COMPETITION_LINEUP_STATUS } from "../../participants/enums/statuses.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";
import { buildLineupSlotId } from "../contracts/lineupIdentity.js";

/**
 * @param {unknown[]} slots
 * @param {string} lineupIdentityKey
 * @returns {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineupSlot[]}
 */
export function normalizeSlotsWithDeterministicIds(slots, lineupIdentityKey) {
  const list = Array.isArray(slots) ? slots : [];
  return list.map((raw, fallbackIndex) => {
    const slot = raw && typeof raw === "object" ? raw : {};
    const disciplineOrSideKey = String(slot.disciplineOrSideKey || "").trim();
    const index =
      typeof slot.index === "number" && Number.isInteger(slot.index)
        ? slot.index
        : fallbackIndex;
    const id = buildLineupSlotId({
      lineupIdentityKey,
      disciplineOrSideKey,
      index,
    });
    return createCompetitionLineupSlot({
      ...slot,
      id,
      disciplineOrSideKey,
      index,
    });
  });
}

/**
 * @param {{
 *   lineupId: string,
 *   revision?: number,
 *   status?: string,
 *   slots?: unknown[],
 *   previousRevisionId?: string|null,
 *   actorId?: string|null,
 *   source?: string|null,
 *   reason?: string|null,
 *   createdAt: string,
 *   submittedAt?: string|null,
 *   submittedBy?: string|null,
 *   lockedAt?: string|null,
 *   publishedAt?: string|null,
 *   lineupIdentityKey: string,
 * }} params
 */
export function createInitialRevision(params) {
  const revision =
    typeof params.revision === "number" && Number.isInteger(params.revision)
      ? params.revision
      : 1;
  if (revision < 1) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVISION_INVALID,
      "Initial revision must be a positive integer",
      { revision }
    );
  }
  if (!params.createdAt || typeof params.createdAt !== "string") {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_CLOCK_REQUIRED,
      "Revision helpers require injected createdAt",
      {}
    );
  }

  const slots = normalizeSlotsWithDeterministicIds(
    params.slots,
    params.lineupIdentityKey
  );

  return Object.freeze(
    createCompetitionLineupRevision({
      lineupId: params.lineupId,
      revision,
      previousRevisionId: params.previousRevisionId ?? null,
      status: params.status || COMPETITION_LINEUP_STATUS.DRAFT,
      slots,
      actorId: params.actorId ?? null,
      source: params.source ?? null,
      reason: params.reason ?? null,
      createdAt: params.createdAt,
      submittedAt: params.submittedAt ?? null,
      submittedBy: params.submittedBy ?? null,
      lockedAt: params.lockedAt ?? null,
      publishedAt: params.publishedAt ?? null,
    })
  );
}

/**
 * @param {{
 *   previous: import('../../participants/contracts/teamRosterLineup.js').CompetitionLineupRevision,
 *   status: string,
 *   slots?: unknown[],
 *   actorId?: string|null,
 *   source?: string|null,
 *   reason?: string|null,
 *   createdAt: string,
 *   submittedAt?: string|null,
 *   submittedBy?: string|null,
 *   lockedAt?: string|null,
 *   publishedAt?: string|null,
 *   lineupIdentityKey: string,
 * }} params
 */
export function createNextRevision(params) {
  const previous = params.previous;
  if (!previous || typeof previous !== "object") {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVISION_INVALID,
      "createNextRevision requires previous revision",
      {}
    );
  }
  const nextNumber =
    typeof previous.revision === "number" && Number.isInteger(previous.revision)
      ? previous.revision + 1
      : NaN;
  if (!Number.isInteger(nextNumber) || nextNumber < 2) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVISION_INVALID,
      "Cannot compute next revision number",
      { previousRevision: previous.revision }
    );
  }

  return createInitialRevision({
    lineupId: previous.lineupId,
    revision: nextNumber,
    previousRevisionId: previous.id || `${previous.lineupId}::REV::${previous.revision}`,
    status: params.status,
    slots: params.slots != null ? params.slots : previous.slots,
    actorId: params.actorId ?? null,
    source: params.source ?? null,
    reason: params.reason ?? null,
    createdAt: params.createdAt,
    submittedAt: params.submittedAt ?? null,
    submittedBy: params.submittedBy ?? null,
    lockedAt: params.lockedAt ?? null,
    publishedAt: params.publishedAt ?? null,
    lineupIdentityKey: params.lineupIdentityKey,
  });
}

/**
 * Mark a revision as SUPERSEDED without mutating the original object.
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineupRevision} revision
 * @param {{ reason?: string|null, actorId?: string|null, createdAt: string }} meta
 */
export function supersedeRevision(revision, meta) {
  if (!revision || typeof revision !== "object") {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVISION_INVALID,
      "supersedeRevision requires a revision",
      {}
    );
  }
  if (!meta?.createdAt || typeof meta.createdAt !== "string") {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_CLOCK_REQUIRED,
      "supersedeRevision requires injected createdAt",
      {}
    );
  }

  return Object.freeze(
    createCompetitionLineupRevision({
      ...revision,
      slots: Array.isArray(revision.slots)
        ? revision.slots.map((s) => createCompetitionLineupSlot(s || {}))
        : [],
      status: COMPETITION_LINEUP_STATUS.SUPERSEDED,
      reason: meta.reason ?? revision.reason ?? null,
      actorId: meta.actorId ?? revision.actorId ?? null,
      createdAt: revision.createdAt ?? meta.createdAt,
    })
  );
}

/**
 * Append-only: returns a new history array; never mutates prior entries.
 * @param {readonly unknown[]} history
 * @param {unknown} revision
 * @returns {ReadonlyArray<import('../../participants/contracts/teamRosterLineup.js').CompetitionLineupRevision>}
 */
export function appendRevisionHistory(history, revision) {
  const prev = Array.isArray(history) ? history.map((r) => Object.freeze(r)) : [];
  return Object.freeze([...prev, Object.freeze(revision)]);
}
