/**
 * E2E-04 Player Competition Operations application facade.
 *
 * Owns player-facing orchestration, ownership checks, and projections.
 * Reuses E2E-01 / E2E-03 Organizer ops store / Core handoffs — no parallel engines.
 */

import { createCompetitionRuntimePorts } from "../../integration/composition/createCompetitionRuntimePorts.js";
import { createInMemoryOrganizerOperationsStore } from "../store/createInMemoryOrganizerOperationsStore.js";
import {
  PLAYER_ACTION,
  PLAYER_ERROR_CODE,
  E2E04_PLAYER_OPERATIONS_VERSION,
} from "./constants.js";
import {
  failPlayer,
  isPlayerOperationsError,
  normalizePlayerError,
} from "./errors.js";
import { authorizePlayerCommand } from "./context/authorizePlayerCommand.js";
import { resolvePlayerEntryOwnership } from "./context/resolvePlayerEntryOwnership.js";
import {
  applyPlayerCheckInMark,
  assertPlayerCheckInAllowed,
  summarizePlayerCheckIn,
} from "./checkin/playerCheckInBoundary.js";
import { buildPlayerOperationsProjection } from "./projections/buildPlayerOperationsProjection.js";
import {
  computeOrganizerFingerprint,
  deepFreeze,
  isNonEmptyString,
  snapshotInput,
} from "../fingerprint.js";
/**
 * @param {object} deps
 */
export function createPlayerCompetitionOperationsFacade(deps = {}) {
  const clockIso = isNonEmptyString(deps.clockIso)
    ? String(deps.clockIso).trim()
    : "2026-07-24T00:00:00.000Z";

  const organizerStore =
    deps.organizerStore ||
    createInMemoryOrganizerOperationsStore({ clockIso });

  const runtimePorts =
    deps.runtimePorts || createCompetitionRuntimePorts(deps.runtimePortDeps || {});

  /** @type {Map<string, object>} */
  const handoffByScope = new Map();

  /**
   * @param {string} tenantId
   * @param {string} competitionId
   */
  function scopeKey(tenantId, competitionId) {
    return `${String(tenantId).trim()}::${String(competitionId).trim()}`;
  }

  /**
   * Inject certified projection handoffs (schedule/standings/etc). Never computes engines.
   * @param {{ tenantId: string, competitionId: string, handoffs: object }} input
   */
  function setProjectionHandoffs(input) {
    const tenantId = String(input.tenantId || "").trim();
    const competitionId = String(input.competitionId || "").trim();
    if (!tenantId || !competitionId) {
      failPlayer(
        PLAYER_ERROR_CODE.INVALID_INPUT,
        "tenantId and competitionId are required to set handoffs",
        {}
      );
    }
    handoffByScope.set(
      scopeKey(tenantId, competitionId),
      deepFreeze(snapshotInput(input.handoffs || {}))
    );
    return deepFreeze({
      ok: true,
      fingerprint: computeOrganizerFingerprint(
        { tenantId, competitionId, handoffs: input.handoffs || {} },
        "e2e04-player-handoff"
      ),
    });
  }

  /**
   * @param {object} command
   * @param {string} action
   */
  async function authorize(command, action) {
    return authorizePlayerCommand({
      action,
      actor: command.actor,
      tenantId: command.tenantId,
      competitionId: command.competitionId,
      venueId: command.venueId,
      runtimePorts,
      context: command.context,
    });
  }

  /**
   * @param {object} command
   */
  function loadRecord(command) {
    const tenantId = String(command.tenantId || "").trim();
    const competitionId = String(command.competitionId || "").trim();
    const record = organizerStore.getRaw
      ? organizerStore.getRaw(tenantId, competitionId)
      : null;
    if (!record) {
      failPlayer(
        PLAYER_ERROR_CODE.MISSING_COMPETITION,
        "Competition operations record not found",
        { tenantId, competitionId }
      );
    }
    if (
      isNonEmptyString(record.tenantId) &&
      String(record.tenantId).trim() !== tenantId
    ) {
      failPlayer(
        PLAYER_ERROR_CODE.CROSS_TENANT_REJECTED,
        "Competition record tenant mismatch",
        { tenantId, recordTenantId: record.tenantId }
      );
    }
    return record;
  }

  /**
   * @param {object} command
   * @param {object} record
   */
  function resolveOwnership(command, record) {
    return resolvePlayerEntryOwnership({
      actor: command.actor,
      claimedPlayerId: command.playerId,
      claimedEntryId: command.entryId,
      claimedParticipantId: command.participantId,
      record,
      runtimePorts,
    });
  }

  /**
   * @param {object} auth
   * @returns {string[]}
   */
  function grantedFromAuth(auth) {
    return (
      auth.decision?.explanation?.grantedPermissions ||
      auth.decision?.details?.grantedPermissions ||
      []
    );
  }

  /**
   * @param {object} command
   * @param {object} auth
   * @param {object} record
   * @param {object} ownership
   */
  function project(command, auth, record, ownership) {
    const handoffs =
      handoffByScope.get(scopeKey(command.tenantId, command.competitionId)) ||
      {};
    return buildPlayerOperationsProjection({
      record,
      ownership,
      grantedPermissions: grantedFromAuth(auth),
      handoffs: {
        ...handoffs,
        ...(command.handoffs && typeof command.handoffs === "object"
          ? command.handoffs
          : {}),
      },
    });
  }

  /**
   * @param {object} command
   * @param {Function} fn
   */
  async function run(command, fn) {
    const inputSnap = snapshotInput(command);
    try {
      const result = await fn(command);
      // Immutability proof: caller input must remain unchanged.
      if (JSON.stringify(snapshotInput(command)) !== JSON.stringify(inputSnap)) {
        failPlayer(
          PLAYER_ERROR_CODE.INVALID_INPUT,
          "Player facade must not mutate caller input",
          {}
        );
      }
      return result;
    } catch (err) {
      if (isPlayerOperationsError(err)) throw err;
      throw normalizePlayerError(
        err,
        PLAYER_ERROR_CODE.CANONICAL_CALL_FAILED,
        "Player operations canonical call failed"
      );
    }
  }

  async function getPlayerCompetitionState(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, PLAYER_ACTION.OPERATIONS_READ);
      const record = loadRecord(cmd);
      const ownership = resolveOwnership(cmd, record);
      const projection = project(cmd, auth, record, ownership);
      return deepFreeze({
        ok: true,
        version: E2E04_PLAYER_OPERATIONS_VERSION,
        auth: Object.freeze({
          action: auth.action,
          capability: auth.capability,
          subject: auth.subject,
          scope: auth.scope,
        }),
        ownership: Object.freeze({
          actorCanonicalPlayerId: ownership.actorCanonicalPlayerId,
          mappedParticipantId: ownership.mappedParticipantId,
          entryId: ownership.entryId,
          participantId: ownership.participantId,
        }),
        projection,
        fingerprint: projection.projectionFingerprint,
      });
    });
  }

  async function getPlayerSchedule(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, PLAYER_ACTION.SCHEDULE_READ);
      const record = loadRecord(cmd);
      const ownership = resolveOwnership(cmd, record);
      const projection = project(cmd, auth, record, ownership);
      return deepFreeze({
        ok: true,
        schedule: projection.schedule,
        fingerprint: computeOrganizerFingerprint(
          projection.schedule,
          "e2e04-player-schedule"
        ),
      });
    });
  }

  async function getPlayerCheckInState(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, PLAYER_ACTION.OPERATIONS_READ);
      const record = loadRecord(cmd);
      const ownership = resolveOwnership(cmd, record);
      void auth;
      const checkIn = summarizePlayerCheckIn(record, ownership);
      return deepFreeze({
        ok: true,
        checkIn,
        fingerprint: computeOrganizerFingerprint(
          checkIn,
          "e2e04-player-checkin"
        ),
      });
    });
  }

  async function checkInPlayer(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, PLAYER_ACTION.CHECKIN_SELF);
      const record = loadRecord(cmd);
      const ownership = resolveOwnership(cmd, record);
      assertPlayerCheckInAllowed(record, ownership);

      const updated = organizerStore.update(
        cmd.tenantId,
        cmd.competitionId,
        (draft) => {
          const result = applyPlayerCheckInMark(draft, ownership.participantId);
          draft.lastPlayerCheckIn = Object.freeze({
            participantId: ownership.participantId,
            actorId: auth.subject.actorId,
            at: clockIso,
            idempotent: result.idempotent,
          });
        }
      );

      const checkIn = summarizePlayerCheckIn(updated, ownership);
      return deepFreeze({
        ok: true,
        idempotent: Boolean(updated.lastPlayerCheckIn?.idempotent),
        checkIn,
        fingerprint: computeOrganizerFingerprint(
          {
            participantId: ownership.participantId,
            checkIn,
            revision: updated.revision,
          },
          "e2e04-player-checkin-cmd"
        ),
      });
    });
  }

  async function getPlayerMatchState(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, PLAYER_ACTION.MATCH_READ);
      const record = loadRecord(cmd);
      const ownership = resolveOwnership(cmd, record);
      const projection = project(cmd, auth, record, ownership);
      return deepFreeze({
        ok: true,
        matches: projection.matches,
        fingerprint: computeOrganizerFingerprint(
          projection.matches,
          "e2e04-player-match"
        ),
      });
    });
  }

  async function getPlayerStandingsState(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, PLAYER_ACTION.STANDINGS_READ);
      const record = loadRecord(cmd);
      const ownership = resolveOwnership(cmd, record);
      const projection = project(cmd, auth, record, ownership);
      return deepFreeze({
        ok: true,
        standings: projection.standings,
        fingerprint: computeOrganizerFingerprint(
          { standings: projection.standings },
          "e2e04-player-standings"
        ),
      });
    });
  }

  async function getPlayerQualificationState(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, PLAYER_ACTION.QUALIFICATION_READ);
      const record = loadRecord(cmd);
      const ownership = resolveOwnership(cmd, record);
      const projection = project(cmd, auth, record, ownership);
      return deepFreeze({
        ok: true,
        qualification: projection.qualification,
        fingerprint: computeOrganizerFingerprint(
          { qualification: projection.qualification },
          "e2e04-player-qualification"
        ),
      });
    });
  }

  async function getPlayerKnockoutState(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, PLAYER_ACTION.KNOCKOUT_READ);
      const record = loadRecord(cmd);
      const ownership = resolveOwnership(cmd, record);
      const projection = project(cmd, auth, record, ownership);
      return deepFreeze({
        ok: true,
        knockout: projection.knockout,
        fingerprint: computeOrganizerFingerprint(
          { knockout: projection.knockout },
          "e2e04-player-knockout"
        ),
      });
    });
  }

  async function getPlayerFinalResultState(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, PLAYER_ACTION.FINAL_RESULT_READ);
      const record = loadRecord(cmd);
      const ownership = resolveOwnership(cmd, record);
      const projection = project(cmd, auth, record, ownership);
      return deepFreeze({
        ok: true,
        finalResult: projection.finalResult,
        fingerprint: computeOrganizerFingerprint(
          { finalResult: projection.finalResult },
          "e2e04-player-final"
        ),
      });
    });
  }

  return Object.freeze({
    kind: "player-competition-operations-facade",
    version: E2E04_PLAYER_OPERATIONS_VERSION,
    organizerStore,
    setProjectionHandoffs,
    getPlayerCompetitionState,
    getPlayerSchedule,
    getPlayerCheckInState,
    checkInPlayer,
    getPlayerMatchState,
    getPlayerStandingsState,
    getPlayerQualificationState,
    getPlayerKnockoutState,
    getPlayerFinalResultState,
  });
}

/**
 * Convenience named export matching Organizer style.
 * @param {object} [deps]
 * @param {object} command
 */
export async function getPlayerCompetitionState(deps, command) {
  const facade =
    deps && typeof deps.getPlayerCompetitionState === "function"
      ? deps
      : createPlayerCompetitionOperationsFacade(deps || {});
  return facade.getPlayerCompetitionState(command);
}
