/**
 * CORE-06 Phase 1C — canonical lineup domain foundation tests.
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
  createLineupPolicyResult,
  mapLegacyLineupStatus,
  LEGACY_LINEUP_STATUS_MAP,
  LINEUP_ACTION,
  LINEUP_AUTH_ACTION,
  LINEUP_RUNTIME_ERROR_CODE,
  assertLineupTransitionAllowed,
  validateRevisionImmutability,
  createInitialRevision,
  createLineupVisibilityGrant,
  createMissingLineupResolution,
  MISSING_LINEUP_POLICY,
  createCompetitionLineupSlot,
} from "../src/features/competition-core/lineups/index.js";
import { COMPETITION_LINEUP_STATUS } from "../src/features/competition-core/participants/enums/statuses.js";
import { PARTICIPANT_REFERENCE_KIND } from "../src/features/competition-core/participants/enums/identityKinds.js";
import { createCompetitionRosterMember } from "../src/features/competition-core/participants/contracts/teamRosterLineup.js";
import { createParticipantReference } from "../src/features/competition-core/participants/contracts/identity.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LINEUPS_ROOT = path.join(ROOT, "src/features/competition-core/lineups");
const FIXED_NOW = "2026-07-20T12:00:00.000Z";

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

function createService(overrides = {}) {
  const authActions = Object.values(LINEUP_AUTH_ACTION);
  return createLineupDomainService({
    clock: createFixedLineupClockPort(FIXED_NOW),
    authorization:
      overrides.authorization ||
      createAllowlistLineupAuthorizationPort(authActions),
    rosterLookup:
      overrides.rosterLookup ||
      createFixedRosterLookupPort(rosterWith("p-1", "p-2", "p-3")),
    lineupPolicy: overrides.lineupPolicy || createNoopLineupPolicy(),
    ...overrides,
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

test("1C identity: lineup key is deterministic", () => {
  const a = buildLineupIdentityKey({
    competitionId: "comp-1",
    contextId: "mu-1",
    teamId: "team-1",
  });
  const b = buildLineupIdentityKey({
    competitionId: "comp-1",
    contextId: "mu-1",
    teamId: "team-1",
  });
  assert.equal(a, "comp-1::LINEUP::mu-1::team-1");
  assert.equal(a, b);
});

test("1C identity: slot id is deterministic", () => {
  const lineupKey = "comp-1::LINEUP::mu-1::team-1";
  const a = buildLineupSlotId({
    lineupIdentityKey: lineupKey,
    disciplineOrSideKey: "md",
    index: 0,
  });
  const b = buildLineupSlotId({
    lineupIdentityKey: lineupKey,
    disciplineOrSideKey: "md",
    index: 0,
  });
  assert.equal(a, "comp-1::LINEUP::mu-1::team-1::md::0");
  assert.equal(a, b);
});

test("1C scope: missing required fields fail closed", async () => {
  const service = createService();
  const missingTenant = await service.createLineup(
    baseCreateInput({ tenantId: "" }),
    { actorId: "captain-1" }
  );
  assert.equal(missingTenant.ok, false);
  assert.equal(missingTenant.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_SCOPE_REQUIRED);

  const missingRosterVersion = await service.createLineup(
    baseCreateInput({ rosterVersion: 0 }),
    { actorId: "captain-1" }
  );
  assert.equal(missingRosterVersion.ok, false);
  assert.equal(
    missingRosterVersion.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_SCOPE_REQUIRED
  );
});

test("1C lifecycle: valid transitions DRAFT→SUBMITTED→LOCKED→PUBLISHED", async () => {
  const service = createService();
  const created = await service.createLineup(baseCreateInput(), {
    actorId: "captain-1",
  });
  assert.equal(created.ok, true);
  assert.equal(created.value.status, COMPETITION_LINEUP_STATUS.DRAFT);

  const submitted = await service.submit(created.value, {
    actorId: "captain-1",
    expectedVersion: created.value.revision,
  });
  assert.equal(submitted.ok, true);
  assert.equal(submitted.value.status, COMPETITION_LINEUP_STATUS.SUBMITTED);

  const draftAgain = await service.saveDraft(submitted.value, {
    actorId: "captain-1",
    expectedVersion: submitted.value.revision,
  });
  assert.equal(draftAgain.ok, true);
  assert.equal(draftAgain.value.status, COMPETITION_LINEUP_STATUS.DRAFT);

  const locked = await service.lock(draftAgain.value, {
    actorId: "btc-1",
    expectedVersion: draftAgain.value.revision,
  });
  assert.equal(locked.ok, true);
  assert.equal(locked.value.status, COMPETITION_LINEUP_STATUS.LOCKED);

  const published = await service.publish(locked.value, {
    actorId: "btc-1",
    expectedVersion: locked.value.revision,
  });
  assert.equal(published.ok, true);
  assert.equal(published.value.status, COMPETITION_LINEUP_STATUS.PUBLISHED);
});

test("1C lifecycle: invalid transitions fail closed", () => {
  assert.throws(
    () =>
      assertLineupTransitionAllowed({
        action: LINEUP_ACTION.PUBLISH,
        fromStatus: COMPETITION_LINEUP_STATUS.DRAFT,
      }),
    (err) => err.code === LINEUP_RUNTIME_ERROR_CODE.LINEUP_STATE_TRANSITION_INVALID
  );
  assert.throws(
    () =>
      assertLineupTransitionAllowed({
        action: LINEUP_ACTION.SAVE_DRAFT,
        fromStatus: COMPETITION_LINEUP_STATUS.PUBLISHED,
      }),
    (err) =>
      err.code === LINEUP_RUNTIME_ERROR_CODE.LINEUP_ALREADY_PUBLISHED ||
      err.code === LINEUP_RUNTIME_ERROR_CODE.LINEUP_LOCKED
  );
  assert.throws(
    () =>
      assertLineupTransitionAllowed({
        action: LINEUP_ACTION.SUBMIT,
        fromStatus: COMPETITION_LINEUP_STATUS.VOIDED,
      }),
    (err) => err.code === LINEUP_RUNTIME_ERROR_CODE.LINEUP_LOCKED
  );
});

test("1C lifecycle: LOCKED → VOIDED allowed", async () => {
  const service = createService();
  const created = await service.createLineup(baseCreateInput(), {
    actorId: "captain-1",
  });
  const locked = await service.lock(created.value, {
    actorId: "btc-1",
    expectedVersion: created.value.revision,
  });
  const voided = await service.voidLineup(locked.value, {
    actorId: "btc-1",
    expectedVersion: locked.value.revision,
    reason: "cancelled",
  });
  assert.equal(voided.ok, true);
  assert.equal(voided.value.status, COMPETITION_LINEUP_STATUS.VOIDED);
});

test("1C invariants: roster membership enforced", async () => {
  const service = createService();
  const identityKey = buildLineupIdentityKey({
    competitionId: "comp-1",
    contextId: "mu-1",
    teamId: "team-1",
  });
  const result = await service.createLineup(
    baseCreateInput({
      slots: [
        slot("md", 0, "p-1", identityKey),
        slot("md", 1, "outsider", identityKey),
      ],
    }),
    { actorId: "captain-1" }
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_PARTICIPANT_NOT_IN_ROSTER
  );
});

test("1C invariants: duplicate player rejected unless policy permits", async () => {
  const service = createService();
  const identityKey = buildLineupIdentityKey({
    competitionId: "comp-1",
    contextId: "mu-1",
    teamId: "team-1",
  });
  const rejected = await service.createLineup(
    baseCreateInput({
      slots: [
        slot("md", 0, "p-1", identityKey),
        slot("md", 1, "p-1", identityKey),
      ],
    }),
    { actorId: "captain-1" }
  );
  assert.equal(rejected.ok, false);
  assert.equal(
    rejected.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_DUPLICATE_PARTICIPANT
  );

  const permissive = createService({
    lineupPolicy: {
      id: "ALLOW_DUP",
      allowsDuplicateParticipants() {
        return true;
      },
      validateSlots() {
        return createLineupPolicyResult({ ok: true });
      },
      assertTransition() {
        return createLineupPolicyResult({ ok: true });
      },
    },
  });
  const allowed = await permissive.createLineup(
    baseCreateInput({
      slots: [
        slot("md", 0, "p-1", identityKey),
        slot("md", 1, "p-1", identityKey),
      ],
    }),
    { actorId: "captain-1" }
  );
  assert.equal(allowed.ok, true);
});

test("1C revision: create initial and append-only history", () => {
  const identityKey = "comp-1::LINEUP::mu-1::team-1";
  const initial = createInitialRevision({
    lineupId: identityKey,
    revision: 1,
    status: COMPETITION_LINEUP_STATUS.DRAFT,
    slots: [slot("md", 0, "p-1", identityKey)],
    createdAt: FIXED_NOW,
    lineupIdentityKey: identityKey,
    actorId: "captain-1",
  });
  assert.equal(initial.revision, 1);
  assert.equal(initial.id, `${identityKey}::REV::1`);
  assert.equal(Object.isFrozen(initial), true);
});

test("1C revision: previous published/superseded revision immutable", () => {
  const identityKey = "comp-1::LINEUP::mu-1::team-1";
  const published = createInitialRevision({
    lineupId: identityKey,
    revision: 2,
    status: COMPETITION_LINEUP_STATUS.PUBLISHED,
    slots: [slot("md", 0, "p-1", identityKey)],
    createdAt: FIXED_NOW,
    publishedAt: FIXED_NOW,
    lineupIdentityKey: identityKey,
  });
  const mutated = { ...published, status: COMPETITION_LINEUP_STATUS.DRAFT };
  const issues = validateRevisionImmutability(published, mutated);
  assert.ok(issues.length > 0);
  assert.equal(issues[0].code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVISION_IMMUTABLE);
});

test("1C override: supersede prior + new LOCKED head requires republish", async () => {
  const service = createService();
  const created = await service.createLineup(baseCreateInput(), {
    actorId: "captain-1",
  });
  const locked = await service.lock(created.value, {
    actorId: "btc-1",
    expectedVersion: created.value.revision,
  });
  const published = await service.publish(locked.value, {
    actorId: "btc-1",
    expectedVersion: locked.value.revision,
  });
  assert.equal(published.value.requiresRepublish, false);

  const identityKey = published.value.identityKey;
  const overridden = await service.override(published.value, {
    actorId: "btc-1",
    expectedVersion: published.value.revision,
    reason: "injury substitution",
    slots: [
      slot("md", 0, "p-1", identityKey),
      slot("md", 1, "p-3", identityKey),
    ],
  });
  assert.equal(overridden.ok, true);
  assert.equal(overridden.value.status, COMPETITION_LINEUP_STATUS.LOCKED);
  assert.equal(overridden.value.requiresRepublish, true);
  assert.equal(overridden.details.requiresRepublish, true);

  const history = overridden.value.revisions;
  const superseded = history.filter(
    (r) => r.status === COMPETITION_LINEUP_STATUS.SUPERSEDED
  );
  assert.ok(superseded.length >= 1);
  assert.equal(
    history[history.length - 1].status,
    COMPETITION_LINEUP_STATUS.LOCKED
  );

  const republished = await service.publish(overridden.value, {
    actorId: "btc-1",
    expectedVersion: overridden.value.revision,
  });
  assert.equal(republished.ok, true);
  assert.equal(republished.value.status, COMPETITION_LINEUP_STATUS.PUBLISHED);
  assert.equal(republished.value.requiresRepublish, false);
});

test("1C status aliases: TT → CORE mapping frozen", () => {
  assert.equal(mapLegacyLineupStatus("not_submitted"), COMPETITION_LINEUP_STATUS.DRAFT);
  assert.equal(mapLegacyLineupStatus("draft"), COMPETITION_LINEUP_STATUS.DRAFT);
  assert.equal(mapLegacyLineupStatus("submitted"), COMPETITION_LINEUP_STATUS.SUBMITTED);
  assert.equal(mapLegacyLineupStatus("locked"), COMPETITION_LINEUP_STATUS.LOCKED);
  assert.equal(mapLegacyLineupStatus("published"), COMPETITION_LINEUP_STATUS.PUBLISHED);
  assert.equal(mapLegacyLineupStatus("overridden"), COMPETITION_LINEUP_STATUS.SUPERSEDED);
  assert.equal(mapLegacyLineupStatus("withdrawn"), COMPETITION_LINEUP_STATUS.VOIDED);
  assert.equal(mapLegacyLineupStatus("expired"), COMPETITION_LINEUP_STATUS.VOIDED);
  assert.equal(LEGACY_LINEUP_STATUS_MAP.not_submitted, COMPETITION_LINEUP_STATUS.DRAFT);
});

test("1C policy: injected policy can reject transitions", async () => {
  const service = createService({
    lineupPolicy: {
      id: "REJECT_SUBMIT",
      validateSlots() {
        return createLineupPolicyResult({ ok: true });
      },
      assertTransition(ctx) {
        if (ctx.action === LINEUP_ACTION.SUBMIT) {
          return createLineupPolicyResult({
            ok: false,
            code: "POLICY_BLOCK_SUBMIT",
            message: "Format policy blocked submit",
          });
        }
        return createLineupPolicyResult({ ok: true });
      },
    },
  });
  const created = await service.createLineup(baseCreateInput(), {
    actorId: "captain-1",
  });
  const submitted = await service.submit(created.value, {
    actorId: "captain-1",
    expectedVersion: created.value.revision,
  });
  assert.equal(submitted.ok, false);
  assert.equal(submitted.code, "POLICY_BLOCK_SUBMIT");
});

test("1C contracts: VisibilityGrant and MissingLineupResolution factories", () => {
  const grant = createLineupVisibilityGrant({
    actorId: "ref-1",
    competitionId: "comp-1",
    contextId: "mu-1",
    teamId: "team-1",
    visible: false,
    reason: "hidden_pre_publish",
  });
  assert.equal(grant.visible, false);
  assert.equal(Object.isFrozen(grant), true);

  const resolution = createMissingLineupResolution({
    policy: MISSING_LINEUP_POLICY.RANDOM,
    seed: "seed-1",
    reason: "deadline_lock",
  });
  assert.equal(resolution.policy, "random");
  assert.equal(resolution.seed, "seed-1");
});

test("1C determinism: CORE-06 domain modules ban Math.random and Date.now", () => {
  const files = listJsFiles(LINEUPS_ROOT);
  assert.ok(files.length > 0);
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(
      content,
      /Math\.random\s*\(/,
      `Math.random in ${path.relative(ROOT, file)}`
    );
    assert.doesNotMatch(
      content,
      /Date\.now\s*\(/,
      `Date.now in ${path.relative(ROOT, file)}`
    );
  }
});

test("1C safety: no Production callers of createLineupDomainService", () => {
  const callerRoots = [
    path.join(ROOT, "src/pages"),
    path.join(ROOT, "src/components"),
    path.join(ROOT, "src/features/team-tournament"),
  ];
  for (const dir of callerRoots) {
    if (!existsSync(dir)) continue;
    for (const file of listJsFiles(dir)) {
      const content = readFileSync(file, "utf8");
      assert.doesNotMatch(
        content,
        /createLineupDomainService/,
        `Production caller: ${path.relative(ROOT, file)}`
      );
      assert.doesNotMatch(content, /competition-core\/lineups/);
    }
  }
});

test("1C safety: createLineupDomainService requires injected clock", () => {
  assert.throws(
    () => createLineupDomainService({}),
    (err) => err.code === LINEUP_RUNTIME_ERROR_CODE.LINEUP_CLOCK_REQUIRED
  );
});
