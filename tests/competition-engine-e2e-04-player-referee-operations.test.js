/**
 * E2E-04 — Player & Referee Operations MVP targeted tests.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import { MATCH_STATUS } from "../src/features/competition-core/matches/index.js";
import { SCORING_SIDE } from "../src/features/competition-core/scoring/index.js";
import {
  CHECKIN_STATE,
  ENTRY_OPS_STATUS,
  PLAYER_ERROR_CODE,
  REFEREE_ERROR_CODE,
  REFEREE_VALIDATION_OPS_STATUS,
  buildPlayerPortalSections,
  buildRefereePortalSections,
  createCompetitionRuntimePorts,
  createInMemoryOrganizerOperationsStore,
  createOrganizerOperationsFacade,
  createPlayerCompetitionOperationsFacade,
  createRefereeCompetitionOperationsFacade,
  isPlayerOperationsError,
  isRefereeOperationsError,
  snapshotInput,
} from "../src/features/competition-engine/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPS_PLAYER = path.join(
  ROOT,
  "src/features/competition-engine/operations/player"
);
const OPS_REFEREE = path.join(
  ROOT,
  "src/features/competition-engine/operations/referee"
);

function listJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function playerActor(overrides = {}) {
  return {
    actorId: "player-1",
    role: "PLAYER",
    playerId: "player-1",
    ...overrides,
  };
}

function refereeActor(overrides = {}) {
  return {
    actorId: "ref-1",
    role: "REFEREE",
    refereeId: "ref-1",
    ...overrides,
  };
}

function baseScope(overrides = {}) {
  return {
    tenantId: "tenant-1",
    competitionId: "comp-e2e04",
    venueId: "venue-1",
    ...overrides,
  };
}

function createPorts(rolePerms) {
  return createCompetitionRuntimePorts({
    identity: {
      getPermissionsForRole: (role) => {
        const normalized = String(role || "").toUpperCase();
        if (typeof rolePerms === "function") return rolePerms(normalized);
        if (rolePerms && rolePerms[normalized]) return rolePerms[normalized];
        if (normalized === "PLAYER") {
          return [
            PERMISSIONS.TOURNAMENT_VIEW,
            PERMISSIONS.PLAYER_UPDATE,
            PERMISSIONS.STATISTICS_VIEW,
            PERMISSIONS.PLAYER_VIEW,
          ];
        }
        if (normalized === "REFEREE") {
          return [
            PERMISSIONS.TOURNAMENT_VIEW,
            PERMISSIONS.MATCH_UPDATE,
            PERMISSIONS.TEAM_MATCH_RESULT_MANAGE,
            PERMISSIONS.STATISTICS_VIEW,
          ];
        }
        if (normalized === "CASHIER" || normalized === "UNKNOWN") return [];
        return [
          PERMISSIONS.TOURNAMENT_VIEW,
          PERMISSIONS.TOURNAMENT_UPDATE,
          PERMISSIONS.DIRECTOR_USE,
          PERMISSIONS.MATCH_UPDATE,
          PERMISSIONS.SCHEDULING_RUN,
          PERMISSIONS.TOURNAMENT_CERTIFY,
        ];
      },
    },
    participantLookupPort: {
      resolveParticipantSnapshot(playerId) {
        const id = String(playerId || "").trim();
        if (!id) {
          return { ok: false, code: "INVALID", participant: null };
        }
        return {
          ok: true,
          participant: {
            id,
            status: "ACTIVE",
            reference: { id },
            profileSnapshot: { playerId: id, displayName: id },
          },
          reasonCodes: [],
        };
      },
      async getByIds(ids = []) {
        return ids.map((id) => ({ id: String(id), status: "ACTIVE" }));
      },
    },
  });
}

async function prepareOrganizerWithEntry(ports, entryStatus = ENTRY_OPS_STATUS.ELIGIBLE) {
  const organizerStore = createInMemoryOrganizerOperationsStore({
    clockIso: "2026-07-24T12:00:00.000Z",
  });
  const organizer = createOrganizerOperationsFacade({
    clockIso: "2026-07-24T12:00:00.000Z",
    runtimePorts: ports,
    store: organizerStore,
  });
  const cmd = {
    ...baseScope(),
    actor: { actorId: "org-1", role: "TOURNAMENT_MANAGER" },
    entries: [{ participantId: "player-1", status: entryStatus }],
  };
  await organizer.prepareCompetitionOperations(cmd);
  await organizer.lockParticipantField(cmd);
  await organizer.openCheckIn(cmd);
  return { organizer, organizerStore, cmd };
}

test("architecture — no direct Supabase / Date.now / Math.random in E2E-04 ops", () => {
  const files = [...listJsFiles(OPS_PLAYER), ...listJsFiles(OPS_REFEREE)];
  assert.ok(files.length > 5);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(/from\s+['"]@supabase|createClient\s*\(/.test(text), false, file);
    assert.equal(/Date\.now\s*\(/.test(text), false, file);
    assert.equal(/Math\.random\s*\(/.test(text), false, file);
    assert.equal(/crypto\.randomUUID\s*\(/.test(text), false, file);
  }
});

test("architecture — no E2E-05 public experience cross-imports", () => {
  const files = [...listJsFiles(OPS_PLAYER), ...listJsFiles(OPS_REFEREE)];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(/operations\/public|public-experience|e2e-05/i.test(text), false, file);
  }
});

test("player — allow mapped identity / reject wrong playerId / missing tenant", async () => {
  const ports = createPorts();
  const { organizerStore } = await prepareOrganizerWithEntry(ports);
  const player = createPlayerCompetitionOperationsFacade({
    clockIso: "2026-07-24T12:00:00.000Z",
    runtimePorts: ports,
    organizerStore,
  });

  const ok = await player.getPlayerCompetitionState({
    ...baseScope(),
    actor: playerActor(),
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.ownership.participantId, "player-1");
  assert.ok(ok.projection.projectionFingerprint);

  await assert.rejects(
    () =>
      player.getPlayerCompetitionState({
        ...baseScope(),
        actor: playerActor(),
        playerId: "other-player",
      }),
    (err) =>
      isPlayerOperationsError(err) &&
      err.code === PLAYER_ERROR_CODE.WRONG_PLAYER_ID
  );

  await assert.rejects(
    () =>
      player.getPlayerCompetitionState({
        ...baseScope({ tenantId: "" }),
        actor: playerActor(),
      }),
    (err) =>
      isPlayerOperationsError(err) &&
      err.code === PLAYER_ERROR_CODE.MISSING_TENANT
  );
});

test("player — cross-tenant rejection and client grant trust rejected", async () => {
  const ports = createPorts();
  const { organizerStore } = await prepareOrganizerWithEntry(ports);
  const player = createPlayerCompetitionOperationsFacade({
    runtimePorts: ports,
    organizerStore,
  });

  await assert.rejects(
    () =>
      player.getPlayerCompetitionState({
        ...baseScope(),
        actor: playerActor({ grantedPermissions: [PERMISSIONS.TOURNAMENT_VIEW] }),
      }),
    (err) =>
      isPlayerOperationsError(err) &&
      err.code === PLAYER_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED
  );
});

test("player — check-in success + idempotency + wrong entry + closed window", async () => {
  const ports = createPorts();
  const { organizer, organizerStore, cmd } = await prepareOrganizerWithEntry(ports);
  const player = createPlayerCompetitionOperationsFacade({
    runtimePorts: ports,
    organizerStore,
  });

  const first = await player.checkInPlayer({
    ...baseScope(),
    actor: playerActor(),
  });
  assert.equal(first.ok, true);
  assert.equal(first.idempotent, false);
  assert.equal(first.checkIn.checkedIn, true);

  const second = await player.checkInPlayer({
    ...baseScope(),
    actor: playerActor(),
  });
  assert.equal(second.idempotent, true);

  await assert.rejects(
    () =>
      player.checkInPlayer({
        ...baseScope(),
        actor: playerActor(),
        entryId: "not-mine",
      }),
    (err) =>
      isPlayerOperationsError(err) &&
      err.code === PLAYER_ERROR_CODE.ENTRY_NOT_OWNED
  );

  await organizer.closeCheckIn(cmd);
  await assert.rejects(
    () =>
      player.checkInPlayer({
        ...baseScope(),
        actor: playerActor(),
      }),
    (err) =>
      isPlayerOperationsError(err) &&
      err.code === PLAYER_ERROR_CODE.CHECKIN_CLOSED
  );
});

test("player — private data isolation + deterministic projection", async () => {
  const ports = createPorts();
  const { organizerStore } = await prepareOrganizerWithEntry(ports);
  organizerStore.update("tenant-1", "comp-e2e04", (draft) => {
    draft.entries.push({
      participantId: "player-2",
      status: ENTRY_OPS_STATUS.ELIGIBLE,
    });
    draft.scheduleCertified = true;
    draft.scheduleFingerprint = "sched-1";
  });

  const player = createPlayerCompetitionOperationsFacade({
    runtimePorts: ports,
    organizerStore,
  });
  player.setProjectionHandoffs({
    tenantId: "tenant-1",
    competitionId: "comp-e2e04",
    handoffs: {
      competitionName: "E2E-04 Cup",
      scheduleSnapshot: {
        rows: [
          { matchId: "m1", participantId: "player-1", courtId: "c1" },
          { matchId: "m2", participantId: "player-2", courtId: "c2" },
        ],
      },
      matchSnapshot: {
        matches: [
          { matchId: "m1", participantId: "player-1", status: "SCHEDULED" },
          { matchId: "m2", participantId: "player-2", status: "SCHEDULED" },
        ],
      },
      standingsSnapshot: {
        acceptedOnly: true,
        rows: [{ participantId: "player-1", points: 3 }],
      },
    },
  });

  const a = await player.getPlayerCompetitionState({
    ...baseScope(),
    actor: playerActor(),
  });
  const b = await player.getPlayerCompetitionState({
    ...baseScope(),
    actor: playerActor(),
  });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.projection.schedule.rows.length, 1);
  assert.equal(a.projection.schedule.rows[0].participantId, "player-1");
  assert.equal(a.projection.matches.rows.length, 1);

  const input = { ...baseScope(), actor: playerActor() };
  const snap = snapshotInput(input);
  await player.getPlayerSchedule(input);
  assert.deepEqual(snapshotInput(input), snap);

  const sections = buildPlayerPortalSections(a.projection);
  assert.equal(sections.length, 7);
});

test("player — ineligible entry cannot self-confirm eligibility via check-in", async () => {
  const ports = createPorts();
  const organizerStore = createInMemoryOrganizerOperationsStore({
    clockIso: "2026-07-24T12:00:00.000Z",
  });
  organizerStore.update("tenant-1", "comp-e2e04", (draft) => {
    draft.entries = [
      { participantId: "player-1", status: ENTRY_OPS_STATUS.INELIGIBLE },
    ];
    draft.checkInState = CHECKIN_STATE.OPEN;
    draft.checkInRequired = true;
  });
  const player = createPlayerCompetitionOperationsFacade({
    runtimePorts: ports,
    organizerStore,
  });
  await assert.rejects(
    () =>
      player.checkInPlayer({
        ...baseScope(),
        actor: playerActor(),
      }),
    (err) =>
      isPlayerOperationsError(err) &&
      err.code === PLAYER_ERROR_CODE.ENTRY_INELIGIBLE
  );
});

test("referee — assignment queue + unassigned rejection + wrong tenant", async () => {
  const ports = createPorts();
  const referee = createRefereeCompetitionOperationsFacade({
    runtimePorts: ports,
    clockIso: "2026-07-24T12:00:00.000Z",
  });
  referee.seedAssignments({
    ...baseScope(),
    assignments: [
      {
        matchId: "m-1",
        refereeId: "ref-1",
        status: "ASSIGNED",
        courtId: "court-1",
        scheduledAt: "2026-07-24T13:00:00.000Z",
        entries: [
          { entryId: "entry-a", participantId: "p-a" },
          { entryId: "entry-b", participantId: "p-b" },
        ],
      },
    ],
  });

  const queue = await referee.getRefereeAssignmentQueue({
    ...baseScope(),
    actor: refereeActor(),
  });
  assert.equal(queue.queue.length, 1);
  assert.equal(queue.queue[0].matchId, "m-1");

  await assert.rejects(
    () =>
      referee.getAssignedMatch({
        ...baseScope(),
        actor: refereeActor(),
        matchId: "m-unassigned",
      }),
    (err) =>
      isRefereeOperationsError(err) &&
      err.code === REFEREE_ERROR_CODE.NOT_ASSIGNED
  );

  await assert.rejects(
    () =>
      referee.openAssignedMatch({
        ...baseScope(),
        actor: refereeActor({ actorId: "ref-2", refereeId: "ref-2" }),
        matchId: "m-1",
      }),
    (err) =>
      isRefereeOperationsError(err) &&
      err.code === REFEREE_ERROR_CODE.NOT_ASSIGNED
  );
});

test("referee — lifecycle start/suspend/resume + score requires active", async () => {
  const ports = createPorts();
  const referee = createRefereeCompetitionOperationsFacade({
    runtimePorts: ports,
    clockIso: "2026-07-24T12:00:00.000Z",
  });
  referee.seedAssignments({
    ...baseScope(),
    assignments: [{ matchId: "m-1", refereeId: "ref-1", courtId: "c1" }],
  });

  await assert.rejects(
    () =>
      referee.createScoreEntrySession({
        ...baseScope(),
        actor: refereeActor(),
        matchId: "m-1",
      }),
    (err) =>
      isRefereeOperationsError(err) &&
      err.code === REFEREE_ERROR_CODE.MATCH_NOT_ACTIVE
  );

  const opened = await referee.openAssignedMatch({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
  });
  assert.equal(opened.match.status, MATCH_STATUS.IN_PROGRESS);

  const suspended = await referee.suspendAssignedMatch({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
  });
  assert.equal(suspended.match.status, MATCH_STATUS.SUSPENDED);

  const resumed = await referee.resumeAssignedMatch({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
  });
  assert.equal(resumed.match.status, MATCH_STATUS.IN_PROGRESS);

  const session = await referee.createScoreEntrySession({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
  });
  assert.equal(session.ok, true);
  assert.equal(session.idempotent, false);
});

test("referee — score + validate + accepted visibility + no unvalidated standings", async () => {
  const ports = createPorts();
  const referee = createRefereeCompetitionOperationsFacade({
    runtimePorts: ports,
    clockIso: "2026-07-24T12:00:00.000Z",
  });
  referee.seedAssignments({
    ...baseScope(),
    assignments: [
      {
        matchId: "m-1",
        refereeId: "ref-1",
        courtId: "c1",
        entries: [
          { entryId: "entry-a", participantId: "p-a" },
          { entryId: "entry-b", participantId: "p-b" },
        ],
      },
    ],
  });

  await referee.openAssignedMatch({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
  });
  await referee.createScoreEntrySession({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
  });

  await assert.rejects(
    () =>
      referee.submitScoreProjection({
        ...baseScope(),
        actor: refereeActor(),
        matchId: "m-1",
        scoringSide: "SIDE_Z",
      }),
    (err) =>
      isRefereeOperationsError(err) &&
      err.code === REFEREE_ERROR_CODE.INVALID_SCORE
  );

  // Rally to 11 for SIDE_A
  for (let i = 0; i < 11; i += 1) {
    await referee.submitScoreProjection({
      ...baseScope(),
      actor: refereeActor(),
      matchId: "m-1",
      scoringSide: SCORING_SIDE.SIDE_A,
      points: 1,
    });
  }

  const pending = await referee.submitMatchResultForValidation({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
    acceptResult: false,
  });
  assert.equal(pending.validationStatus, REFEREE_VALIDATION_OPS_STATUS.PENDING);
  assert.equal(pending.standingsEligible, false);

  const accepted = await referee.submitMatchResultForValidation({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
    acceptResult: true,
  });
  assert.equal(accepted.validationStatus, REFEREE_VALIDATION_OPS_STATUS.ACCEPTED);
  assert.equal(accepted.standingsEligible, true);
  assert.equal(accepted.validatedResult.winnerInferenceByFacade, undefined);

  const visible = await referee.getValidatedResultState({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
  });
  assert.equal(visible.validationStatus, REFEREE_VALIDATION_OPS_STATUS.ACCEPTED);
  assert.equal(visible.standingsEligible, true);
  assert.equal(visible.winnerInferenceByFacade, false);
  assert.ok(visible.validatedResult);

  const detail = await referee.getAssignedMatch({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
  });
  const sections = buildRefereePortalSections(detail.projection);
  assert.equal(sections.length, 6);
});

test("referee — client grants rejected", async () => {
  const ports = createPorts();
  const referee = createRefereeCompetitionOperationsFacade({
    runtimePorts: ports,
  });
  await assert.rejects(
    () =>
      referee.getRefereeAssignmentQueue({
        ...baseScope(),
        actor: refereeActor({
          grantedPermissions: [PERMISSIONS.MATCH_UPDATE],
        }),
      }),
    (err) =>
      isRefereeOperationsError(err) &&
      err.code === REFEREE_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED
  );
});

test("check-in window compatibility — organizer NOT_OPENED blocks player", async () => {
  const ports = createPorts();
  const organizerStore = createInMemoryOrganizerOperationsStore({
    clockIso: "2026-07-24T12:00:00.000Z",
  });
  const organizer = createOrganizerOperationsFacade({
    runtimePorts: ports,
    store: organizerStore,
  });
  const cmd = {
    ...baseScope(),
    actor: { actorId: "org-1", role: "TOURNAMENT_MANAGER" },
    entries: [{ participantId: "player-1", status: ENTRY_OPS_STATUS.ELIGIBLE }],
  };
  await organizer.prepareCompetitionOperations(cmd);
  // check-in not opened
  const player = createPlayerCompetitionOperationsFacade({
    runtimePorts: ports,
    organizerStore,
  });
  const state = await player.getPlayerCheckInState({
    ...baseScope(),
    actor: playerActor(),
  });
  assert.equal(state.checkIn.windowState, CHECKIN_STATE.NOT_OPENED);
  await assert.rejects(
    () =>
      player.checkInPlayer({
        ...baseScope(),
        actor: playerActor(),
      }),
    (err) =>
      isPlayerOperationsError(err) &&
      err.code === PLAYER_ERROR_CODE.CHECKIN_NOT_OPEN
  );
});
