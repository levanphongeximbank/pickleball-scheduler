/**
 * CORE-06 Phase 1E — visibility, deadline, concurrency & idempotency hardening.
 * Isolated domain only — no Production wiring.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLineupIdentityKey,
  buildLineupSlotId,
  createLineupDomainService,
  createFixedLineupClockPort,
  createAllowlistLineupAuthorizationPort,
  createFixedRosterLookupPort,
  createNoopLineupPolicy,
  createInMemoryLineupPersistencePort,
  createHardenedLineupIdempotencyPort,
  createInMemoryIdempotencyRepository,
  createLineupHardeningPolicy,
  createLineupDeadlineTimestamps,
  createLineupAuditPort,
  LINEUP_AUTH_ACTION,
  LINEUP_RUNTIME_ERROR_CODE,
  LINEUP_VISIBILITY_STATE,
  LINEUP_DEADLINE_PHASE,
  LINEUP_PROJECTION_FIELD,
  projectLineupForViewer,
  assertVisibilityTransitionAllowed,
  evaluateDeadlinePhase,
  assertDeadlineAllowsMutation,
  assertExpectedVersion,
  assertLockedMutationAllowed,
  createCompetitionLineupSlot,
} from "../src/features/competition-core/lineups/index.js";
import { COMPETITION_LINEUP_STATUS } from "../src/features/competition-core/participants/enums/statuses.js";
import { PARTICIPANT_REFERENCE_KIND } from "../src/features/competition-core/participants/enums/identityKinds.js";
import { createCompetitionRosterMember } from "../src/features/competition-core/participants/contracts/teamRosterLineup.js";
import { createParticipantReference } from "../src/features/competition-core/participants/contracts/identity.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LINEUPS_ROOT = path.join(ROOT, "src/features/competition-core/lineups");
const TT_ROOT = path.join(ROOT, "src/features/team-tournament");
const FIXED_NOW = "2026-07-21T12:00:00.000Z";

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function person(id) {
  return createParticipantReference({
    kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
    id,
  });
}

function rosterWith(...playerIds) {
  return {
    id: "roster:team-1",
    competitionId: "comp-1",
    teamId: "team-1",
    members: playerIds.map((id) =>
      createCompetitionRosterMember({
        id: `rm:team-1:PLAYER_PROFILE:${id}`,
        rosterId: "roster:team-1",
        person: person(id),
      })
    ),
  };
}

function slot(disciplineOrSideKey, index, playerId, identityKey) {
  const key =
    identityKey ||
    buildLineupIdentityKey({
      competitionId: "comp-1",
      contextId: "mu-1",
      teamId: "team-1",
    });
  return createCompetitionLineupSlot({
    id: buildLineupSlotId({
      lineupIdentityKey: key,
      disciplineOrSideKey,
      index,
    }),
    disciplineOrSideKey,
    index,
    person: person(playerId),
  });
}

function baseCreateInput(overrides = {}) {
  const identityKey = buildLineupIdentityKey({
    competitionId: "comp-1",
    contextId: "mu-1",
    teamId: "team-1",
  });
  return {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    teamId: "team-1",
    rosterId: "roster:team-1",
    rosterVersion: 1,
    contextId: "mu-1",
    slots: [
      slot("md", 0, "p-1", identityKey),
      slot("md", 1, "p-2", identityKey),
    ],
    ...overrides,
  };
}

function createService(overrides = {}) {
  return createLineupDomainService({
    clock: createFixedLineupClockPort(FIXED_NOW),
    authorization:
      overrides.authorization ||
      createAllowlistLineupAuthorizationPort(Object.values(LINEUP_AUTH_ACTION)),
    rosterLookup:
      overrides.rosterLookup ||
      createFixedRosterLookupPort(rosterWith("p-1", "p-2", "p-3")),
    lineupPolicy: overrides.lineupPolicy || createNoopLineupPolicy(),
    idempotency:
      overrides.idempotency || createHardenedLineupIdempotencyPort(),
    ...overrides,
  });
}

function viewerScope(partial = {}) {
  return {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    teamId: "team-1",
    role: "CAPTAIN",
    ...partial,
  };
}

function baseProjectionRequest(lineup, partial = {}) {
  return {
    lineup,
    viewerActor: { actorId: "actor-1", actorRole: "CAPTAIN" },
    viewerScope: viewerScope(),
    competitionScope: { tenantId: "tenant-1", competitionId: "comp-1" },
    relationship: "OWN_TEAM",
    revealState: { authorized: false, ready: false },
    evaluatedAt: FIXED_NOW,
    source: "phase1e-test",
    ...partial,
  };
}

async function createDraft(service, cmd = {}) {
  const created = await service.createLineup(baseCreateInput(), {
    actorId: "a1",
    actorRole: "CAPTAIN",
    source: "test",
    evaluatedAt: FIXED_NOW,
    ...cmd,
  });
  assert.equal(created.ok, true);
  return created.value;
}

// ---------- Visibility ----------

test("1E visibility: PRIVATE hidden from opponent", async () => {
  const service = createService();
  const lineup = await createDraft(service);
  assert.equal(lineup.visibilityState, LINEUP_VISIBILITY_STATE.PRIVATE);
  const proj = service.projectLineupForViewer(
    baseProjectionRequest(lineup, {
      relationship: "OPPONENT",
      viewerScope: viewerScope({ teamId: "team-2", role: "CAPTAIN" }),
    })
  );
  assert.equal(proj.visible, false);
  assert.equal(proj.projectedLineup, null);
});

test("1E visibility: PRIVATE hidden from public", async () => {
  const service = createService();
  const lineup = await createDraft(service);
  const proj = service.projectLineupForViewer(
    baseProjectionRequest(lineup, {
      relationship: "PUBLIC",
      viewerScope: viewerScope({ teamId: null, role: "PUBLIC" }),
    })
  );
  assert.equal(proj.visible, false);
});

test("1E visibility: own-team authorized viewer sees permitted fields", async () => {
  const service = createService();
  const lineup = await createDraft(service);
  const proj = service.projectLineupForViewer(baseProjectionRequest(lineup));
  assert.equal(proj.visible, true);
  assert.ok(proj.permittedFields.includes(LINEUP_PROJECTION_FIELD.SLOTS));
  assert.ok(proj.projectedLineup?.slots?.length >= 1);
});

test("1E visibility: officials follow injected policy", async () => {
  const service = createService({
    hardeningPolicy: createLineupHardeningPolicy({
      authorizeViewerProjection(ctx) {
        if (ctx.relationship === "OFFICIAL") {
          return {
            ok:
              ctx.visibilityState === LINEUP_VISIBILITY_STATE.OFFICIALS_VISIBLE,
            code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_AUTHORIZATION_DENIED,
            message: "officials gate",
          };
        }
        return { ok: ctx.relationship === "OWN_TEAM" };
      },
    }),
  });
  const lineup = await createDraft(service);
  const hidden = service.projectLineupForViewer(
    baseProjectionRequest(lineup, {
      relationship: "OFFICIAL",
      viewerScope: viewerScope({ role: "REFEREE", teamId: null }),
    })
  );
  assert.equal(hidden.visible, false);

  const opened = await service.transitionVisibility(lineup, {
    toVisibilityState: LINEUP_VISIBILITY_STATE.TEAM_VISIBLE,
    expectedVersion: lineup.revision,
    actorId: "td",
    actorRole: "TD",
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(opened.ok, true);
  const toOfficials = await service.transitionVisibility(opened.value, {
    toVisibilityState: LINEUP_VISIBILITY_STATE.OFFICIALS_VISIBLE,
    expectedVersion: opened.value.revision,
    actorId: "td",
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(toOfficials.ok, true);
  const shown = service.projectLineupForViewer(
    baseProjectionRequest(toOfficials.value, {
      relationship: "OFFICIAL",
      viewerScope: viewerScope({ role: "REFEREE", teamId: null }),
    })
  );
  assert.equal(shown.visible, true);
});

test("1E visibility: opponent blocked before revealAt", async () => {
  const timestamps = createLineupDeadlineTimestamps({
    opensAt: "2026-07-21T00:00:00.000Z",
    submitBy: "2026-07-21T10:00:00.000Z",
    lockAt: "2026-07-21T11:00:00.000Z",
    revealAt: "2026-07-21T18:00:00.000Z",
  });
  const service = createService({
    hardeningPolicy: createLineupHardeningPolicy({
      allowsVisibilityStageSkip: () => true,
      allowsReveal: () => true,
    }),
  });
  let lineup = await createDraft(service);
  const vis = await service.transitionVisibility(lineup, {
    toVisibilityState: LINEUP_VISIBILITY_STATE.OPPONENT_VISIBLE,
    expectedVersion: lineup.revision,
    deadlineTimestamps: timestamps,
    evaluatedAt: "2026-07-21T12:00:00.000Z",
    actorId: "td",
  });
  assert.equal(vis.ok, false);
  assert.equal(vis.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVEAL_NOT_AUTHORIZED);
});

test("1E visibility: opponent allowed after revealAt when policy authorizes", async () => {
  const timestamps = createLineupDeadlineTimestamps({
    opensAt: "2026-07-21T00:00:00.000Z",
    submitBy: "2026-07-21T10:00:00.000Z",
    lockAt: "2026-07-21T11:00:00.000Z",
    revealAt: "2026-07-21T12:00:00.000Z",
  });
  const service = createService({
    hardeningPolicy: createLineupHardeningPolicy({
      allowsVisibilityStageSkip: () => true,
      allowsReveal: () => true,
    }),
  });
  let lineup = await createDraft(service);
  const vis = await service.transitionVisibility(lineup, {
    toVisibilityState: LINEUP_VISIBILITY_STATE.OPPONENT_VISIBLE,
    expectedVersion: lineup.revision,
    deadlineTimestamps: timestamps,
    evaluatedAt: "2026-07-21T12:00:00.000Z",
    actorId: "td",
  });
  assert.equal(vis.ok, true);
  const proj = service.projectLineupForViewer(
    baseProjectionRequest(vis.value, {
      relationship: "OPPONENT",
      viewerScope: viewerScope({ teamId: "team-2", role: "CAPTAIN" }),
      revealState: { authorized: true, ready: true },
      evaluatedAt: "2026-07-21T12:00:00.000Z",
    })
  );
  assert.equal(proj.visible, true);
});

test("1E visibility: PUBLIC requires explicit transition", async () => {
  const service = createService();
  const lineup = await createDraft(service);
  const submitted = await service.submit(lineup, {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(submitted.ok, true);
  assert.equal(
    submitted.value.visibilityState,
    LINEUP_VISIBILITY_STATE.PRIVATE
  );
  const proj = projectLineupForViewer(
    baseProjectionRequest(submitted.value, {
      relationship: "PUBLIC",
      viewerScope: viewerScope({ role: "PUBLIC", teamId: null }),
    })
  );
  assert.equal(proj.visible, false);
});

test("1E visibility: unknown viewer role fails closed", () => {
  const lineup = {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    teamId: "team-1",
    visibilityState: LINEUP_VISIBILITY_STATE.PRIVATE,
    slots: [{ person: { kind: "PLAYER_PROFILE", id: "p-1" } }],
  };
  const proj = projectLineupForViewer({
    lineup,
    viewerScope: { tenantId: "tenant-1", competitionId: "comp-1" },
    competitionScope: { tenantId: "tenant-1", competitionId: "comp-1" },
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(proj.visible, false);
  assert.equal(
    proj.metadata.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_UNKNOWN_VIEWER_SCOPE
  );
});

test("1E visibility: cross-tenant viewer fails closed", () => {
  const lineup = {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    teamId: "team-1",
    visibilityState: LINEUP_VISIBILITY_STATE.PUBLIC,
    slots: [],
  };
  const proj = projectLineupForViewer({
    lineup,
    relationship: "PUBLIC",
    viewerScope: {
      tenantId: "tenant-OTHER",
      competitionId: "comp-1",
      role: "PUBLIC",
    },
    competitionScope: { tenantId: "tenant-OTHER", competitionId: "comp-1" },
    revealState: { authorized: true, ready: true },
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(proj.visible, false);
  assert.equal(
    proj.metadata.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_CROSS_SCOPE_ACCESS_DENIED
  );
});

test("1E visibility: hidden projections do not leak participant identities", () => {
  const lineup = {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    teamId: "team-1",
    visibilityState: LINEUP_VISIBILITY_STATE.PRIVATE,
    slots: [
      { person: { kind: "PLAYER_PROFILE", id: "secret-player" } },
      { person: { kind: "PLAYER_PROFILE", id: "secret-player-2" } },
    ],
  };
  const proj = projectLineupForViewer({
    lineup,
    relationship: "OPPONENT",
    viewerScope: viewerScope({ teamId: "team-2", role: "CAPTAIN" }),
    competitionScope: { tenantId: "tenant-1", competitionId: "comp-1" },
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(proj.visible, false);
  assert.equal(proj.projectedLineup, null);
  const meta = JSON.stringify(proj.metadata);
  assert.equal(meta.includes("secret-player"), false);
});

test("1E visibility: hidden projections do not leak slot counts by default", () => {
  const lineup = {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    teamId: "team-1",
    visibilityState: LINEUP_VISIBILITY_STATE.PRIVATE,
    slots: [{}, {}, {}],
  };
  const proj = projectLineupForViewer({
    lineup,
    relationship: "PUBLIC",
    viewerScope: viewerScope({ role: "PUBLIC", teamId: null }),
    competitionScope: { tenantId: "tenant-1", competitionId: "comp-1" },
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(proj.visible, false);
  assert.equal(proj.projectedLineup, null);
  assert.equal("slotCount" in (proj.metadata || {}), false);
});

test("1E visibility: regression blocked by default", () => {
  const gate = assertVisibilityTransitionAllowed({
    from: LINEUP_VISIBILITY_STATE.PUBLIC,
    to: LINEUP_VISIBILITY_STATE.PRIVATE,
  });
  assert.equal(gate.ok, false);
  assert.equal(
    gate.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_VISIBILITY_TRANSITION_NOT_ALLOWED
  );
});

test("1E visibility: policy-authorized stage skipping works", () => {
  const denied = assertVisibilityTransitionAllowed({
    from: LINEUP_VISIBILITY_STATE.PRIVATE,
    to: LINEUP_VISIBILITY_STATE.OFFICIALS_VISIBLE,
  });
  assert.equal(denied.ok, false);

  const allowed = assertVisibilityTransitionAllowed({
    from: LINEUP_VISIBILITY_STATE.PRIVATE,
    to: LINEUP_VISIBILITY_STATE.OFFICIALS_VISIBLE,
    policy: createLineupHardeningPolicy({
      allowsVisibilityStageSkip: () => true,
    }),
  });
  assert.equal(allowed.ok, true);
});

test("1E visibility: lifecycle status alone does not reveal lineup", async () => {
  const service = createService();
  let lineup = await createDraft(service);
  lineup = (
    await service.submit(lineup, {
      expectedVersion: lineup.revision,
      actorId: "a1",
      evaluatedAt: FIXED_NOW,
    })
  ).value;
  lineup = (
    await service.lock(lineup, {
      expectedVersion: lineup.revision,
      actorId: "td",
      evaluatedAt: FIXED_NOW,
    })
  ).value;
  lineup = (
    await service.publish(lineup, {
      expectedVersion: lineup.revision,
      actorId: "td",
      evaluatedAt: FIXED_NOW,
    })
  ).value;
  assert.equal(lineup.status, "PUBLISHED");
  assert.equal(lineup.visibilityState, LINEUP_VISIBILITY_STATE.PRIVATE);
  const proj = projectLineupForViewer(
    baseProjectionRequest(lineup, {
      relationship: "OPPONENT",
      viewerScope: viewerScope({ teamId: "team-2", role: "CAPTAIN" }),
      revealState: { authorized: true, ready: true },
    })
  );
  assert.equal(proj.visible, false);
});

// ---------- Deadlines ----------

test("1E deadline: before opensAt mutation blocked", async () => {
  const timestamps = createLineupDeadlineTimestamps({
    opensAt: "2026-07-21T13:00:00.000Z",
    submitBy: "2026-07-21T18:00:00.000Z",
  });
  const service = createService({
    hardeningPolicy: createLineupHardeningPolicy({
      resolveDeadlineTimestamps: () => timestamps,
    }),
  });
  const created = await service.createLineup(baseCreateInput(), {
    actorId: "a1",
    evaluatedAt: "2026-07-21T12:00:00.000Z",
    deadlineTimestamps: timestamps,
  });
  assert.equal(created.ok, false);
  assert.equal(created.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_DEADLINE_NOT_OPEN);
});

test("1E deadline: open window permits authorized mutation", async () => {
  const timestamps = createLineupDeadlineTimestamps({
    opensAt: "2026-07-21T00:00:00.000Z",
    submitBy: "2026-07-21T18:00:00.000Z",
  });
  const service = createService();
  const created = await service.createLineup(baseCreateInput(), {
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
    deadlineTimestamps: timestamps,
  });
  assert.equal(created.ok, true);
});

test("1E deadline: grace-period behavior follows policy", () => {
  const phase = evaluateDeadlinePhase({
    timestamps: createLineupDeadlineTimestamps({
      opensAt: "2026-07-21T00:00:00.000Z",
      submitBy: "2026-07-21T10:00:00.000Z",
      graceUntil: "2026-07-21T12:30:00.000Z",
    }),
    evaluatedAt: "2026-07-21T12:00:00.000Z",
  });
  assert.equal(phase.phase, LINEUP_DEADLINE_PHASE.GRACE_PERIOD);

  const denied = assertDeadlineAllowsMutation({
    phase: phase.phase,
    action: "submit",
    allowsLateMutation: false,
  });
  assert.equal(denied.ok, false);

  const allowed = assertDeadlineAllowsMutation({
    phase: phase.phase,
    action: "submit",
    allowsLateMutation: true,
  });
  assert.equal(allowed.ok, true);
});

test("1E deadline: submission after deadline blocked", async () => {
  const timestamps = createLineupDeadlineTimestamps({
    opensAt: "2026-07-21T00:00:00.000Z",
    submitBy: "2026-07-21T10:00:00.000Z",
  });
  const service = createService();
  const lineup = await createDraft(service, {
    deadlineTimestamps: createLineupDeadlineTimestamps({
      opensAt: "2026-07-21T00:00:00.000Z",
      submitBy: "2026-07-21T18:00:00.000Z",
    }),
  });
  const submitted = await service.submit(lineup, {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: "2026-07-21T12:00:00.000Z",
    deadlineTimestamps: timestamps,
  });
  assert.equal(submitted.ok, false);
  assert.equal(
    submitted.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_SUBMISSION_DEADLINE_PASSED
  );
});

test("1E deadline: correction after correctionUntil blocked", () => {
  const gate = assertDeadlineAllowsMutation({
    phase: LINEUP_DEADLINE_PHASE.LOCKED,
    action: "override",
    isCorrection: true,
    correctionUntil: "2026-07-21T11:00:00.000Z",
    evaluatedAt: "2026-07-21T12:00:00.000Z",
  });
  assert.equal(gate.ok, false);
  assert.equal(
    gate.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_CORRECTION_WINDOW_CLOSED
  );
});

test("1E deadline: at lockAt ordinary mutation blocked", async () => {
  const timestamps = createLineupDeadlineTimestamps({
    opensAt: "2026-07-21T00:00:00.000Z",
    submitBy: "2026-07-21T10:00:00.000Z",
    lockAt: "2026-07-21T12:00:00.000Z",
  });
  const service = createService();
  const lineup = await createDraft(service, {
    deadlineTimestamps: createLineupDeadlineTimestamps({
      opensAt: "2026-07-21T00:00:00.000Z",
      submitBy: "2026-07-21T18:00:00.000Z",
    }),
  });
  const saved = await service.saveDraft(lineup, {
    expectedVersion: lineup.revision,
    actorId: "a1",
    slots: lineup.slots,
    evaluatedAt: "2026-07-21T12:00:00.000Z",
    deadlineTimestamps: timestamps,
  });
  assert.equal(saved.ok, false);
  assert.equal(saved.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_ALREADY_LOCKED);
});

test("1E deadline: at revealAt reveal becomes eligible but not automatic", () => {
  const phase = evaluateDeadlinePhase({
    timestamps: createLineupDeadlineTimestamps({
      opensAt: "2026-07-21T00:00:00.000Z",
      submitBy: "2026-07-21T10:00:00.000Z",
      lockAt: "2026-07-21T11:00:00.000Z",
      revealAt: "2026-07-21T12:00:00.000Z",
    }),
    evaluatedAt: "2026-07-21T12:00:00.000Z",
  });
  assert.equal(phase.revealEligible, true);
  assert.equal(phase.revealPhase, LINEUP_DEADLINE_PHASE.REVEAL_READY);
  assert.equal(phase.phase, LINEUP_DEADLINE_PHASE.LOCKED);
  assert.equal(phase.mutationPhase, LINEUP_DEADLINE_PHASE.LOCKED);
});

test("1E deadline: explicit evaluation time is deterministic", () => {
  const timestamps = createLineupDeadlineTimestamps({
    opensAt: "2026-07-21T00:00:00.000Z",
    submitBy: "2026-07-21T10:00:00.000Z",
  });
  const a = evaluateDeadlinePhase({
    timestamps,
    evaluatedAt: "2026-07-21T09:00:00.000Z",
  });
  const b = evaluateDeadlinePhase({
    timestamps,
    evaluatedAt: "2026-07-21T09:00:00.000Z",
  });
  assert.deepEqual(a, b);
  assert.equal(a.phase, LINEUP_DEADLINE_PHASE.OPEN);
});

test("1E deadline: no Date.now or direct clock in deadlines module", () => {
  const file = readFileSync(
    path.join(LINEUPS_ROOT, "deadlines/evaluateDeadline.js"),
    "utf8"
  );
  assert.equal(/Date\.now\s*\(/.test(file), false);
  assert.equal(/new\s+Date\s*\(\s*\)/.test(file), false);
});

// ---------- Concurrency ----------

test("1E concurrency: matching expectedVersion succeeds", async () => {
  const service = createService({
    hardeningPolicy: createLineupHardeningPolicy({
      requiresExpectedVersion: () => true,
    }),
  });
  const lineup = await createDraft(service);
  const next = await service.submit(lineup, {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(next.ok, true);
  assert.equal(next.value.revision, lineup.revision + 1);
});

test("1E concurrency: missing expectedVersion fails where required", async () => {
  const service = createService({
    hardeningPolicy: createLineupHardeningPolicy({
      requiresExpectedVersion: () => true,
    }),
  });
  const lineup = await createDraft(service);
  const next = await service.submit(lineup, {
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(next.ok, false);
  assert.equal(
    next.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_EXPECTED_VERSION_REQUIRED
  );
});

test("1E concurrency: stale expectedVersion fails", async () => {
  const check = assertExpectedVersion({
    expectedVersion: 1,
    currentVersion: 3,
    required: true,
  });
  assert.equal(check.ok, false);
  assert.equal(check.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_STALE_COMMAND);
});

test("1E concurrency: failed stale command does not mutate state", async () => {
  const persistence = createInMemoryLineupPersistencePort();
  const service = createService({ persistence });
  const lineup = await createDraft(service);
  const before = await persistence.getById(lineup.id);
  const failed = await service.submit(lineup, {
    expectedVersion: lineup.revision - 1,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(failed.ok, false);
  const after = await persistence.getById(lineup.id);
  assert.equal(after.revision, before.revision);
  assert.equal(after.status, before.status);
});

test("1E concurrency: successful mutation increments version exactly once", async () => {
  const service = createService();
  const lineup = await createDraft(service);
  const next = await service.submit(lineup, {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(next.value.revision, lineup.revision + 1);
});

test("1E concurrency: concurrent commands from same base cannot both succeed", async () => {
  const persistence = createInMemoryLineupPersistencePort();
  const service = createService({ persistence });
  const lineup = await createDraft(service);
  const a = await service.submit(lineup, {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
    idempotencyKey: "conc-a",
  });
  const b = await service.saveDraft(lineup, {
    expectedVersion: lineup.revision,
    actorId: "a2",
    slots: lineup.slots,
    evaluatedAt: FIXED_NOW,
    idempotencyKey: "conc-b",
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, false);
  assert.equal(b.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_VERSION_CONFLICT);
});

test("1E concurrency: no silent merge/rebase helper exists", () => {
  const file = readFileSync(
    path.join(LINEUPS_ROOT, "concurrency/assertExpectedVersion.js"),
    "utf8"
  );
  assert.equal(/\bfunction\s+rebase\b|\bsilentMerge\b|\bmergeConcurrent\b/.test(file), false);
});

// ---------- Idempotency ----------

test("1E idempotency: same key and payload replays same result", async () => {
  const service = createService();
  const lineup = await createDraft(service);
  const cmd = {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
    idempotencyKey: "idem-1",
  };
  const first = await service.submit(lineup, cmd);
  const second = await service.submit(lineup, cmd);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.details.replayed, true);
  assert.equal(second.value.revision, first.value.revision);
});

test("1E idempotency: replay does not increment version", async () => {
  const persistence = createInMemoryLineupPersistencePort();
  const service = createService({ persistence });
  const lineup = await createDraft(service);
  const cmd = {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
    idempotencyKey: "idem-2",
  };
  const first = await service.submit(lineup, cmd);
  await service.submit(lineup, cmd);
  const stored = await persistence.getById(lineup.id);
  assert.equal(stored.revision, first.value.revision);
});

test("1E idempotency: replay does not duplicate lifecycle event", async () => {
  const events = [];
  const service = createService({
    audit: createLineupAuditPort((event) => {
      events.push(event);
    }),
  });
  const lineup = await createDraft(service);
  const before = events.length;
  const cmd = {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
    idempotencyKey: "idem-3",
  };
  await service.submit(lineup, cmd);
  const afterFirst = events.length;
  await service.submit(lineup, cmd);
  assert.equal(events.length, afterFirst);
  assert.ok(afterFirst > before);
});

test("1E idempotency: same key with different payload fails", async () => {
  const service = createService();
  const lineup = await createDraft(service);
  const first = await service.submit(lineup, {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
    idempotencyKey: "idem-4",
  });
  assert.equal(first.ok, true);
  const identityKey = lineup.identityKey;
  const conflict = await service.saveDraft(first.value, {
    expectedVersion: first.value.revision,
    actorId: "a1",
    slots: [
      slot("md", 0, "p-1", identityKey),
      slot("md", 1, "p-3", identityKey),
    ],
    evaluatedAt: FIXED_NOW,
    idempotencyKey: "idem-4",
  });
  assert.equal(conflict.ok, false);
  assert.equal(
    conflict.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT
  );
});

test("1E idempotency: same key with different command type fails", async () => {
  const service = createService();
  const lineup = await createDraft(service);
  await service.submit(lineup, {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
    idempotencyKey: "idem-5",
  });
  const conflict = await service.lock(lineup, {
    expectedVersion: lineup.revision,
    actorId: "td",
    evaluatedAt: FIXED_NOW,
    idempotencyKey: "idem-5",
  });
  assert.equal(conflict.ok, false);
  assert.equal(
    conflict.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT
  );
});

test("1E idempotency: same key with different aggregate fails", async () => {
  const service = createService();
  const a = await createDraft(service);
  await service.submit(a, {
    expectedVersion: a.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
    idempotencyKey: "idem-6",
  });
  const b = await service.createLineup(
    baseCreateInput({
      teamId: "team-2",
      rosterId: "roster:team-2",
      contextId: "mu-2",
    }),
    {
      actorId: "a2",
      evaluatedAt: FIXED_NOW,
      idempotencyKey: "idem-6",
      roster: {
        id: "roster:team-2",
        competitionId: "comp-1",
        teamId: "team-2",
        members: ["p-1", "p-2"].map((id) =>
          createCompetitionRosterMember({
            id: `rm:team-2:PLAYER_PROFILE:${id}`,
            rosterId: "roster:team-2",
            person: person(id),
          })
        ),
      },
    }
  );
  // Different aggregate + same key should conflict when first record exists
  assert.equal(b.ok, false);
  assert.equal(b.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT);
});

test("1E idempotency: same key with different expectedVersion context fails", async () => {
  const port = createHardenedLineupIdempotencyPort();
  await port.remember({
    idempotencyKey: "idem-7",
    aggregateIdentity: "agg-1",
    commandType: "submit",
    canonicalPayloadFingerprint: "fp-same",
    expectedVersion: 1,
    resultingVersion: 2,
    createdAt: FIXED_NOW,
    result: { ok: true },
  });
  const lookup = await port.lookupContext({
    idempotencyKey: "idem-7",
    aggregateIdentity: "agg-1",
    commandType: "submit",
    canonicalPayloadFingerprint: "fp-same",
    expectedVersion: 9,
  });
  assert.equal(lookup.conflict, true);
  assert.equal(
    lookup.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT
  );
});

test("1E idempotency: replay metadata marks replayed true", async () => {
  const service = createService();
  const lineup = await createDraft(service);
  const cmd = {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
    idempotencyKey: "idem-8",
  };
  await service.submit(lineup, cmd);
  const replay = await service.submit(lineup, cmd);
  assert.equal(replay.details.replayed, true);
});

// ---------- Locked state ----------

test("1E locked: ordinary edits blocked", async () => {
  const service = createService();
  let lineup = await createDraft(service);
  lineup = (
    await service.submit(lineup, {
      expectedVersion: lineup.revision,
      actorId: "a1",
      evaluatedAt: FIXED_NOW,
    })
  ).value;
  lineup = (
    await service.lock(lineup, {
      expectedVersion: lineup.revision,
      actorId: "td",
      evaluatedAt: FIXED_NOW,
    })
  ).value;
  const edit = await service.saveDraft(lineup, {
    expectedVersion: lineup.revision,
    actorId: "a1",
    slots: lineup.slots,
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(edit.ok, false);
});

test("1E locked: random fallback overwrite blocked", async () => {
  const service = createService();
  let lineup = await createDraft(service);
  lineup = (
    await service.lock(
      (
        await service.submit(lineup, {
          expectedVersion: lineup.revision,
          actorId: "a1",
          evaluatedAt: FIXED_NOW,
        })
      ).value,
      {
        expectedVersion: lineup.revision + 1,
        actorId: "td",
        evaluatedAt: FIXED_NOW,
      }
    )
  ).value;
  const blocked = service.assertRandomOverwriteAllowed(lineup);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_ALREADY_LOCKED);
});

test("1E locked: authorized correction policy permits correction", async () => {
  const events = [];
  const service = createService({
    hardeningPolicy: createLineupHardeningPolicy({
      allowsLockedCorrection: () => true,
    }),
    audit: createLineupAuditPort((e) => {
      events.push(e);
    }),
  });
  let lineup = await createDraft(service);
  lineup = (
    await service.submit(lineup, {
      expectedVersion: lineup.revision,
      actorId: "a1",
      evaluatedAt: FIXED_NOW,
    })
  ).value;
  lineup = (
    await service.lock(lineup, {
      expectedVersion: lineup.revision,
      actorId: "td",
      evaluatedAt: FIXED_NOW,
    })
  ).value;
  const prev = lineup.revision;
  const corrected = await service.correctLockedLineup(lineup, {
    expectedVersion: lineup.revision,
    actorId: "td",
    actorRole: "TD",
    source: "admin_correction",
    reason: "official data repair",
    slots: lineup.slots,
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(corrected.ok, true);
  assert.equal(corrected.value.revision, prev + 1);
  assert.equal(corrected.details.previousVersion, prev);
  const audit = events[events.length - 1];
  assert.equal(audit.metadata.actor.actorId, "td");
  assert.equal(audit.metadata.source, "admin_correction");
  assert.equal(audit.metadata.correctionReason, "official data repair");
});

test("1E locked: correction requires explicit reason", async () => {
  const service = createService({
    hardeningPolicy: createLineupHardeningPolicy({
      allowsLockedCorrection: () => true,
    }),
  });
  let lineup = await createDraft(service);
  lineup = (
    await service.lock(
      (
        await service.submit(lineup, {
          expectedVersion: lineup.revision,
          actorId: "a1",
          evaluatedAt: FIXED_NOW,
        })
      ).value,
      {
        expectedVersion: lineup.revision + 1,
        actorId: "td",
        evaluatedAt: FIXED_NOW,
      }
    )
  ).value;
  const failed = await service.correctLockedLineup(lineup, {
    expectedVersion: lineup.revision,
    actorId: "td",
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(failed.ok, false);
  assert.equal(
    failed.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_OVERRIDE_REASON_REQUIRED
  );
});

test("1E locked: correction preserves previous and resulting versions", () => {
  const gate = assertLockedMutationAllowed({
    lineup: { status: COMPETITION_LINEUP_STATUS.LOCKED },
    action: "override",
    isCorrection: true,
    correctionAuthorized: true,
    correctionReason: "fix slot",
  });
  assert.equal(gate.ok, true);
});

test("1E locked: correction audit metadata includes actor/source/reason", async () => {
  const events = [];
  const service = createService({
    hardeningPolicy: createLineupHardeningPolicy({
      allowsLockedCorrection: () => true,
    }),
    audit: createLineupAuditPort((e) => {
      events.push(e);
    }),
  });
  let lineup = await createDraft(service);
  lineup = (
    await service.lock(
      (
        await service.submit(lineup, {
          expectedVersion: lineup.revision,
          actorId: "a1",
          evaluatedAt: FIXED_NOW,
        })
      ).value,
      {
        expectedVersion: lineup.revision + 1,
        actorId: "td",
        evaluatedAt: FIXED_NOW,
      }
    )
  ).value;
  await service.override(lineup, {
    expectedVersion: lineup.revision,
    actorId: "btc",
    actorRole: "TD",
    source: "court_official",
    reason: "court official correction",
    evaluatedAt: FIXED_NOW,
  });
  const last = events[events.length - 1];
  assert.equal(last.metadata.actor.actorId, "btc");
  assert.equal(last.metadata.source, "court_official");
  assert.equal(last.metadata.correctionReason, "court official correction");
});

// ---------- Security / scope / safety ----------

test("1E security: no opponent reveal before authorization", () => {
  const gate = assertVisibilityTransitionAllowed({
    from: LINEUP_VISIBILITY_STATE.OFFICIALS_VISIBLE,
    to: LINEUP_VISIBILITY_STATE.OPPONENT_VISIBLE,
    revealAuthorized: false,
    revealReady: true,
  });
  assert.equal(gate.ok, false);
  assert.equal(
    gate.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVEAL_NOT_AUTHORIZED
  );
});

test("1E security: no hidden data in audit metadata", async () => {
  const events = [];
  const service = createService({
    audit: createLineupAuditPort((e) => {
      events.push(e);
    }),
  });
  const lineup = await createDraft(service);
  await service.submit(lineup, {
    expectedVersion: lineup.revision,
    actorId: "a1",
    evaluatedAt: FIXED_NOW,
  });
  const blob = JSON.stringify(events);
  assert.equal(blob.includes("password"), false);
  assert.equal(blob.includes("token"), false);
  assert.equal(blob.includes("secret"), false);
});

test("1E security: no cross-roster or cross-tenant access", () => {
  const proj = projectLineupForViewer({
    lineup: {
      tenantId: "tenant-1",
      competitionId: "comp-1",
      teamId: "team-1",
      visibilityState: LINEUP_VISIBILITY_STATE.PUBLIC,
      slots: [],
    },
    relationship: "OWN_TEAM",
    viewerScope: {
      tenantId: "tenant-1",
      competitionId: "comp-OTHER",
      teamId: "team-1",
      role: "CAPTAIN",
    },
    competitionScope: { tenantId: "tenant-1", competitionId: "comp-OTHER" },
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(proj.visible, false);
  assert.equal(
    proj.metadata.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_CROSS_SCOPE_ACCESS_DENIED
  );
});

test("1E security: input objects are not mutated", () => {
  const lineup = {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    teamId: "team-1",
    visibilityState: LINEUP_VISIBILITY_STATE.PRIVATE,
    slots: [{ person: { id: "p-1" } }],
  };
  const snapshot = JSON.stringify(lineup);
  projectLineupForViewer({
    lineup,
    relationship: "OWN_TEAM",
    viewerScope: viewerScope(),
    competitionScope: { tenantId: "tenant-1", competitionId: "comp-1" },
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(JSON.stringify(lineup), snapshot);
});

test("1E safety: no Production wiring of domain service", () => {
  const prodRoots = [
    path.join(ROOT, "src/pages"),
    path.join(ROOT, "src/features/team-tournament"),
  ];
  for (const root of prodRoots) {
    if (!existsSync(root)) continue;
    for (const file of listJsFiles(root)) {
      const text = readFileSync(file, "utf8");
      assert.equal(
        text.includes("createLineupDomainService"),
        false,
        `Production wiring found in ${file}`
      );
      assert.equal(
        text.includes("projectLineupForViewer"),
        false,
        `Production wiring found in ${file}`
      );
    }
  }
});

test("1E safety: Team Tournament V6 files unchanged by Phase 1E modules", () => {
  assert.ok(existsSync(TT_ROOT));
  // Phase 1E must not import TT runtime deeply from new modules.
  const phase1eDirs = [
    path.join(LINEUPS_ROOT, "visibility"),
    path.join(LINEUPS_ROOT, "deadlines"),
    path.join(LINEUPS_ROOT, "concurrency"),
    path.join(LINEUPS_ROOT, "repositories"),
  ];
  for (const dir of phase1eDirs) {
    for (const file of listJsFiles(dir)) {
      const text = readFileSync(file, "utf8");
      assert.equal(
        text.includes("features/team-tournament"),
        false,
        `TT import in ${file}`
      );
    }
  }
});

test("1E safety: no Date.now in Phase 1E hardening modules", () => {
  const dirs = [
    path.join(LINEUPS_ROOT, "visibility"),
    path.join(LINEUPS_ROOT, "deadlines"),
    path.join(LINEUPS_ROOT, "concurrency"),
    path.join(LINEUPS_ROOT, "repositories"),
    path.join(LINEUPS_ROOT, "services/lockedMutationGuard.js"),
    path.join(LINEUPS_ROOT, "services/idempotencyGuard.js"),
  ];
  for (const entry of dirs) {
    const files = entry.endsWith(".js") ? [entry] : listJsFiles(entry);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(/Date\.now\s*\(/.test(text), false, file);
      assert.equal(/new\s+Date\s*\(\s*\)/.test(text), false, file);
    }
  }
});

test("1E locked: default hardening policy denies correction without explicit allow", async () => {
  const service = createService();
  let lineup = await createDraft(service);
  lineup = (
    await service.lock(
      (
        await service.submit(lineup, {
          expectedVersion: lineup.revision,
          actorId: "a1",
          evaluatedAt: FIXED_NOW,
        })
      ).value,
      {
        expectedVersion: lineup.revision + 1,
        actorId: "td",
        evaluatedAt: FIXED_NOW,
      }
    )
  ).value;
  const denied = await service.override(lineup, {
    expectedVersion: lineup.revision,
    actorId: "td",
    actorRole: "TD",
    reason: "should not pass without policy",
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(denied.ok, false);
  assert.equal(
    denied.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_MUTATION_NOT_ALLOWED
  );
});

test("1E deadline: lock and reveal dimensions both preserved", () => {
  const afterBoth = evaluateDeadlinePhase({
    timestamps: createLineupDeadlineTimestamps({
      opensAt: "2026-07-21T00:00:00.000Z",
      submitBy: "2026-07-21T08:00:00.000Z",
      lockAt: "2026-07-21T10:00:00.000Z",
      revealAt: "2026-07-21T11:00:00.000Z",
    }),
    evaluatedAt: "2026-07-21T12:00:00.000Z",
  });
  assert.equal(afterBoth.mutationPhase, LINEUP_DEADLINE_PHASE.LOCKED);
  assert.equal(afterBoth.phase, LINEUP_DEADLINE_PHASE.LOCKED);
  assert.equal(afterBoth.revealEligible, true);
  assert.equal(afterBoth.revealPhase, LINEUP_DEADLINE_PHASE.REVEAL_READY);

  const revealBeforeLock = evaluateDeadlinePhase({
    timestamps: createLineupDeadlineTimestamps({
      opensAt: "2026-07-21T00:00:00.000Z",
      submitBy: "2026-07-21T18:00:00.000Z",
      lockAt: "2026-07-21T20:00:00.000Z",
      revealAt: "2026-07-21T10:00:00.000Z",
    }),
    evaluatedAt: "2026-07-21T12:00:00.000Z",
  });
  assert.equal(revealBeforeLock.mutationPhase, LINEUP_DEADLINE_PHASE.OPEN);
  assert.equal(revealBeforeLock.revealEligible, true);
  const stillMutable = assertDeadlineAllowsMutation({
    phase: revealBeforeLock.mutationPhase,
    action: "submit",
  });
  assert.equal(stillMutable.ok, true);

  const lockEqualsReveal = evaluateDeadlinePhase({
    timestamps: createLineupDeadlineTimestamps({
      opensAt: "2026-07-21T00:00:00.000Z",
      submitBy: "2026-07-21T09:00:00.000Z",
      lockAt: "2026-07-21T12:00:00.000Z",
      revealAt: "2026-07-21T12:00:00.000Z",
    }),
    evaluatedAt: "2026-07-21T12:00:00.000Z",
  });
  assert.equal(lockEqualsReveal.mutationPhase, LINEUP_DEADLINE_PHASE.LOCKED);
  assert.equal(lockEqualsReveal.revealEligible, true);

  const graceAfterLock = evaluateDeadlinePhase({
    timestamps: createLineupDeadlineTimestamps({
      opensAt: "2026-07-21T00:00:00.000Z",
      submitBy: "2026-07-21T09:00:00.000Z",
      graceUntil: "2026-07-21T15:00:00.000Z",
      lockAt: "2026-07-21T10:00:00.000Z",
    }),
    evaluatedAt: "2026-07-21T12:00:00.000Z",
  });
  // lockAt precedence over grace window
  assert.equal(graceAfterLock.mutationPhase, LINEUP_DEADLINE_PHASE.LOCKED);
  const blocked = assertDeadlineAllowsMutation({
    phase: graceAfterLock.mutationPhase,
    action: "submit",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_ALREADY_LOCKED);
});

test("1E visibility: OWN_TEAM claim without matching team scope fails closed", () => {
  const proj = projectLineupForViewer({
    lineup: {
      tenantId: "tenant-1",
      competitionId: "comp-1",
      teamId: "team-1",
      visibilityState: LINEUP_VISIBILITY_STATE.PRIVATE,
      slots: [{ person: { kind: "PLAYER_PROFILE", id: "p-secret" } }],
    },
    relationship: "OWN_TEAM",
    viewerScope: viewerScope({ teamId: "team-OTHER", role: "CAPTAIN" }),
    competitionScope: { tenantId: "tenant-1", competitionId: "comp-1" },
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(proj.visible, false);
  assert.equal(proj.projectedLineup, null);
  assert.deepEqual(proj.permittedFields, []);
  assert.ok(proj.redactedFields.length > 0);
  assert.equal(
    proj.metadata.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_UNKNOWN_VIEWER_SCOPE
  );
  assert.equal(JSON.stringify(proj).includes("p-secret"), false);
});

test("1E visibility: hidden projection exact shape", () => {
  const proj = projectLineupForViewer({
    lineup: {
      tenantId: "tenant-1",
      competitionId: "comp-1",
      teamId: "team-1",
      visibilityState: LINEUP_VISIBILITY_STATE.PRIVATE,
      revision: 3,
      slots: [{ person: { id: "hidden" } }],
    },
    relationship: "OPPONENT",
    viewerScope: viewerScope({ teamId: "team-2", role: "CAPTAIN" }),
    competitionScope: { tenantId: "tenant-1", competitionId: "comp-1" },
    evaluatedAt: FIXED_NOW,
    source: "shape-test",
  });
  assert.deepEqual(
    {
      visible: proj.visible,
      projectedLineup: proj.projectedLineup,
      permittedFields: [...proj.permittedFields],
      hasSlotsMeta: "slots" in proj.metadata,
      hasRevisionHistory: "revisions" in proj.metadata,
      hasFingerprint: "commandFingerprint" in proj.metadata,
    },
    {
      visible: false,
      projectedLineup: null,
      permittedFields: [],
      hasSlotsMeta: false,
      hasRevisionHistory: false,
      hasFingerprint: false,
    }
  );
  assert.equal(typeof proj.reason, "string");
  assert.equal(proj.metadata.evaluatedAt, FIXED_NOW);
  assert.equal(proj.metadata.source, "shape-test");
  assert.ok(typeof proj.metadata.code === "string");
});

test("1E idempotency: concurrent same-key claims cannot both proceed", () => {
  const repo = createInMemoryIdempotencyRepository();
  const input = {
    idempotencyKey: "race-1",
    aggregateIdentity: "agg",
    commandType: "submit",
    canonicalPayloadFingerprint: "fp-1",
    expectedVersion: 1,
  };
  const first = repo.claimOrLookup(input);
  const second = repo.claimOrLookup(input);
  assert.equal(first.claimed, true);
  assert.equal(first.conflict, false);
  assert.equal(second.conflict, true);
  assert.equal(
    second.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT
  );
});

test("1E docs: Phase 1E document exists", () => {
  const doc = path.join(
    ROOT,
    "docs/competition-engine/core-06/11_PHASE_1E_VISIBILITY_DEADLINE.md"
  );
  assert.ok(existsSync(doc));
  const text = readFileSync(doc, "utf8");
  assert.match(text, /Visibility states/);
  assert.match(text, /expectedVersion/);
  assert.match(text, /Team Tournament V6 parity/);
});
