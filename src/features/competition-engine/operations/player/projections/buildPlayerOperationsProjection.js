/**
 * Player-facing operational projection — aggregates certified handoffs only.
 * Does not compute schedule, standings, winners, or brackets.
 */

import {
  CHECKIN_STATE,
  ENTRY_OPS_STATUS,
  MATCH_OPS_STATE,
  PUBLICATION_OPS_STATE,
} from "../../constants.js";
import {
  PLAYER_ACTION,
  PLAYER_BLOCKER_CODE,
  PLAYER_CHECKIN_MARK,
} from "../constants.js";
import {
  computeOrganizerFingerprint,
  deepFreeze,
  isNonEmptyString,
} from "../../fingerprint.js";
import {
  PLAYER_ACTION_PERMISSION_MAP,
  resolvePlayerActionPermissions,
} from "../permissions/playerActionMap.js";
import { summarizePlayerCheckIn } from "../checkin/playerCheckInBoundary.js";

/**
 * @param {object} record
 * @param {object} ownership
 * @param {object} [handoffs]
 */
function collectBlockingIssues(record, ownership, handoffs = {}) {
  /** @type {object[]} */
  const issues = [];
  const entryStatus = String(
    ownership.entry?.status || ENTRY_OPS_STATUS.PENDING
  ).toUpperCase();

  if (entryStatus !== ENTRY_OPS_STATUS.ELIGIBLE) {
    issues.push({
      code: PLAYER_BLOCKER_CODE.ENTRY_INELIGIBLE,
      message: "Entry eligibility is unresolved or ineligible",
      status: entryStatus,
    });
  }

  const checkIn = summarizePlayerCheckIn(record, ownership);
  if (
    record.checkInRequired !== false &&
    checkIn.windowState === CHECKIN_STATE.OPEN &&
    !checkIn.checkedIn
  ) {
    issues.push({
      code: PLAYER_BLOCKER_CODE.CHECKIN_NOT_OPEN,
      message: "Player has not checked in while window is open",
      windowState: checkIn.windowState,
    });
  }
  if (
    record.checkInRequired !== false &&
    checkIn.windowState === CHECKIN_STATE.NOT_OPENED
  ) {
    issues.push({
      code: PLAYER_BLOCKER_CODE.CHECKIN_NOT_OPEN,
      message: "Organizer has not opened check-in",
      windowState: checkIn.windowState,
    });
  }

  if (!handoffs.scheduleSnapshot && !record.scheduleFingerprint) {
    issues.push({
      code: PLAYER_BLOCKER_CODE.COMPETITION_STATE_BLOCKED,
      message: "Schedule visibility handoff is not available",
    });
  }

  return issues;
}

/**
 * @param {object} record
 * @param {object} ownership
 * @param {Set<string>} grantedPermissions
 * @param {object} checkIn
 */
function buildActionMatrix(record, ownership, grantedPermissions, checkIn) {
  const allowed = [];
  const denied = [];

  for (const action of Object.keys(PLAYER_ACTION_PERMISSION_MAP)) {
    const mapping = resolvePlayerActionPermissions(action);
    const hasPerm = mapping.requiredPermissions.some((p) =>
      grantedPermissions.has(p)
    );
    if (!hasPerm) {
      denied.push({
        action,
        capability: mapping.capability,
        reasonCode: PLAYER_BLOCKER_CODE.PERMISSION_DENIED,
        requiredPermissions: [...mapping.requiredPermissions],
      });
      continue;
    }

    if (action === PLAYER_ACTION.CHECKIN_SELF) {
      const status = String(
        ownership.entry?.status || ""
      ).toUpperCase();
      if (status !== ENTRY_OPS_STATUS.ELIGIBLE) {
        denied.push({
          action,
          capability: mapping.capability,
          reasonCode: PLAYER_BLOCKER_CODE.ENTRY_INELIGIBLE,
        });
        continue;
      }
      if (checkIn.windowState !== CHECKIN_STATE.OPEN) {
        denied.push({
          action,
          capability: mapping.capability,
          reasonCode:
            checkIn.windowState === CHECKIN_STATE.CLOSED
              ? PLAYER_BLOCKER_CODE.CHECKIN_CLOSED
              : PLAYER_BLOCKER_CODE.CHECKIN_NOT_OPEN,
        });
        continue;
      }
    }

    allowed.push({
      action,
      capability: mapping.capability,
    });
  }

  return { allowed, denied };
}

/**
 * Filter schedule/match rows to the authenticated player's entries only.
 * @param {unknown} rows
 * @param {ReadonlyArray<string>} ownedEntryIds
 * @param {string} participantId
 */
function filterOwnRows(rows, ownedEntryIds, participantId) {
  if (!Array.isArray(rows)) return [];
  const owned = new Set(ownedEntryIds.map(String));
  return rows
    .filter((row) => {
      if (!row || typeof row !== "object") return false;
      const r = /** @type {Record<string, unknown>} */ (row);
      const ids = [
        r.participantId,
        r.entryId,
        r.playerId,
        ...(Array.isArray(r.participantIds) ? r.participantIds : []),
        ...(Array.isArray(r.entryIds) ? r.entryIds : []),
      ]
        .map((v) => String(v || "").trim())
        .filter(Boolean);
      return (
        ids.includes(participantId) || ids.some((id) => owned.has(id))
      );
    })
    .map((row) => Object.freeze({ ...row }));
}

/**
 * @param {{
 *   record: object,
 *   ownership: object,
 *   grantedPermissions?: Iterable<string>,
 *   handoffs?: {
 *     competitionName?: string,
 *     division?: string|null,
 *     category?: string|null,
 *     seed?: number|null,
 *     poolId?: string|null,
 *     scheduleSnapshot?: object|null,
 *     courtSnapshot?: object|null,
 *     matchSnapshot?: object|null,
 *     standingsSnapshot?: object|null,
 *     qualificationSnapshot?: object|null,
 *     knockoutSnapshot?: object|null,
 *     finalResultSnapshot?: object|null,
 *   },
 * }} input
 */
export function buildPlayerOperationsProjection(input) {
  const record = input.record || {};
  const ownership = input.ownership || {};
  const handoffs = input.handoffs || {};
  const grantedPermissions = new Set(
    Array.isArray(input.grantedPermissions)
      ? input.grantedPermissions
      : input.grantedPermissions
        ? [...input.grantedPermissions]
        : []
  );

  const checkIn = summarizePlayerCheckIn(record, ownership);
  const issues = collectBlockingIssues(record, ownership, handoffs);
  const actions = buildActionMatrix(
    record,
    ownership,
    grantedPermissions,
    checkIn
  );

  const scheduleRows = filterOwnRows(
    handoffs.scheduleSnapshot?.rows || handoffs.scheduleSnapshot?.matches,
    ownership.ownedEntryIds || [],
    ownership.participantId
  );
  const matchRows = filterOwnRows(
    handoffs.matchSnapshot?.matches || handoffs.matchSnapshot?.rows,
    ownership.ownedEntryIds || [],
    ownership.participantId
  );

  const nextMatch =
    matchRows.find((m) =>
      ["SCHEDULED", "READY", "READY_TO_START"].includes(
        String(m.status || "").toUpperCase()
      )
    ) || null;
  const activeMatch =
    matchRows.find((m) =>
      ["IN_PROGRESS", "ACTIVE", "STARTED", "PAUSED", "SUSPENDED"].includes(
        String(m.status || "").toUpperCase()
      )
    ) || null;
  const completedMatches = matchRows.filter((m) => {
    const status = String(m.status || "").toUpperCase();
    const acceptance = String(m.acceptanceStatus || m.validationStatus || "")
      .toUpperCase();
    return (
      status === "COMPLETED" &&
      (acceptance === "ACCEPTED" ||
        acceptance === "" ||
        m.validatedResultVisible === true)
    );
  });

  // Standings / qualification / knockout — project certified snapshots only;
  // never compute winners. Unaccepted results must not appear as standings contrib.
  const standings =
    handoffs.standingsSnapshot &&
    handoffs.standingsSnapshot.acceptedOnly !== false
      ? deepFreeze({ ...handoffs.standingsSnapshot })
      : null;
  const qualification = handoffs.qualificationSnapshot
    ? deepFreeze({ ...handoffs.qualificationSnapshot })
    : null;
  const knockout = handoffs.knockoutSnapshot
    ? deepFreeze({ ...handoffs.knockoutSnapshot })
    : null;
  const finalResult =
    record.publicationState === PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED ||
    handoffs.finalResultSnapshot
      ? deepFreeze({
          published:
            record.publicationState ===
            PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
          snapshot: handoffs.finalResultSnapshot || null,
        })
      : deepFreeze({ published: false, snapshot: null });

  const projection = {
    phase: "E2E-04",
    competition: Object.freeze({
      competitionId: record.competitionId || null,
      tenantId: record.tenantId || null,
      venueId: record.venueId || null,
      name: isNonEmptyString(handoffs.competitionName)
        ? String(handoffs.competitionName)
        : record.competitionId || null,
      lifecycleState: record.lifecycleState || null,
      matchOpsState: record.matchOpsState || MATCH_OPS_STATE.CLOSED,
      publicationState: record.publicationState || PUBLICATION_OPS_STATE.NONE,
    }),
    player: Object.freeze({
      actorCanonicalPlayerId: ownership.actorCanonicalPlayerId || null,
      mappedParticipantId: ownership.mappedParticipantId || null,
      entryId: ownership.entryId || null,
      participantId: ownership.participantId || null,
      registrationState: ownership.entry?.status || ENTRY_OPS_STATUS.PENDING,
      eligibilityState: ownership.entry?.status || ENTRY_OPS_STATUS.PENDING,
      division: handoffs.division ?? null,
      category: handoffs.category ?? null,
      seed: handoffs.seed ?? null,
      poolId: handoffs.poolId ?? null,
    }),
    checkIn: Object.freeze({
      ...checkIn,
      mark: checkIn.checkedIn
        ? PLAYER_CHECKIN_MARK.CHECKED_IN
        : PLAYER_CHECKIN_MARK.NOT_CHECKED_IN,
    }),
    schedule: Object.freeze({
      certified: Boolean(record.scheduleCertified),
      fingerprint: record.scheduleFingerprint || null,
      rows: Object.freeze(scheduleRows),
      court: handoffs.courtSnapshot
        ? deepFreeze({ ...handoffs.courtSnapshot })
        : null,
    }),
    matches: Object.freeze({
      nextMatch: nextMatch ? deepFreeze({ ...nextMatch }) : null,
      activeMatch: activeMatch ? deepFreeze({ ...activeMatch }) : null,
      completedMatches: Object.freeze(
        completedMatches.map((m) => deepFreeze({ ...m }))
      ),
      rows: Object.freeze(matchRows),
    }),
    standings,
    qualification,
    knockout,
    finalResult,
    blockingIssues: Object.freeze(issues),
    allowedActions: Object.freeze(actions.allowed),
    deniedActions: Object.freeze(actions.denied),
  };

  const projectionFingerprint = computeOrganizerFingerprint(
    {
      competitionId: projection.competition.competitionId,
      participantId: projection.player.participantId,
      registrationState: projection.player.registrationState,
      checkIn: projection.checkIn,
      scheduleFingerprint: projection.schedule.fingerprint,
      matchIds: matchRows.map((m) => m.matchId || m.id || null),
      standingsReady: Boolean(standings),
      qualificationReady: Boolean(qualification),
      knockoutReady: Boolean(knockout),
      finalPublished: finalResult.published,
      allowedActions: actions.allowed.map((a) => a.action).sort(),
      deniedActions: actions.denied.map((a) => a.action).sort(),
      revision: record.revision || 0,
    },
    "e2e04-player"
  );

  return deepFreeze({
    ...projection,
    projectionFingerprint,
  });
}
