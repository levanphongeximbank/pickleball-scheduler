/**
 * Core-02 — Participant & Competition Entry foundation tests.
 * Imports participants-local barrel only (no mega-barrel requirement).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMPETITION_ENTRY_TYPE,
  COMPETITION_ENTRY_TYPE_VALUES,
  isCompetitionEntryType,
  COMPETITION_ENTRY_STATUS,
  COMPETITION_REGISTRATION_STATUS,
  ACTIVE_ENTRY_STATUSES,
  TERMINAL_ENTRY_STATUSES,
  isActiveCompetitionEntryStatus,
  isTerminalCompetitionEntryStatus,
  PARTICIPANT_REFERENCE_KIND,
  PARTICIPANT_ERROR_CODE,
  createParticipantReference,
  createCompetitionEntry,
  createCompetitionTeamReference,
  createEntryTenantScope,
  buildEntryIdentityKey,
  createEntryIdentity,
  validateEntryIdentity,
  canonicalizeMemberReferenceTokens,
  validateCompetitionEntry,
  validateCompetitionEntryTypeStructure,
  detectDuplicateActiveEntryIdentities,
  createInMemoryActiveEntryIdentityRegistry,
  inferCompetitionEntryType,
  mapLegacyIndividualEntryToCompetitionEntry,
  mapTeamTournamentTeamToOptionalEntry,
  mapDailyPlayPlayerWithoutEntry,
  assertDailyPlayMapsWithoutEntries,
  mapPlayerProfileToParticipantReference,
  mapClubScopeToEntryTenantScope,
} from "../src/features/competition-core/participants/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PARTICIPANTS_DIR = path.join(ROOT, "src/features/competition-core/participants");
const CONSTRAINTS_DIR = path.join(ROOT, "src/features/competition-core/constraints");
const DIVISION_CATEGORY_FILE = path.join(
  PARTICIPANTS_DIR,
  "contracts/divisionCategory.js"
);

function walkJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function ref(id, kind = PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE) {
  return createParticipantReference({ kind, id });
}

// ---------------------------------------------------------------------------
// 1. Entry type enum
// ---------------------------------------------------------------------------
test("COMPETITION_ENTRY_TYPE exposes INDIVIDUAL, PAIR, TEAM only", () => {
  assert.deepEqual([...COMPETITION_ENTRY_TYPE_VALUES].sort(), [
    "INDIVIDUAL",
    "PAIR",
    "TEAM",
  ].sort());
  assert.equal(isCompetitionEntryType("PAIR"), true);
  assert.equal(isCompetitionEntryType("GUEST"), false);
  assert.equal(
    Object.values(PARTICIPANT_REFERENCE_KIND).includes("PAIR"),
    false,
    "PAIR must not be a ParticipantReference kind"
  );
});

// ---------------------------------------------------------------------------
// 2–3. Cardinality
// ---------------------------------------------------------------------------
test("INDIVIDUAL requires exactly one member", () => {
  const ok = createCompetitionEntry({
    id: "e1",
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.INDIVIDUAL,
    memberRefs: [ref("p1")],
    status: COMPETITION_ENTRY_STATUS.ACTIVE,
  });
  assert.equal(validateCompetitionEntry(ok, { requireEntryType: true }).valid, true);

  const bad = createCompetitionEntry({
    id: "e2",
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.INDIVIDUAL,
    memberRefs: [ref("p1"), ref("p2")],
  });
  const result = validateCompetitionEntryTypeStructure(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === PARTICIPANT_ERROR_CODE.ENTRY_TYPE_MEMBERSHIP));
});

test("PAIR requires exactly two distinct members", () => {
  const ok = createCompetitionEntry({
    id: "e1",
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.PAIR,
    memberRefs: [ref("p2"), ref("p1")],
    status: COMPETITION_ENTRY_STATUS.APPROVED,
  });
  assert.equal(validateCompetitionEntry(ok, { requireEntryType: true }).valid, true);

  const same = createCompetitionEntry({
    id: "e2",
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.PAIR,
    memberRefs: [ref("p1"), ref("p1")],
  });
  assert.equal(validateCompetitionEntryTypeStructure(same).valid, false);

  const one = createCompetitionEntry({
    id: "e3",
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.PAIR,
    memberRefs: [ref("p1")],
  });
  assert.equal(validateCompetitionEntryTypeStructure(one).valid, false);
});

// ---------------------------------------------------------------------------
// 4. Canonical pair ordering
// ---------------------------------------------------------------------------
test("PAIR member tokens are canonicalized for identity", () => {
  const a = [ref("p2"), ref("p1")];
  const b = [ref("p1"), ref("p2")];
  assert.deepEqual(canonicalizeMemberReferenceTokens(a), canonicalizeMemberReferenceTokens(b));

  const keyA = buildEntryIdentityKey({
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.PAIR,
    memberRefs: a,
  });
  const keyB = buildEntryIdentityKey({
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.PAIR,
    memberRefs: b,
  });
  assert.equal(keyA, keyB);
  assert.match(keyA, /^c1::ENTRY::PAIR::/);
});

// ---------------------------------------------------------------------------
// 5. Team reference
// ---------------------------------------------------------------------------
test("TEAM requires valid teamRef and rejects INDIVIDUAL/PAIR structure conflict", () => {
  const ok = createCompetitionEntry({
    id: "e1",
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.TEAM,
    memberRefs: [],
    teamRef: createCompetitionTeamReference({ id: "team-1", competitionId: "c1" }),
  });
  assert.equal(validateCompetitionEntry(ok, { requireEntryType: true }).valid, true);

  const missing = createCompetitionEntry({
    id: "e2",
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.TEAM,
    memberRefs: [ref("p1"), ref("p2")],
    teamRef: null,
  });
  const result = validateCompetitionEntryTypeStructure(missing);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === PARTICIPANT_ERROR_CODE.INVALID_TEAM_REF));

  const withTeamOnPair = createCompetitionEntry({
    id: "e3",
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.PAIR,
    memberRefs: [ref("p1"), ref("p2")],
    teamRef: createCompetitionTeamReference({ id: "team-x" }),
  });
  assert.equal(validateCompetitionEntryTypeStructure(withTeamOnPair).valid, false);
});

// ---------------------------------------------------------------------------
// 6. Ambiguous legacy failure
// ---------------------------------------------------------------------------
test("ambiguous legacy entry fails closed (no silent INDIVIDUAL default)", () => {
  const none = mapLegacyIndividualEntryToCompetitionEntry({
    id: "e-empty",
    tournamentId: "t1",
    playerIds: [],
    status: "approved",
  });
  assert.equal(none.success, false);
  assert.ok(
    none.validation.errors.some((e) => e.code === PARTICIPANT_ERROR_CODE.ENTRY_TYPE_AMBIGUOUS)
  );

  const three = mapLegacyIndividualEntryToCompetitionEntry({
    id: "e-three",
    tournamentId: "t1",
    playerIds: ["a", "b", "c"],
    status: "approved",
  });
  assert.equal(three.success, false);

  const bare = createCompetitionEntry({
    id: "legacy-bare",
    competitionId: "c1",
    memberRefs: [ref("p1")],
  });
  assert.equal(bare.entryType, null, "constructor must not silently default entryType");
});

// ---------------------------------------------------------------------------
// 7–8. Deterministic identity + cross-competition
// ---------------------------------------------------------------------------
test("entry identity keys are deterministic and competition-scoped", () => {
  const identity = createEntryIdentity({
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.INDIVIDUAL,
    memberRefs: [ref("p1")],
  });
  assert.equal(validateEntryIdentity(identity).valid, true);
  assert.equal(
    identity.key,
    buildEntryIdentityKey({
      competitionId: "c1",
      entryType: COMPETITION_ENTRY_TYPE.INDIVIDUAL,
      memberRefs: [ref("p1")],
    })
  );

  const otherComp = buildEntryIdentityKey({
    competitionId: "c2",
    entryType: COMPETITION_ENTRY_TYPE.INDIVIDUAL,
    memberRefs: [ref("p1")],
  });
  assert.notEqual(identity.key, otherComp);

  const otherType = buildEntryIdentityKey({
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.PAIR,
    memberRefs: [ref("p1"), ref("p2")],
  });
  assert.notEqual(identity.key, otherType);
});

// ---------------------------------------------------------------------------
// 9. Tenant conflict
// ---------------------------------------------------------------------------
test("cross-tenant references fail closed; missing scope does not default", () => {
  const entry = createCompetitionEntry({
    id: "e1",
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.INDIVIDUAL,
    memberRefs: [ref("p1")],
    tenantScope: createEntryTenantScope({ tenantId: "tenant-a", clubId: "club-1" }),
  });
  const conflict = validateCompetitionEntry(entry, {
    requireEntryType: true,
    expectedTenantScope: { tenantId: "tenant-b" },
  });
  assert.equal(conflict.valid, false);
  assert.ok(
    conflict.errors.some((e) => e.code === PARTICIPANT_ERROR_CODE.TENANT_SCOPE_CONFLICT)
  );

  const missing = validateCompetitionEntry(
    createCompetitionEntry({
      id: "e2",
      competitionId: "c1",
      entryType: COMPETITION_ENTRY_TYPE.INDIVIDUAL,
      memberRefs: [ref("p1")],
      tenantScope: null,
    }),
    { requireEntryType: true, requireTenantScope: true }
  );
  assert.equal(missing.valid, false);
  assert.ok(
    missing.errors.some((e) => e.code === PARTICIPANT_ERROR_CODE.TENANT_SCOPE_MISSING)
  );

  const clubMap = mapClubScopeToEntryTenantScope({});
  assert.equal(clubMap.success, false);
});

// ---------------------------------------------------------------------------
// 10–11. Duplicate active + terminal lifecycle
// ---------------------------------------------------------------------------
test("duplicate active identity detection ignores terminal statuses", () => {
  const base = {
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.INDIVIDUAL,
    memberRefs: [ref("p1")],
  };
  const a = createCompetitionEntry({
    ...base,
    id: "e1",
    status: COMPETITION_ENTRY_STATUS.ACTIVE,
  });
  const b = createCompetitionEntry({
    ...base,
    id: "e2",
    status: COMPETITION_ENTRY_STATUS.APPROVED,
  });
  assert.equal(a.identityKey, b.identityKey);
  assert.equal(detectDuplicateActiveEntryIdentities([a, b]).valid, false);

  const terminal = createCompetitionEntry({
    ...base,
    id: "e3",
    status: COMPETITION_ENTRY_STATUS.WITHDRAWN,
  });
  assert.equal(isTerminalCompetitionEntryStatus(terminal.status), true);
  assert.equal(isActiveCompetitionEntryStatus(terminal.status), false);
  assert.equal(detectDuplicateActiveEntryIdentities([a, terminal]).valid, true);

  assert.deepEqual([...ACTIVE_ENTRY_STATUSES].sort(), ["ACTIVE", "APPROVED"].sort());
  assert.ok(TERMINAL_ENTRY_STATUSES.includes(COMPETITION_ENTRY_STATUS.COMPLETED));
  assert.equal(
    COMPETITION_REGISTRATION_STATUS.WAITLISTED in COMPETITION_ENTRY_STATUS,
    false
  );
  assert.ok(!Object.values(COMPETITION_ENTRY_STATUS).includes("WAITLISTED"));

  const registry = createInMemoryActiveEntryIdentityRegistry();
  assert.equal(registry.register(a).valid, true);
  assert.equal(registry.register(b).valid, false);
});

// ---------------------------------------------------------------------------
// 12. Legacy Individual mapper
// ---------------------------------------------------------------------------
test("legacy Individual mapper: one→INDIVIDUAL, two→PAIR, waitlist→no Entry", () => {
  const singles = mapLegacyIndividualEntryToCompetitionEntry({
    id: "e-s",
    tournamentId: "t1",
    playerIds: ["p1"],
    status: "approved",
    name: "A",
    pairType: "same_club",
  });
  assert.equal(singles.success, true);
  assert.equal(singles.entry.entryType, COMPETITION_ENTRY_TYPE.INDIVIDUAL);
  assert.equal(singles.entry.sourceId, "e-s");
  assert.ok(singles.entry.identityKey.includes("::ENTRY::INDIVIDUAL::"));

  const doubles = mapLegacyIndividualEntryToCompetitionEntry({
    id: "e-d",
    tournamentId: "t1",
    playerIds: ["p2", "p1"],
    status: "active",
    pairType: "open",
  });
  assert.equal(doubles.success, true);
  assert.equal(doubles.entry.entryType, COMPETITION_ENTRY_TYPE.PAIR);
  assert.equal(doubles.entry.extensions.payload.pairType, "open");

  const waitlisted = mapLegacyIndividualEntryToCompetitionEntry({
    id: "e-w",
    tournamentId: "t1",
    playerIds: ["p1"],
    status: "waitlisted",
    waitlistPosition: 2,
  });
  assert.equal(waitlisted.success, true);
  assert.equal(waitlisted.entry, null);
  assert.equal(waitlisted.skippedBecauseWaitlisted, true);
});

// ---------------------------------------------------------------------------
// 13. TT optional bridge
// ---------------------------------------------------------------------------
test("Team Tournament optional TEAM entry bridge does not create athlete Entries", () => {
  const mapped = mapTeamTournamentTeamToOptionalEntry({
    id: "team-9",
    tournamentId: "tt-1",
    name: "Alpha",
    captainPlayerId: "cap-1",
    playerIds: ["cap-1", "p2", "p3"],
  });
  assert.equal(mapped.success, true);
  assert.equal(mapped.entry.entryType, COMPETITION_ENTRY_TYPE.TEAM);
  assert.equal(mapped.entry.teamRef.id, "team-9");
  assert.equal(mapped.entry.representativeRef.id, "cap-1");
  assert.equal(mapped.athleteEntriesCreated, 0);
  assert.match(mapped.entry.identityKey, /::ENTRY::TEAM::/);
});

// ---------------------------------------------------------------------------
// 14. Daily Play no-Entry
// ---------------------------------------------------------------------------
test("Daily Play maps participants without creating CompetitionEntry", () => {
  const one = mapDailyPlayPlayerWithoutEntry(
    { id: "d1", name: "Daily" },
    { sessionId: "sess-1" }
  );
  assert.equal(one.success, true);
  assert.ok(one.participant);
  assert.equal(one.entry, null);
  assert.equal(one.createdCompetitionEntry, false);

  const batch = assertDailyPlayMapsWithoutEntries(
    [
      { id: "d1", name: "A" },
      { id: "d2", name: "B", isWalkIn: true },
    ],
    { sessionId: "sess-1" }
  );
  assert.equal(batch.valid, true);
});

// ---------------------------------------------------------------------------
// 15. representativeRef
// ---------------------------------------------------------------------------
test("representativeRef must be a valid ParticipantReference when present", () => {
  const ok = createCompetitionEntry({
    id: "e1",
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.TEAM,
    teamRef: { id: "t1" },
    memberRefs: [],
    representativeRef: ref("cap-1"),
  });
  assert.equal(validateCompetitionEntry(ok, { requireEntryType: true }).valid, true);

  const bad = createCompetitionEntry({
    id: "e2",
    competitionId: "c1",
    entryType: COMPETITION_ENTRY_TYPE.TEAM,
    teamRef: { id: "t1" },
    memberRefs: [],
    representativeRef: { kind: "NOT_A_KIND", id: "x" },
  });
  const result = validateCompetitionEntry(bad, { requireEntryType: true });
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.code === PARTICIPANT_ERROR_CODE.INVALID_REPRESENTATIVE_REF)
  );
});

// ---------------------------------------------------------------------------
// 16. Metadata non-authority
// ---------------------------------------------------------------------------
test("metadata cannot control entry type or tenant ownership", () => {
  const entry = createCompetitionEntry({
    id: "e1",
    competitionId: "c1",
    entryType: null,
    memberRefs: [ref("p1")],
    metadata: { entryType: "INDIVIDUAL", tenantId: "sneaky" },
  });
  const result = validateCompetitionEntry(entry);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.code === PARTICIPANT_ERROR_CODE.METADATA_NOT_AUTHORITY)
  );
});

// ---------------------------------------------------------------------------
// 17–19. Architecture boundaries
// ---------------------------------------------------------------------------
test("Core-02 participants module does not import format/player/club write modules", () => {
  const forbidden = [
    "features/player/services/",
    "features/player/repositories/",
    "features/club/repositories/",
    "features/team-tournament/engines/",
    "features/individual-tournament/engines/",
    "pages/",
  ];
  for (const file of walkJsFiles(PARTICIPANTS_DIR)) {
    const text = readFileSync(file, "utf8");
    for (const needle of forbidden) {
      assert.equal(
        text.includes(needle),
        false,
        `${path.relative(ROOT, file)} must not import ${needle}`
      );
    }
  }
});

test("constraints/** untouched by Core-02 source imports from participants", () => {
  for (const file of walkJsFiles(PARTICIPANTS_DIR)) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /from ["'].*constraints\//.test(text),
      false,
      `${path.relative(ROOT, file)} must not import constraints`
    );
  }
  // constraints tree still exists and was not deleted
  assert.equal(statSync(CONSTRAINTS_DIR).isDirectory(), true);
});

test("divisionCategory.js semantics were not expanded (opaque IDs only)", () => {
  const text = readFileSync(DIVISION_CATEGORY_FILE, "utf8");
  assert.ok(text.includes("createCompetitionDivision"));
  assert.ok(text.includes("createCompetitionCategory"));
  assert.equal(text.includes("COMPETITION_ENTRY_TYPE"), false);
  assert.equal(text.includes("taxonomy"), false);
  assert.equal(text.includes("ageBracket"), false);
});

// ---------------------------------------------------------------------------
// Inference helper
// ---------------------------------------------------------------------------
test("inferCompetitionEntryType: 1→INDIVIDUAL, 2→PAIR, teamRef→TEAM", () => {
  assert.equal(
    inferCompetitionEntryType({ memberRefs: [ref("a")] }).entryType,
    COMPETITION_ENTRY_TYPE.INDIVIDUAL
  );
  assert.equal(
    inferCompetitionEntryType({ memberRefs: [ref("b"), ref("a")] }).entryType,
    COMPETITION_ENTRY_TYPE.PAIR
  );
  assert.equal(
    inferCompetitionEntryType({ teamRef: { id: "t1" } }).entryType,
    COMPETITION_ENTRY_TYPE.TEAM
  );
  assert.equal(inferCompetitionEntryType({ memberRefs: [] }).ok, false);
});

test("Player Management read-map produces ParticipantReference only", () => {
  const mapped = mapPlayerProfileToParticipantReference({
    player_id: "player-auth-1",
    displayName: "Lan",
  });
  assert.equal(mapped.success, true);
  assert.equal(mapped.reference.kind, PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE);
  assert.equal(mapped.reference.id, "player-auth-1");
});

test("backward-compatible createCompetitionEntry without entryType still validates legacy path", () => {
  const legacy = createCompetitionEntry({
    id: "e-legacy",
    competitionId: "c1",
    memberRefs: [ref("p1")],
    status: COMPETITION_ENTRY_STATUS.DRAFT,
  });
  assert.equal(legacy.entryType, null);
  assert.equal(validateCompetitionEntry(legacy).valid, true);
});
