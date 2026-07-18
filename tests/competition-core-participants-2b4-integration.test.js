import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as CompetitionCore from "../src/features/competition-core/index.js";

import {
  mapTeamPlayerToParticipant,
  mapTeamToCompetitionTeam,
  mapTeamRosterToCompetitionRoster,
  mapTeamLineupToCompetitionLineup,
  mapTeamRegistration,
  mapTeamTournamentBundle,
} from "../src/features/team-tournament/adapters/competition-core/index.js";

import {
  mapIndividualPlayerToParticipant,
  mapIndividualEntry,
  mapIndividualClassification,
} from "../src/features/individual-tournament/adapters/competition-core/index.js";

import {
  mapDailyPlayerToParticipant,
  mapDailySessionParticipants,
  mapDailyTemporaryPair,
} from "../src/features/daily-play/adapters/competition-core/index.js";

import {
  mapInternalMemberRegistration,
  mapOfficialOpenRegistration,
  mapInternalOfficialEvidenceBundle,
  runShadowMapping,
  MAPPING_DIAGNOSTIC_CODE,
  createMappingDiagnostic,
  MAPPING_DIAGNOSTIC_SEVERITY,
  cloneSourceSnapshot,
  assertSourceUnchanged,
} from "../src/tournament/adapters/competition-core/index.js";

import {
  FIXTURE_COMPETITION_ID,
  teamPlayers,
  validTeam4,
  lockedRosterTeam,
  duplicateMemberTeam,
  substitutionRef,
  hiddenLineupRevision,
  invalidLineupRevision,
} from "./fixtures/competition-core-2b3/teamTournament.js";

import {
  FIXTURE_TOURNAMENT_ID,
  individualPlayers,
  singlesEntry,
  waitlistedEntry,
  missingCompetitionEntry,
  multiDivisionEntries,
  classificationFixture,
  partnerInviteEntry,
} from "./fixtures/competition-core-2b3/individualTournament.js";

import {
  DAILY_SESSION_ID,
  dailyPlayers,
  dailySession,
  dailyTemporaryMatch,
} from "./fixtures/competition-core-2b3/dailyPlay.js";

import {
  INTERNAL_TOURNAMENT_ID,
  OFFICIAL_TOURNAMENT_ID,
  internalMemberRegistration,
  officialOpenRegistration,
  officialSeedPlayer,
  officialClassification,
} from "./fixtures/competition-core-2b3/internalOfficial.js";

import {
  assessTeamBundleNoLoss,
  assessIndividualEntryNoLoss,
  summarizeNoLoss,
  NO_LOSS_CLASSIFICATION,
} from "./fixtures/competition-core-2b4/noLossAssessment.js";

import { createClosureInMemoryPorts } from "./fixtures/competition-core-2b4/inMemoryPorts.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  PARTICIPANT_REFERENCE_KIND,
  COMPETITION_ROSTER_STATUS,
  COMPETITION_LINEUP_STATUS,
  COMPETITION_ENTRY_STATUS,
  COMPETITION_REGISTRATION_STATUS,
  COMPETITION_LIFECYCLE_MARKER,
  createParticipantReference,
  linkParticipantReferenceAlias,
  createParticipantSnapshot,
  createSeedLockedRatingSnapshot,
  createCompetitionParticipant,
  createCompetitionEntry,
  createCompetitionRoster,
  createCompetitionRosterMember,
  createRosterSubstitutionReference,
  createCompetitionLineup,
  createCompetitionLineupRevision,
  createCompetitionLineupSlot,
  createCompetitionDivision,
  createCompetitionCategory,
  createParticipantDTOv1,
  createEntryDTOv1,
  createRegistrationDTOv1,
  createTeamDTOv1,
  createRosterDTOv1,
  createLineupDTOv1,
  createDivisionDTOv1,
  createCategoryDTOv1,
  validateParticipantReference,
  validateCompetitionParticipant,
  validateCompetitionEntry,
  validateCompetitionRegistration,
  validateCompetitionTeam,
  validateCompetitionRoster,
  validateCompetitionLineup,
  validateLineupRevisionSequence,
  validateParticipantSnapshot,
  validateDivision,
  validateCategory,
  detectDuplicateActiveEntryScopes,
  assertWaitlistDoesNotActivateEntry,
  assertRosterNotDirectlyMutatedWhenLocked,
  assertLineupRevisionImmutableWhenLocked,
  assertDivisionAndCategoryAreSeparate,
  PARTICIPANT_REPOSITORY_PORT_METHODS,
  ENTRY_REPOSITORY_PORT_METHODS,
  REGISTRATION_REPOSITORY_PORT_METHODS,
  TEAM_REPOSITORY_PORT_METHODS,
  ROSTER_REPOSITORY_PORT_METHODS,
  LINEUP_REPOSITORY_PORT_METHODS,
  DIVISION_REPOSITORY_PORT_METHODS,
  CATEGORY_REPOSITORY_PORT_METHODS,
  matchesRepositoryPortShape,
  getCompetitionCoreFeatureFlags,
} = CompetitionCore;

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

function assertJsonSafe(value) {
  assert.doesNotThrow(() => JSON.stringify(value));
  assert.deepEqual(JSON.parse(JSON.stringify(value)), JSON.parse(JSON.stringify(value)));
}

/* -------------------------------------------------------------------------- */
/* 3. Integration matrix                                                      */
/* -------------------------------------------------------------------------- */

test("2B.4 matrix: Team Tournament participant/team/roster/lineup/registration", () => {
  const player = mapTeamPlayerToParticipant(teamPlayers.p1, {
    competitionId: FIXTURE_COMPETITION_ID,
  });
  const team = mapTeamToCompetitionTeam(validTeam4, { competitionId: FIXTURE_COMPETITION_ID });
  const roster = mapTeamRosterToCompetitionRoster(validTeam4, {
    competitionId: FIXTURE_COMPETITION_ID,
    playerById: teamPlayers,
  });
  const lineup = mapTeamLineupToCompetitionLineup(hiddenLineupRevision, {
    competitionId: FIXTURE_COMPETITION_ID,
  });
  const reg = mapTeamRegistration(
    {
      id: "tt-reg-1",
      teamId: validTeam4.id,
      tournamentId: FIXTURE_COMPETITION_ID,
      status: "approved",
      playerIds: validTeam4.playerIds,
      name: validTeam4.name,
    },
    { competitionId: FIXTURE_COMPETITION_ID }
  );

  assert.equal(player.success, true);
  assert.equal(validateCompetitionParticipant(player.value).valid, true);
  assert.equal(createParticipantDTOv1(player.value).schemaVersion, "1");

  assert.equal(team.success, true);
  assert.equal(validateCompetitionTeam(team.value).valid, true);
  assert.equal(createTeamDTOv1(team.value).id, validTeam4.id);

  assert.equal(roster.success, true);
  assert.equal(validateCompetitionRoster(roster.value).valid, true);
  assert.equal(createRosterDTOv1(roster.value).teamId, validTeam4.id);

  assert.equal(lineup.success, true);
  assert.equal(validateCompetitionLineup(lineup.value).valid, true);
  assert.equal(createLineupDTOv1(lineup.value).revision, lineup.value.revision);

  assert.equal(reg.success, true);
  assert.equal(validateCompetitionRegistration(reg.value.registration).valid, true);
  assert.equal(validateCompetitionEntry(reg.value.entry).valid, true);
});

test("2B.4 matrix: Individual participant/entry/classification", () => {
  const participant = mapIndividualPlayerToParticipant(individualPlayers.s1, {
    competitionId: FIXTURE_TOURNAMENT_ID,
  });
  const entry = mapIndividualEntry(singlesEntry, { playerById: individualPlayers });
  const classification = mapIndividualClassification(classificationFixture, {
    competitionId: FIXTURE_TOURNAMENT_ID,
  });

  assert.equal(participant.success, true);
  assert.equal(validateCompetitionParticipant(participant.value).valid, true);
  assert.equal(entry.success, true);
  assert.equal(validateCompetitionEntry(entry.value.entry).valid, true);
  assert.equal(createEntryDTOv1(entry.value.entry).id, singlesEntry.id);
  assert.equal(createRegistrationDTOv1(entry.value.registration).competitionId, FIXTURE_TOURNAMENT_ID);
  assert.equal(classification.success, true);
  assert.equal(validateDivision(classification.value.division).valid, true);
  assert.equal(validateCategory(classification.value.category).valid, true);
  assert.equal(createDivisionDTOv1(classification.value.division).id, "div-a");
  assert.equal(createCategoryDTOv1(classification.value.category).id, "cat-ms");
});

test("2B.4 matrix: Daily participant/session/temporary pair", () => {
  const participant = mapDailyPlayerToParticipant(dailyPlayers.registered, {
    competitionId: DAILY_SESSION_ID,
    checkedIn: true,
  });
  const session = mapDailySessionParticipants(dailySession, { playerById: dailyPlayers });
  const pair = mapDailyTemporaryPair(dailyTemporaryMatch, { competitionId: DAILY_SESSION_ID });

  assert.equal(participant.success, true);
  assert.equal(validateCompetitionParticipant(participant.value).valid, true);
  assert.equal(session.success, true);
  assert.equal(session.value.entry, null);
  assert.equal(pair.success, true);
  assert.equal(pair.value.extensions.payload.notCompetitionEntry, true);
});

test("2B.4 matrix: Internal registration/entry + Official registration/entry/seed", () => {
  const internal = mapInternalMemberRegistration(internalMemberRegistration, {
    competitionId: INTERNAL_TOURNAMENT_ID,
  });
  const official = mapOfficialOpenRegistration(officialOpenRegistration, {
    competitionId: OFFICIAL_TOURNAMENT_ID,
    seedLocked: true,
    seedLockedAt: "2026-05-10T00:00:00.000Z",
  });
  const evidence = mapInternalOfficialEvidenceBundle({
    formatKind: "official",
    entry: officialOpenRegistration,
    player: officialSeedPlayer,
    classification: officialClassification,
    context: { competitionId: OFFICIAL_TOURNAMENT_ID, seedLocked: true },
  });

  assert.equal(internal.success, true);
  assert.equal(internal.value.entry.status, COMPETITION_ENTRY_STATUS.ACTIVE);
  assert.equal(official.success, true);
  assert.ok(official.value.seedLockedRating);
  assert.equal(official.value.seedLockedRating.marker, "SEED_LOCKED");
  assert.equal(evidence.success, true);
  assert.ok(evidence.value.classification.division);
  assert.ok(evidence.value.classification.category);
});

/* -------------------------------------------------------------------------- */
/* 4. Identity                                                                */
/* -------------------------------------------------------------------------- */

test("2B.4 identity kinds: platform/player/athlete/club/guest/external without collision", () => {
  const kinds = [
    { kind: PARTICIPANT_REFERENCE_KIND.PLATFORM_USER, id: "user-1" },
    { kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE, id: "player-1" },
    { kind: PARTICIPANT_REFERENCE_KIND.ATHLETE, id: "athlete-1" },
    { kind: PARTICIPANT_REFERENCE_KIND.CLUB_MEMBER, id: "member-1" },
    { kind: PARTICIPANT_REFERENCE_KIND.GUEST, id: "guest-1" },
    { kind: PARTICIPANT_REFERENCE_KIND.EXTERNAL, id: "ext-1" },
  ];
  const refs = kinds.map((k) => createParticipantReference(k));
  for (const ref of refs) assert.equal(validateParticipantReference(ref).valid, true);

  // Same numeric-looking id space across kinds must not collide as identity
  const a = createParticipantReference({ kind: PARTICIPANT_REFERENCE_KIND.GUEST, id: "1" });
  const b = createParticipantReference({ kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE, id: "1" });
  assert.notEqual(`${a.kind}:${a.id}`, `${b.kind}:${b.id}`);
});

test("2B.4 identity: display/snapshot/alias changes do not rewrite canonical person id", () => {
  const guest = createParticipantReference({
    kind: PARTICIPANT_REFERENCE_KIND.GUEST,
    id: "guest-walk-9",
    displayNameSnapshot: "Old Name",
  });
  const renamed = createParticipantReference({ ...guest, displayNameSnapshot: "New Name" });
  assert.equal(renamed.id, guest.id);
  assert.equal(renamed.kind, guest.kind);

  const snapshot = createParticipantSnapshot({
    displayName: "Snap Name",
    rating: 4.2,
    identityReference: guest,
    snapshotAt: "2026-07-18T00:00:00.000Z",
  });
  assert.equal(snapshot.identityReference.id, "guest-walk-9");

  const linked = linkParticipantReferenceAlias(guest, {
    kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
    id: "player-99",
  });
  assert.equal(linked.id, "guest-walk-9");
  assert.equal(linked.kind, PARTICIPANT_REFERENCE_KIND.GUEST);
  assert.ok(linked.aliases.includes("PLAYER_PROFILE:player-99"));

  const participant = createCompetitionParticipant({
    id: "cp-guest-walk-9",
    competitionId: "c-id",
    person: linked,
    displayName: "New Name",
    snapshot,
  });
  assert.equal(participant.person.id, "guest-walk-9");
  assert.equal(validateCompetitionParticipant(participant).valid, true);
});

/* -------------------------------------------------------------------------- */
/* 5. Entry                                                                   */
/* -------------------------------------------------------------------------- */

test("2B.4 entry: competitionId required; division≠category; multi-entry; duplicates; waitlist", () => {
  assert.equal(mapIndividualEntry(missingCompetitionEntry).success, false);

  const singles = mapIndividualEntry(singlesEntry, { playerById: individualPlayers });
  assert.notEqual(singles.value.entry.divisionId, singles.value.entry.categoryId);
  assert.equal(
    assertDivisionAndCategoryAreSeparate(
      createCompetitionDivision({
        id: singles.value.entry.divisionId,
        competitionId: FIXTURE_TOURNAMENT_ID,
        name: "A",
      }),
      createCompetitionCategory({
        id: singles.value.entry.categoryId,
        competitionId: FIXTURE_TOURNAMENT_ID,
        code: "ms",
      })
    ).valid,
    true
  );

  const a = mapIndividualEntry(multiDivisionEntries[0], { playerById: individualPlayers });
  const b = mapIndividualEntry(multiDivisionEntries[1], { playerById: individualPlayers });
  assert.notEqual(a.value.entry.id, b.value.entry.id);
  assert.equal(detectDuplicateActiveEntryScopes([a.value.entry, b.value.entry]).valid, true);

  const dup = detectDuplicateActiveEntryScopes([
    a.value.entry,
    createCompetitionEntry({ ...a.value.entry, id: "clone-dup" }),
  ]);
  assert.equal(dup.valid, false);

  const wait = mapIndividualEntry(waitlistedEntry, { playerById: individualPlayers });
  assert.equal(wait.value.registration.status, COMPETITION_REGISTRATION_STATUS.WAITLISTED);
  assert.equal(wait.value.entry, null);
  assert.equal(
    assertWaitlistDoesNotActivateEntry(
      wait.value.registration,
      createCompetitionEntry({
        id: "should-not",
        competitionId: FIXTURE_TOURNAMENT_ID,
        status: COMPETITION_ENTRY_STATUS.ACTIVE,
        memberRefs: [
          createParticipantReference({
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
            id: "d2",
          }),
        ],
      })
    ).valid,
    false
  );

  const withdrawn = mapIndividualEntry(
    { ...singlesEntry, id: "entry-withdrawn", status: "withdrawn" },
    { playerById: individualPlayers }
  );
  assert.equal(withdrawn.value.entry.status, COMPETITION_ENTRY_STATUS.WITHDRAWN);
  assert.notEqual(withdrawn.value.entry.status, COMPETITION_ENTRY_STATUS.ACTIVE);

  const teamReg = mapTeamRegistration(
    {
      id: "tt-entry-shape",
      teamId: "team-alpha",
      tournamentId: FIXTURE_COMPETITION_ID,
      status: "approved",
      playerIds: ["p1", "p2"],
      name: "Team",
    },
    { competitionId: FIXTURE_COMPETITION_ID }
  );
  assert.equal(teamReg.value.entry.entryRole, "team");
  assert.notEqual(teamReg.value.entry.entryRole, singles.value.entry.entryRole);

  const daily = mapDailySessionParticipants(dailySession, { playerById: dailyPlayers });
  assert.equal(daily.value.entry, null);

  const internal = mapInternalMemberRegistration(internalMemberRegistration, {
    competitionId: INTERNAL_TOURNAMENT_ID,
  });
  assert.equal(internal.value.registration.extensions.payload.formatKind, "internal");
  const official = mapOfficialOpenRegistration(officialOpenRegistration, {
    competitionId: OFFICIAL_TOURNAMENT_ID,
  });
  assert.equal(official.value.registration.extensions.payload.formatKind, "official");
});

/* -------------------------------------------------------------------------- */
/* 6. Team / Roster / Lineup                                                  */
/* -------------------------------------------------------------------------- */

test("2B.4 team/roster/lineup locks, substitutions, revisions, format extensions", () => {
  const team = mapTeamToCompetitionTeam(validTeam4, { competitionId: FIXTURE_COMPETITION_ID });
  assert.equal(team.value.captainRef.id, "p1");

  const roster = mapTeamRosterToCompetitionRoster(validTeam4, {
    competitionId: FIXTURE_COMPETITION_ID,
    playerById: teamPlayers,
  });
  assert.equal(roster.value.members.length, 4);

  assert.equal(
    mapTeamRosterToCompetitionRoster(duplicateMemberTeam, {
      competitionId: FIXTURE_COMPETITION_ID,
    }).success,
    false
  );

  const locked = mapTeamRosterToCompetitionRoster(lockedRosterTeam, {
    competitionId: FIXTURE_COMPETITION_ID,
    playerById: teamPlayers,
  });
  assert.equal(locked.value.status, COMPETITION_ROSTER_STATUS.ROSTER_LOCKED);
  const mutatedMembers = createCompetitionRoster({
    ...locked.value,
    members: [
      createCompetitionRosterMember({
        id: "rm-x",
        rosterId: locked.value.id,
        person: createParticipantReference({
          kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
          id: "p99",
        }),
      }),
    ],
  });
  assert.equal(assertRosterNotDirectlyMutatedWhenLocked(locked.value, mutatedMembers).valid, false);

  const withSub = mapTeamRosterToCompetitionRoster(
    { ...lockedRosterTeam, substitutions: [substitutionRef] },
    { competitionId: FIXTURE_COMPETITION_ID, playerById: teamPlayers }
  );
  assert.equal(withSub.value.amendments.length, 1);
  assert.equal(withSub.value.amendments[0].replaced.id, "p4");
  const amendedOk = assertRosterNotDirectlyMutatedWhenLocked(
    locked.value,
    createCompetitionRoster({
      ...mutatedMembers,
      amendments: [
        createRosterSubstitutionReference({
          id: "sub-x",
          rosterId: locked.value.id,
          replaced: createParticipantReference({
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
            id: "p1",
          }),
          replacement: createParticipantReference({
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
            id: "p99",
          }),
          reason: "injury",
        }),
      ],
    })
  );
  assert.equal(amendedOk.valid, true);

  const lineup = mapTeamLineupToCompetitionLineup(hiddenLineupRevision, {
    competitionId: FIXTURE_COMPETITION_ID,
  });
  assert.ok(lineup.value.revisions.length >= 2);
  assert.equal(validateLineupRevisionSequence(lineup.value.revisions).valid, true);
  assert.equal(
    validateLineupRevisionSequence([
      createCompetitionLineupRevision({ lineupId: "x", revision: 2, slots: [] }),
      createCompetitionLineupRevision({ lineupId: "x", revision: 1, slots: [] }),
      createCompetitionLineupRevision({ lineupId: "x", revision: 2, slots: [] }),
    ]).valid,
    false
  );
  assert.equal(
    validateLineupRevisionSequence([
      createCompetitionLineupRevision({ lineupId: "x", revision: 1, slots: [] }),
      createCompetitionLineupRevision({ lineupId: "x", revision: 3, slots: [] }),
    ]).valid,
    false
  );

  const lockedLineup = createCompetitionLineup({
    ...lineup.value,
    status: COMPETITION_LINEUP_STATUS.LOCKED,
    lockedAt: "2026-07-18T01:00:00.000Z",
  });
  const mutatedLineup = createCompetitionLineup({
    ...lockedLineup,
    slots: [
      createCompetitionLineupSlot({
        id: "slot-mut",
        disciplineOrSideKey: "md",
        index: 0,
        person: createParticipantReference({
          kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
          id: "p9",
        }),
      }),
    ],
  });
  assert.equal(
    assertLineupRevisionImmutableWhenLocked(lockedLineup, mutatedLineup).valid,
    false
  );

  assert.equal(
    lineup.value.extensions.payload.hiddenLineupPolicyRef,
    "team-tournament:getVisibleLineup"
  );
  assert.equal(lineup.value.extensions.payload.dreambreaker == null, true);
  assert.equal(Object.prototype.hasOwnProperty.call(lineup.value, "mlp"), false);
  assert.equal(mapTeamLineupToCompetitionLineup(invalidLineupRevision).success, false);
});

/* -------------------------------------------------------------------------- */
/* 7. Snapshot & seed lock                                                    */
/* -------------------------------------------------------------------------- */

test("2B.4 snapshot/seed lock: JSON-safe, immutable source, SEED_LOCKED stable", () => {
  const source = {
    name: "Live Player",
    rating: 4.5,
    nested: { club: "Alpha" },
    gender: "M",
  };
  const snapshot = createParticipantSnapshot({
    displayName: source.name,
    rating: source.rating,
    eligibilityAttributes: { gender: source.gender },
    affiliation: { ...source.nested },
    identityReference: createParticipantReference({
      kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
      id: "p-snap",
    }),
    snapshotAt: "2026-07-18T00:00:00.000Z",
    seedLocked: true,
    seedLockedRating: 4.5,
  });
  assert.equal(validateParticipantSnapshot(snapshot).valid, true);
  assertJsonSafe(snapshot);
  snapshot.affiliation.club = "MUTATED";
  snapshot.displayName = "Changed";
  assert.equal(source.nested.club, "Alpha");
  assert.equal(source.name, "Live Player");

  const seed = createSeedLockedRatingSnapshot({
    competitionId: FIXTURE_TOURNAMENT_ID,
    subjectKind: "entry",
    subjectId: singlesEntry.id,
    rating: 4.5,
    lockedAt: "2026-07-01T00:00:00.000Z",
    marker: COMPETITION_LIFECYCLE_MARKER.SEED_LOCKED,
  });
  assert.equal(seed.marker, "SEED_LOCKED");
  const liveRatingAfter = 4.9;
  assert.notEqual(liveRatingAfter, seed.rating);
  assert.equal(seed.rating, 4.5);

  const mapped = mapIndividualEntry(singlesEntry, {
    playerById: individualPlayers,
    seedLocked: true,
    seedLockedAt: "2026-07-01T00:00:00.000Z",
  });
  assert.equal(mapped.value.seedLockedRating.rating, 4.5);
  assert.equal(mapped.value.entry.ratingSnapshot.displayName != null, true);
  assert.ok(mapped.value.entry.extensions);

  const incomplete = createMappingDiagnostic({
    code: MAPPING_DIAGNOSTIC_CODE.SNAPSHOT_INCOMPLETE,
    path: "snapshot",
    message: "Required snapshot fields missing",
    severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
    sourceType: "IndividualEntry",
    sourceId: "x",
  });
  assert.equal(incomplete.code, "SNAPSHOT_INCOMPLETE");
});

/* -------------------------------------------------------------------------- */
/* 8. No-loss                                                                 */
/* -------------------------------------------------------------------------- */

test("2B.4 no-loss semantic classifications for Team and Individual", () => {
  const teamBundle = mapTeamTournamentBundle(lockedRosterTeam, {
    competitionId: FIXTURE_COMPETITION_ID,
    playerById: teamPlayers,
    lineup: hiddenLineupRevision,
  });
  const teamRows = assessTeamBundleNoLoss(lockedRosterTeam, teamBundle.value, teamBundle);
  const teamSummary = summarizeNoLoss(teamRows);
  assert.equal(teamSummary.ok, true);
  assert.ok(teamRows.some((r) => r.classification === NO_LOSS_CLASSIFICATION.PRESERVED));
  assert.ok(
    teamRows.some((r) => r.classification === NO_LOSS_CLASSIFICATION.PRESERVED_IN_EXTENSION)
  );

  const ind = mapIndividualEntry(partnerInviteEntry, { playerById: individualPlayers });
  const indRows = assessIndividualEntryNoLoss(partnerInviteEntry, ind.value, ind);
  assert.equal(summarizeNoLoss(indRows).ok, true);

  const waitRows = assessIndividualEntryNoLoss(
    waitlistedEntry,
    mapIndividualEntry(waitlistedEntry, { playerById: individualPlayers }).value,
    { success: true }
  );
  assert.ok(waitRows.some((r) => r.classification === NO_LOSS_CLASSIFICATION.PRESERVED));
});

/* -------------------------------------------------------------------------- */
/* 9. Diagnostics                                                             */
/* -------------------------------------------------------------------------- */

test("2B.4 diagnostics: stable codes, severity, source metadata; no throw on business invalid", () => {
  const requiredCodes = [
    "MISSING_SOURCE_ID",
    "UNSUPPORTED_SOURCE_TYPE",
    "INVALID_IDENTITY_REFERENCE",
    "MISSING_COMPETITION_ID",
    "AMBIGUOUS_PERSON_ID",
    "UNRESOLVED_PLAYER_REFERENCE",
    "DUPLICATE_ACTIVE_ENTRY",
    "INVALID_ROSTER_STATE",
    "INVALID_LINEUP_REVISION",
    "MISSING_DIVISION_REFERENCE",
    "MISSING_CATEGORY_REFERENCE",
    "SNAPSHOT_INCOMPLETE",
    "UNSUPPORTED_FORMAT_POLICY",
  ];
  for (const code of requiredCodes) {
    assert.equal(MAPPING_DIAGNOSTIC_CODE[code], code);
    const d = createMappingDiagnostic({
      code: MAPPING_DIAGNOSTIC_CODE[code],
      path: "test",
      message: "human only",
      severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
      sourceType: "Fixture",
      sourceId: "id-1",
      metadata: { machine: code },
    });
    assert.equal(d.code, code);
    assert.notEqual(d.code, d.message);
    assert.equal(d.sourceType, "Fixture");
    assert.equal(d.sourceId, "id-1");
  }

  assert.doesNotThrow(() => mapIndividualEntry(missingCompetitionEntry));
  assert.doesNotThrow(() => mapTeamRosterToCompetitionRoster(duplicateMemberTeam));
  assert.doesNotThrow(() => mapTeamLineupToCompetitionLineup(invalidLineupRevision));
  assert.doesNotThrow(() => mapTeamLineupToCompetitionLineup(null));

  const missing = mapIndividualEntry(missingCompetitionEntry);
  assert.ok(missing.diagnostics.some((d) => d.code === MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID));
  const rosterDup = mapTeamRosterToCompetitionRoster(duplicateMemberTeam, {
    competitionId: FIXTURE_COMPETITION_ID,
  });
  assert.ok(rosterDup.diagnostics.some((d) => d.code === MAPPING_DIAGNOSTIC_CODE.INVALID_ROSTER_STATE));
  const badLineup = mapTeamLineupToCompetitionLineup(invalidLineupRevision);
  assert.ok(
    badLineup.diagnostics.some((d) => d.code === MAPPING_DIAGNOSTIC_CODE.INVALID_LINEUP_REVISION)
  );
});

/* -------------------------------------------------------------------------- */
/* 10. Shadow runner                                                          */
/* -------------------------------------------------------------------------- */

test("2B.4 shadow runner: no executor/persistence; batch multi-format; JSON-safe; no mutation", () => {
  const source = { ...singlesEntry };
  const before = cloneSourceSnapshot(source);
  let persist = 0;
  let exec = 0;

  const batch = runShadowMapping({
    source,
    hooks: {
      onPersistAttempt: () => {
        persist += 1;
      },
      onExecutorAttempt: () => {
        exec += 1;
      },
    },
    steps: [
      {
        name: "individual",
        map: (src) => mapIndividualEntry(src, { playerById: individualPlayers }),
      },
      {
        name: "forced-failure-then-continue",
        map: () => mapIndividualEntry(missingCompetitionEntry),
      },
      {
        name: "daily",
        map: () =>
          mapDailyPlayerToParticipant(dailyPlayers.member1, {
            competitionId: DAILY_SESSION_ID,
          }),
      },
    ],
  });

  assert.equal(batch.steps.length, 3);
  assert.equal(batch.steps[0].success, true);
  assert.equal(batch.steps[1].success, false);
  assert.equal(batch.steps[2].success, true);
  assert.equal(batch.ok, false);
  assert.equal(persist, 0);
  assert.equal(exec, 0);
  assert.equal(batch.persistenceWrites.attempted, false);
  assert.equal(batch.executorCalls.attempted, false);
  assert.equal(assertSourceUnchanged(before, source), true);
  assertJsonSafe(batch);

  assert.throws(
    () =>
      runShadowMapping({
        source,
        steps: [
          {
            name: "persist",
            map: (_s, ctx) => {
              ctx.hooks.attemptPersist();
              return mapIndividualEntry(source, { playerById: individualPlayers });
            },
          },
        ],
      }),
    /SHADOW_RUNNER_FORBIDS_PERSISTENCE/
  );

  // Shadow module must not import pages/executors
  const shadowFile = path.join(
    ROOT,
    "src/tournament/adapters/competition-core/shared/shadowRunner.js"
  );
  const shadowText = readFileSync(shadowFile, "utf8");
  assert.equal(/pages\/|engines\//.test(shadowText), false);
  assert.equal(/@supabase|localStorage|fetch\(/.test(shadowText), false);
});

/* -------------------------------------------------------------------------- */
/* 11. Repository ports                                                       */
/* -------------------------------------------------------------------------- */

test("2B.4 repository ports: shapes, in-memory save/load, revision-aware, no infra deps", () => {
  const portsFile = path.join(ROOT, "src/features/competition-core/participants/ports/index.js");
  const portsText = readFileSync(portsFile, "utf8");
  assert.equal(/supabase|SELECT |INSERT |localStorage|fetch\(/.test(portsText), false);
  assert.equal(/team-tournament|daily-play|mlp|dreambreaker/.test(portsText), false);

  const fake = createClosureInMemoryPorts();
  assert.equal(matchesRepositoryPortShape(fake.participant, PARTICIPANT_REPOSITORY_PORT_METHODS), true);
  assert.equal(matchesRepositoryPortShape(fake.entry, ENTRY_REPOSITORY_PORT_METHODS), true);
  assert.equal(
    matchesRepositoryPortShape(fake.registration, REGISTRATION_REPOSITORY_PORT_METHODS),
    true
  );
  assert.equal(matchesRepositoryPortShape(fake.team, TEAM_REPOSITORY_PORT_METHODS), true);
  assert.equal(matchesRepositoryPortShape(fake.roster, ROSTER_REPOSITORY_PORT_METHODS), true);
  assert.equal(matchesRepositoryPortShape(fake.lineup, LINEUP_REPOSITORY_PORT_METHODS), true);
  assert.equal(matchesRepositoryPortShape(fake.division, DIVISION_REPOSITORY_PORT_METHODS), true);
  assert.equal(matchesRepositoryPortShape(fake.category, CATEGORY_REPOSITORY_PORT_METHODS), true);

  return (async () => {
    const mapped = mapIndividualEntry(singlesEntry, { playerById: individualPlayers });
    await fake.participant.save(
      mapIndividualPlayerToParticipant(individualPlayers.s1, {
        competitionId: FIXTURE_TOURNAMENT_ID,
      }).value
    );
    await fake.entry.save(mapped.value.entry);
    await fake.registration.save(mapped.value.registration);
    const loaded = await fake.entry.getById(singlesEntry.id);
    assert.equal(loaded.id, singlesEntry.id);

    const team = mapTeamToCompetitionTeam(validTeam4, { competitionId: FIXTURE_COMPETITION_ID });
    const roster = mapTeamRosterToCompetitionRoster(validTeam4, {
      competitionId: FIXTURE_COMPETITION_ID,
      playerById: teamPlayers,
    });
    const lineup = mapTeamLineupToCompetitionLineup(hiddenLineupRevision, {
      competitionId: FIXTURE_COMPETITION_ID,
    });
    await fake.team.save(team.value);
    await fake.roster.saveRevision(roster.value);
    await fake.lineup.save(lineup.value);
    for (const rev of lineup.value.revisions) {
      await fake.lineup.saveRevision(rev);
    }
    assert.equal((await fake.roster.listRevisions(roster.value.id)).length, 1);
    assert.ok((await fake.lineup.listRevisions(lineup.value.id)).length >= 2);

    const classification = mapIndividualClassification(classificationFixture, {
      competitionId: FIXTURE_TOURNAMENT_ID,
    });
    await fake.division.save(classification.value.division);
    await fake.category.save(classification.value.category);
    assert.equal((await fake.division.getById("div-a")).name, "Bảng A");
  })();
});

/* -------------------------------------------------------------------------- */
/* 12. Public API                                                             */
/* -------------------------------------------------------------------------- */

test("2B.4 public API exports contracts/validators/DTOs/ports; adapters use barrel only", () => {
  const required = [
    "createCompetitionParticipant",
    "createCompetitionEntry",
    "createCompetitionRegistration",
    "createCompetitionTeam",
    "createCompetitionRoster",
    "createCompetitionLineup",
    "createCompetitionDivision",
    "createCompetitionCategory",
    "validateCompetitionParticipant",
    "validateCompetitionEntry",
    "validateCompetitionRoster",
    "validateCompetitionLineup",
    "createParticipantDTOv1",
    "createEntryDTOv1",
    "createRosterDTOv1",
    "createLineupDTOv1",
    "PARTICIPANT_REPOSITORY_PORT_METHODS",
    "ENTRY_REPOSITORY_PORT_METHODS",
    "ROSTER_REPOSITORY_PORT_METHODS",
    "LINEUP_REPOSITORY_PORT_METHODS",
    "matchesRepositoryPortShape",
  ];
  for (const name of required) {
    assert.equal(name in CompetitionCore, true, `missing export ${name}`);
  }

  // Must not export test fixtures / format policy helpers as Core production API
  assert.equal("assessTeamBundleNoLoss" in CompetitionCore, false);
  assert.equal("createClosureInMemoryPorts" in CompetitionCore, false);
  assert.equal("HIDDEN_LINEUP_POLICY" in CompetitionCore, false);

  const adapterDirs = [
    path.join(ROOT, "src/features/team-tournament/adapters/competition-core"),
    path.join(ROOT, "src/features/individual-tournament/adapters/competition-core"),
    path.join(ROOT, "src/features/daily-play/adapters/competition-core"),
    path.join(ROOT, "src/tournament/adapters/competition-core"),
  ];
  const deepRe = /competition-core\/participants\//;
  for (const dir of adapterDirs) {
    for (const file of walkJsFiles(dir)) {
      const text = readFileSync(file, "utf8");
      assert.equal(deepRe.test(text), false, path.relative(ROOT, file));
    }
  }

  const coreDir = path.join(ROOT, "src/features/competition-core");
  const forbidden = /team-tournament\/adapters|individual-tournament\/adapters|daily-play\/adapters/;
  for (const file of walkJsFiles(coreDir)) {
    assert.equal(forbidden.test(readFileSync(file, "utf8")), false, path.relative(ROOT, file));
  }
});

/* -------------------------------------------------------------------------- */
/* Flags / closure                                                            */
/* -------------------------------------------------------------------------- */

test("2B.4 closure: Competition Core flags OFF; participant runtime inactive", () => {
  const flags = getCompetitionCoreFeatureFlags();
  assert.equal(flags.coreEnabled, false);
  assert.equal(flags.ratingV2Enabled, false);
  assert.equal(flags.drawV2Enabled, false);
});
