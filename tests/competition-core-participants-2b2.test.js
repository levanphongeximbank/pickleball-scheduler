import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PARTICIPANT_SCHEMA_VERSION,
  PARTICIPANT_REFERENCE_KIND,
  COMPETITION_ENTRY_STATUS,
  COMPETITION_REGISTRATION_STATUS,
  COMPETITION_ROSTER_STATUS,
  COMPETITION_LINEUP_STATUS,
  COMPETITION_LIFECYCLE_MARKER,
  createParticipantReference,
  linkParticipantReferenceAlias,
  createParticipantSnapshot,
  createSeedLockedRatingSnapshot,
  createCompetitionParticipant,
  createCompetitionEntry,
  createCompetitionRegistration,
  createCompetitionRoster,
  createCompetitionRosterMember,
  createRosterSubstitutionReference,
  createCompetitionLineup,
  createCompetitionLineupRevision,
  createCompetitionLineupSlot,
  createCompetitionDivision,
  createCompetitionCategory,
  validateParticipantReference,
  validateCompetitionParticipant,
  validateCompetitionEntry,
  detectDuplicateActiveEntryScopes,
  validateCompetitionRegistration,
  assertWaitlistDoesNotActivateEntry,
  validateCompetitionRoster,
  assertRosterNotDirectlyMutatedWhenLocked,
  validateCompetitionLineup,
  validateLineupRevision,
  validateLineupRevisionSequence,
  assertLineupRevisionImmutableWhenLocked,
  validateDivision,
  validateCategory,
  assertDivisionAndCategoryAreSeparate,
  validateParticipantSnapshot,
  createParticipantDTOv1,
  createEntryDTOv1,
  createRegistrationDTOv1,
  createLineupDTOv1,
  legacyPlayerToParticipantMapper,
  legacyEntryToEntryMapper,
  legacyTeamToTeamMapper,
  legacyRosterToRosterMapper,
  legacyLineupToLineupMapper,
  PARTICIPANT_REPOSITORY_PORT_METHODS,
  matchesRepositoryPortShape,
  createInMemoryParticipantPorts,
  getCompetitionCoreFeatureFlags,
} from "../src/features/competition-core/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PARTICIPANTS_DIR = path.join(ROOT, "src/features/competition-core/participants");

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

test("guest ParticipantReference is valid without platform account (OD-01)", () => {
  const ref = createParticipantReference({
    kind: PARTICIPANT_REFERENCE_KIND.GUEST,
    id: "guest-walkin-1",
    displayNameSnapshot: "Khách A",
  });
  assert.equal(validateParticipantReference(ref).valid, true);
});

test("linking guest to profile updates aliases only (OD-01)", () => {
  const guest = createParticipantReference({
    kind: PARTICIPANT_REFERENCE_KIND.GUEST,
    id: "guest-1",
  });
  const linked = linkParticipantReferenceAlias(guest, {
    kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
    id: "player-99",
  });
  assert.equal(linked.kind, PARTICIPANT_REFERENCE_KIND.GUEST);
  assert.equal(linked.id, "guest-1");
  assert.ok(linked.aliases.includes("PLAYER_PROFILE:player-99"));
});

test("CompetitionParticipant requires identity and competitionId", () => {
  const missing = createCompetitionParticipant({ id: "", competitionId: "", person: { id: "" } });
  assert.equal(validateCompetitionParticipant(missing).valid, false);

  const ok = createCompetitionParticipant({
    id: "cp-1",
    competitionId: "c-1",
    person: createParticipantReference({
      kind: PARTICIPANT_REFERENCE_KIND.PLATFORM_USER,
      id: "user-1",
    }),
    status: "ACTIVE",
  });
  assert.equal(validateCompetitionParticipant(ok).valid, true);
});

test("CompetitionEntry requires competitionId (OD-03)", () => {
  const entry = createCompetitionEntry({
    id: "e1",
    competitionId: "",
    memberRefs: [
      createParticipantReference({ kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE, id: "p1" }),
    ],
  });
  const result = validateCompetitionEntry(entry);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.path === "competitionId"));
});

test("detects duplicate active entry scopes (OD-02)", () => {
  const base = {
    competitionId: "c1",
    divisionId: "d1",
    categoryId: "cat1",
    entryRole: "primary",
    memberRefs: [
      createParticipantReference({ kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE, id: "p1" }),
    ],
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
  assert.equal(detectDuplicateActiveEntryScopes([a, b]).valid, false);
  assert.equal(detectDuplicateActiveEntryScopes([a, b], { allowDuplicateScope: true }).valid, true);
  assert.equal(
    detectDuplicateActiveEntryScopes([
      a,
      createCompetitionEntry({ ...b, id: "e3", categoryId: "cat2" }),
    ]).valid,
    true
  );
});

test("waitlisted registration does not activate entry (OD-10)", () => {
  const reg = createCompetitionRegistration({
    id: "r1",
    competitionId: "c1",
    status: COMPETITION_REGISTRATION_STATUS.WAITLISTED,
    waitlistPosition: 3,
    entryId: null,
  });
  assert.equal(validateCompetitionRegistration(reg).valid, true);
  assert.equal(
    validateCompetitionRegistration(createCompetitionRegistration({ ...reg, entryId: "e1" })).valid,
    false
  );
  const entry = createCompetitionEntry({
    id: "e1",
    competitionId: "c1",
    status: COMPETITION_ENTRY_STATUS.ACTIVE,
    memberRefs: [
      createParticipantReference({ kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE, id: "p1" }),
    ],
  });
  assert.equal(assertWaitlistDoesNotActivateEntry(reg, entry).valid, false);
});

test("Division and Category are separate entities (OD-07)", () => {
  const division = createCompetitionDivision({
    id: "div-a",
    competitionId: "c1",
    name: "Bảng A",
    categoryIds: ["cat-md"],
  });
  const category = createCompetitionCategory({
    id: "cat-md",
    competitionId: "c1",
    code: "men_double",
  });
  assert.equal(validateDivision(division).valid, true);
  assert.equal(validateCategory(category).valid, true);
  assert.equal(assertDivisionAndCategoryAreSeparate(division, category).valid, true);
  assert.equal(assertDivisionAndCategoryAreSeparate(division, division).valid, false);
});

test("participant snapshot is JSON-safe and does not mutate source (OD-08)", () => {
  const sourceProfile = { name: "A", rating: 4.5, nested: { club: "X" } };
  const snapshot = createParticipantSnapshot({
    displayName: sourceProfile.name,
    rating: sourceProfile.rating,
    eligibilityAttributes: { gender: "M" },
    affiliation: { ...sourceProfile.nested },
    identityReference: createParticipantReference({
      kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
      id: "p1",
    }),
    snapshotAt: "2026-07-17T00:00:00.000Z",
  });
  assert.equal(validateParticipantSnapshot(snapshot).valid, true);
  snapshot.affiliation.club = "MUTATED";
  assert.equal(sourceProfile.nested.club, "X");
});

test("SEED_LOCKED rating snapshot contract exists (OD-09)", () => {
  const snap = createSeedLockedRatingSnapshot({
    competitionId: "c1",
    subjectKind: "entry",
    subjectId: "e1",
    rating: 1520,
    lockedAt: "2026-07-17T00:00:00.000Z",
    marker: COMPETITION_LIFECYCLE_MARKER.SEED_LOCKED,
  });
  assert.equal(snap.marker, "SEED_LOCKED");
  assert.equal(snap.schemaVersion, PARTICIPANT_SCHEMA_VERSION);
});

test("roster draft, lock, and no direct locked mutation (OD-04/OD-05)", () => {
  const member = createCompetitionRosterMember({
    id: "m1",
    rosterId: "roster-1",
    person: createParticipantReference({
      kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
      id: "p1",
    }),
  });
  const draft = createCompetitionRoster({
    id: "roster-1",
    competitionId: "c1",
    teamId: "t1",
    status: COMPETITION_ROSTER_STATUS.DRAFT,
    members: [member],
  });
  assert.equal(validateCompetitionRoster(draft).valid, true);

  const locked = createCompetitionRoster({
    ...draft,
    status: COMPETITION_ROSTER_STATUS.ROSTER_LOCKED,
    lockedAt: "2026-07-17T01:00:00.000Z",
  });
  assert.equal(validateCompetitionRoster(locked).valid, true);

  const mutated = createCompetitionRoster({
    ...locked,
    members: [
      createCompetitionRosterMember({
        id: "m2",
        rosterId: "roster-1",
        person: createParticipantReference({
          kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
          id: "p2",
        }),
      }),
    ],
  });
  assert.equal(assertRosterNotDirectlyMutatedWhenLocked(locked, mutated).valid, false);

  const amended = createCompetitionRoster({
    ...mutated,
    amendments: [
      createRosterSubstitutionReference({
        id: "sub-1",
        rosterId: "roster-1",
        replaced: createParticipantReference({
          kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
          id: "p1",
        }),
        replacement: createParticipantReference({
          kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
          id: "p2",
        }),
        reason: "injury",
        requestedBy: "captain",
        approvedBy: "director",
        effectiveAt: "2026-07-17T02:00:00.000Z",
      }),
    ],
  });
  assert.equal(assertRosterNotDirectlyMutatedWhenLocked(locked, amended).valid, true);

  const dup = createCompetitionRoster({
    ...draft,
    members: [member, { ...member, id: "m2" }],
  });
  assert.equal(validateCompetitionRoster(dup).valid, false);
});

test("lineup revision sequence and immutability (OD-06)", () => {
  const slot = createCompetitionLineupSlot({
    id: "s1",
    disciplineOrSideKey: "MD",
    index: 0,
    person: createParticipantReference({
      kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
      id: "p1",
    }),
  });
  const r1 = createCompetitionLineupRevision({
    lineupId: "L1",
    revision: 1,
    previousRevisionId: null,
    status: COMPETITION_LINEUP_STATUS.SUBMITTED,
    slots: [slot],
    submittedAt: "2026-07-17T00:00:00.000Z",
    submittedBy: "captain",
  });
  assert.equal(validateLineupRevision(r1).valid, true);

  const r2 = createCompetitionLineupRevision({
    lineupId: "L1",
    revision: 2,
    previousRevisionId: "L1:1",
    status: COMPETITION_LINEUP_STATUS.LOCKED,
    lockedAt: "2026-07-17T01:00:00.000Z",
    slots: [slot],
    reason: "deadline lock",
  });
  assert.equal(validateLineupRevisionSequence([r1, r2]).valid, true);
  assert.equal(
    validateLineupRevisionSequence([r1, { ...r2, revision: 1, previousRevisionId: null }]).valid,
    false
  );
  assert.equal(
    assertLineupRevisionImmutableWhenLocked(r2, {
      ...r2,
      slots: [
        createCompetitionLineupSlot({
          id: "s2",
          disciplineOrSideKey: "MD",
          index: 0,
          person: createParticipantReference({
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
            id: "p2",
          }),
        }),
      ],
    }).valid,
    false
  );

  const lineup = createCompetitionLineup({
    id: "L1",
    competitionId: "c1",
    teamId: "t1",
    contextId: "mu-1",
    status: COMPETITION_LINEUP_STATUS.LOCKED,
    revision: 2,
    previousRevisionId: "L1:1",
    lockedAt: "2026-07-17T01:00:00.000Z",
    slots: [slot],
    revisions: [r1, r2],
  });
  assert.equal(validateCompetitionLineup(lineup).valid, true);
});

test("DTOs are versioned and JSON-safe", () => {
  const dto = createParticipantDTOv1({
    id: "cp1",
    competitionId: "c1",
    person: createParticipantReference({
      kind: PARTICIPANT_REFERENCE_KIND.GUEST,
      id: "g1",
    }),
  });
  assert.equal(dto.schemaVersion, PARTICIPANT_SCHEMA_VERSION);
  assert.equal(dto.dtoType, "ParticipantDTO");
  assert.equal(createEntryDTOv1({
    id: "e1",
    competitionId: "c1",
    memberRefs: [
      createParticipantReference({ kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE, id: "p1" }),
    ],
  }).dtoType, "EntryDTO");
  assert.equal(
    createRegistrationDTOv1({
      id: "r1",
      competitionId: "c1",
      status: COMPETITION_REGISTRATION_STATUS.WAITLISTED,
    }).dtoType,
    "RegistrationDTO"
  );
  assert.equal(
    createLineupDTOv1({
      id: "L1",
      competitionId: "c1",
      teamId: "t1",
      contextId: "mu1",
      slots: [],
    }).dtoType,
    "LineupDTO"
  );
});

test("mapping fixtures produce valid canonical targets", () => {
  assert.equal(
    legacyPlayerToParticipantMapper.validateTarget(
      legacyPlayerToParticipantMapper.map({
        id: "p1",
        name: "A",
        competitionId: "c1",
        playerType: "guest",
      })
    ).valid,
    true
  );
  assert.equal(
    legacyEntryToEntryMapper.validateTarget(
      legacyEntryToEntryMapper.map({
        id: "e1",
        tournamentId: "c1",
        eventId: "ev1",
        playerIds: ["p1", "p2"],
        status: "approved",
      })
    ).valid,
    true
  );
  assert.equal(
    legacyTeamToTeamMapper.validateTarget(
      legacyTeamToTeamMapper.map({
        id: "t1",
        tournamentId: "c1",
        name: "Team A",
        captainPlayerId: "p1",
      })
    ).valid,
    true
  );
  assert.equal(
    legacyRosterToRosterMapper.validateTarget(
      legacyRosterToRosterMapper.map({
        id: "t1",
        tournamentId: "c1",
        playerIds: ["p1", "p2"],
        captainPlayerId: "p1",
      })
    ).valid,
    true
  );
  assert.equal(
    legacyLineupToLineupMapper.validateTarget(
      legacyLineupToLineupMapper.map({
        matchupId: "m1",
        teamId: "t1",
        tournamentId: "c1",
        status: "submitted",
        selections: { MD: ["p1", "p2"] },
      })
    ).valid,
    true
  );
});

test("repository port shape and in-memory fake", async () => {
  const ports = createInMemoryParticipantPorts();
  assert.equal(matchesRepositoryPortShape(ports, PARTICIPANT_REPOSITORY_PORT_METHODS), true);
  const participant = createCompetitionParticipant({
    id: "cp1",
    competitionId: "c1",
    person: createParticipantReference({
      kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
      id: "p1",
    }),
    status: "ACTIVE",
  });
  await ports.save(participant);
  const found = await ports.findByExternalReference(
    { kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE, id: "p1" },
    "c1"
  );
  assert.equal(found?.id, "cp1");
});

test("participants module has no React/MUI/Supabase/format imports", () => {
  const forbidden = [
    /from\s+["']react["']/,
    /from\s+["']@mui\//,
    /from\s+["'][^"']*supabaseClient/,
    /from\s+["']@supabase\//,
    /from\s+["'][^"']*features\/team-tournament/,
    /from\s+["'][^"']*features\/individual-tournament/,
    /from\s+["'][^"']*tournament-engine/,
    /from\s+["'][^"']*pages\//,
  ];
  for (const file of walkJsFiles(PARTICIPANTS_DIR)) {
    const content = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(pattern.test(content), false, `${file} matched ${pattern}`);
    }
  }
});

test("Competition Core flags remain default OFF", () => {
  assert.equal(getCompetitionCoreFeatureFlags({}).coreEnabled, false);
});

test("validators do not mutate input objects", () => {
  const entry = createCompetitionEntry({
    id: "e1",
    competitionId: "c1",
    memberRefs: [
      createParticipantReference({ kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE, id: "p1" }),
    ],
  });
  const before = JSON.stringify(entry);
  validateCompetitionEntry(entry);
  assert.equal(JSON.stringify(entry), before);
});
