import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PARTICIPANT_REFERENCE_KIND,
  COMPETITION_ROSTER_STATUS,
  COMPETITION_REGISTRATION_STATUS,
  COMPETITION_ENTRY_STATUS,
  validateCompetitionParticipant,
  validateCompetitionTeam,
  validateCompetitionRoster,
  validateCompetitionLineup,
  validateCompetitionEntry,
  validateCompetitionRegistration,
  getCompetitionCoreFeatureFlags,
} from "../src/features/competition-core/index.js";

import {
  mapTeamPlayerToParticipant,
  mapTeamToCompetitionTeam,
  mapTeamRosterToCompetitionRoster,
  mapTeamLineupToCompetitionLineup,
  mapTeamRegistration,
  mapTeamTournamentBundle,
  compareTeamParity,
  compareRosterParity,
  compareLineupParity,
} from "../src/features/team-tournament/adapters/competition-core/index.js";

import {
  mapIndividualPlayerToParticipant,
  mapIndividualEntry,
  mapIndividualClassification,
  compareIndividualEntryParity,
} from "../src/features/individual-tournament/adapters/competition-core/index.js";

import {
  mapDailyPlayerToParticipant,
  mapDailySessionParticipants,
  mapDailyTemporaryPair,
  compareDailyPlayerParity,
} from "../src/features/daily-play/adapters/competition-core/index.js";

import {
  mapInternalMemberRegistration,
  mapOfficialOpenRegistration,
  mapInternalOfficialEvidenceBundle,
  compareInternalOfficialParity,
  runShadowMapping,
  runSingleShadowMap,
  MAPPING_DIAGNOSTIC_CODE,
  PARITY_CLASSIFICATION,
  assertSourceUnchanged,
  cloneSourceSnapshot,
} from "../src/tournament/adapters/competition-core/index.js";

import {
  FIXTURE_COMPETITION_ID,
  teamPlayers,
  validTeam4,
  lockedRosterTeam,
  guestRosterTeam,
  duplicateMemberTeam,
  substitutionRef,
  hiddenLineupRevision,
  invalidLineupRevision,
  teamWaitlistRegistration,
} from "./fixtures/competition-core-2b3/teamTournament.js";

import {
  FIXTURE_TOURNAMENT_ID,
  individualPlayers,
  individualPlayersByAlias,
  singlesEntry,
  doublesEntry,
  partnerInviteEntry,
  guestEntry,
  multiDivisionEntries,
  waitlistedEntry,
  missingCompetitionEntry,
  classificationFixture,
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
  internalClassification,
  officialClassification,
} from "./fixtures/competition-core-2b3/internalOfficial.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  assert.equal(JSON.parse(JSON.stringify(value)) != null || value === null, true);
  assert.doesNotThrow(() => JSON.stringify(value));
}

test("Team adapter: valid 4-player team + captain + roster", () => {
  const before = cloneSourceSnapshot(validTeam4);
  const teamResult = mapTeamToCompetitionTeam(validTeam4, {
    competitionId: FIXTURE_COMPETITION_ID,
  });
  const rosterResult = mapTeamRosterToCompetitionRoster(validTeam4, {
    competitionId: FIXTURE_COMPETITION_ID,
    playerById: teamPlayers,
  });

  assert.equal(teamResult.success, true);
  assert.equal(rosterResult.success, true);
  assert.equal(validateCompetitionTeam(teamResult.value).valid, true);
  assert.equal(validateCompetitionRoster(rosterResult.value).valid, true);
  assert.equal(teamResult.value.captainRef.id, "p1");
  assert.equal(rosterResult.value.members.length, 4);
  assert.equal(
    rosterResult.value.members.find((m) => m.role === "captain")?.person.id,
    "p1"
  );
  assert.equal(assertSourceUnchanged(before, validTeam4), true);
  assertJsonSafe(teamResult);
  assertJsonSafe(rosterResult);
});

test("Team adapter: locked roster preserved (OD-04)", () => {
  const result = mapTeamRosterToCompetitionRoster(lockedRosterTeam, {
    competitionId: FIXTURE_COMPETITION_ID,
    playerById: teamPlayers,
  });
  assert.equal(result.success, true);
  assert.equal(result.value.status, COMPETITION_ROSTER_STATUS.ROSTER_LOCKED);
  assert.equal(result.value.lockedAt, lockedRosterTeam.lockedAt);
  const findings = compareRosterParity(lockedRosterTeam, result);
  assert.ok(findings.some((f) => f.classification === PARITY_CLASSIFICATION.SEMANTIC_MATCH));
});

test("Team adapter: guest roster member (OD-01)", () => {
  const playerResult = mapTeamPlayerToParticipant(teamPlayers.guest1, {
    competitionId: FIXTURE_COMPETITION_ID,
  });
  assert.equal(playerResult.success, true);
  assert.equal(playerResult.value.person.kind, PARTICIPANT_REFERENCE_KIND.GUEST);
  assert.equal(validateCompetitionParticipant(playerResult.value).valid, true);

  const roster = mapTeamRosterToCompetitionRoster(guestRosterTeam, {
    competitionId: FIXTURE_COMPETITION_ID,
    playerById: teamPlayers,
  });
  assert.equal(roster.success, true);
  const guestMember = roster.value.members.find((m) => m.person.id === "guest1");
  assert.equal(guestMember.person.kind, PARTICIPANT_REFERENCE_KIND.GUEST);
});

test("Team adapter: substitution reference preserved (OD-05)", () => {
  const result = mapTeamRosterToCompetitionRoster(
    { ...validTeam4, substitutions: [substitutionRef] },
    { competitionId: FIXTURE_COMPETITION_ID, playerById: teamPlayers }
  );
  assert.equal(result.success, true);
  assert.equal(result.value.amendments.length, 1);
  assert.equal(result.value.amendments[0].replaced.id, "p4");
  assert.equal(result.value.amendments[0].replacement.id, "guest1");
});

test("Team adapter: duplicate member diagnostic", () => {
  const result = mapTeamRosterToCompetitionRoster(duplicateMemberTeam, {
    competitionId: FIXTURE_COMPETITION_ID,
  });
  assert.equal(result.success, false);
  assert.ok(
    result.diagnostics.some((d) => d.code === MAPPING_DIAGNOSTIC_CODE.INVALID_ROSTER_STATE)
  );
});

test("Team adapter: lineup revisions not collapsed (OD-06) + hidden policy extension", () => {
  const before = cloneSourceSnapshot(hiddenLineupRevision);
  const result = mapTeamLineupToCompetitionLineup(hiddenLineupRevision, {
    competitionId: FIXTURE_COMPETITION_ID,
  });
  assert.equal(result.success, true);
  assert.equal(validateCompetitionLineup(result.value).valid, true);
  assert.ok(result.value.revisions.length >= 2);
  const revNums = result.value.revisions.map((r) => r.revision).sort((a, b) => a - b);
  assert.deepEqual(revNums, [1, 2]);
  assert.equal(
    result.value.extensions.payload.hiddenLineupPolicyRef,
    "team-tournament:getVisibleLineup"
  );
  assert.equal(assertSourceUnchanged(before, hiddenLineupRevision), true);
  const findings = compareLineupParity(hiddenLineupRevision, result);
  assert.ok(
    findings.some((f) => f.classification === PARITY_CLASSIFICATION.EXPECTED_FORMAT_EXTENSION)
  );
});

test("Team adapter: invalid lineup revision diagnostics", () => {
  const result = mapTeamLineupToCompetitionLineup(invalidLineupRevision);
  assert.equal(result.success, false);
  assert.ok(
    result.diagnostics.some((d) => d.code === MAPPING_DIAGNOSTIC_CODE.INVALID_LINEUP_REVISION)
  );
});

test("Team adapter: waitlist registration does not create active entry (OD-10)", () => {
  const result = mapTeamRegistration(teamWaitlistRegistration, {
    competitionId: FIXTURE_COMPETITION_ID,
  });
  assert.equal(result.success, true);
  assert.equal(result.value.registration.status, COMPETITION_REGISTRATION_STATUS.WAITLISTED);
  assert.equal(result.value.entry, null);
  assert.equal(validateCompetitionRegistration(result.value.registration).valid, true);
});

test("Team adapter: format extensions preserve TT-specific fields", () => {
  const result = mapTeamTournamentBundle(validTeam4, {
    competitionId: FIXTURE_COMPETITION_ID,
    playerById: teamPlayers,
    lineup: hiddenLineupRevision,
  });
  assert.equal(result.success, true);
  assert.equal(result.value.team.extensions.formatKey, "team-tournament-v6");
  assert.ok(Array.isArray(result.value.team.extensions.payload.playerIds));
  const teamFindings = compareTeamParity(validTeam4, {
    success: true,
    value: result.value.team,
  });
  assert.ok(teamFindings.some((f) => f.classification === PARITY_CLASSIFICATION.EXACT));
});

test("Individual adapter: singles + doubles + partner invite", () => {
  const singles = mapIndividualEntry(singlesEntry, { playerById: individualPlayers });
  const doubles = mapIndividualEntry(doublesEntry, { playerById: individualPlayers });
  const invite = mapIndividualEntry(partnerInviteEntry, { playerById: individualPlayers });

  assert.equal(singles.success, true);
  assert.equal(singles.value.entry.entryRole, "singles");
  assert.equal(validateCompetitionEntry(singles.value.entry).valid, true);

  assert.equal(doubles.success, true);
  assert.equal(doubles.value.entry.entryRole, "doubles");
  assert.equal(doubles.value.entry.memberRefs.length, 2);

  assert.equal(invite.success, true);
  assert.equal(invite.value.entry.extensions.payload.partnerInviteToken, "invite-token-fixture-abc");
});

test("Individual adapter: guest participant (OD-01)", () => {
  const player = mapIndividualPlayerToParticipant(individualPlayersByAlias.guest, {
    competitionId: FIXTURE_TOURNAMENT_ID,
  });
  assert.equal(player.success, true);
  assert.equal(player.value.person.kind, PARTICIPANT_REFERENCE_KIND.GUEST);

  const entry = mapIndividualEntry(guestEntry, { playerById: individualPlayers });
  assert.equal(entry.success, true);
  assert.equal(entry.value.entry.memberRefs[0].kind, PARTICIPANT_REFERENCE_KIND.GUEST);
});

test("Individual adapter: multiple divisions not merged (OD-02)", () => {
  const a = mapIndividualEntry(multiDivisionEntries[0], { playerById: individualPlayers });
  const b = mapIndividualEntry(multiDivisionEntries[1], {
    playerById: individualPlayers,
    siblingEntries: [multiDivisionEntries[0]],
  });
  assert.equal(a.success, true);
  assert.equal(b.success, true);
  assert.notEqual(a.value.entry.id, b.value.entry.id);
  assert.notEqual(a.value.entry.divisionId, b.value.entry.divisionId);
  // Different division scopes — no merge into one entry
  assert.equal(a.value.entry.memberRefs[0].id, b.value.entry.memberRefs[0].id);
});

test("Individual adapter: waitlist does not become active Entry (OD-10)", () => {
  const result = mapIndividualEntry(waitlistedEntry, { playerById: individualPlayers });
  assert.equal(result.success, true);
  assert.equal(result.value.registration.status, COMPETITION_REGISTRATION_STATUS.WAITLISTED);
  assert.equal(result.value.entry, null);
  const findings = compareIndividualEntryParity(waitlistedEntry, result);
  assert.ok(findings.some((f) => f.classification === PARITY_CLASSIFICATION.EXACT));
});

test("Individual adapter: missing competitionId diagnostic (OD-03)", () => {
  const result = mapIndividualEntry(missingCompetitionEntry);
  assert.equal(result.success, false);
  assert.ok(
    result.diagnostics.some((d) => d.code === MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID)
  );
});

test("Individual adapter: division and category remain separate (OD-07)", () => {
  const entry = mapIndividualEntry(singlesEntry, { playerById: individualPlayers });
  assert.equal(entry.value.entry.divisionId, "div-a");
  assert.equal(entry.value.entry.categoryId, "cat-ms");
  assert.notEqual(entry.value.entry.divisionId, entry.value.entry.categoryId);

  const classification = mapIndividualClassification(classificationFixture, {
    competitionId: FIXTURE_TOURNAMENT_ID,
  });
  assert.equal(classification.success, true);
  assert.ok(classification.value.division);
  assert.ok(classification.value.category);
  assert.notEqual(classification.value.division.id, classification.value.category.id);
});

test("Individual adapter: seed-locked snapshot (OD-08/OD-09)", () => {
  const result = mapIndividualEntry(singlesEntry, {
    playerById: individualPlayers,
    seedLocked: true,
    seedLockedAt: "2026-06-15T00:00:00.000Z",
  });
  assert.equal(result.success, true);
  assert.ok(result.value.entry.ratingSnapshot);
  assert.equal(result.value.seedLockedRating.rating, 4.5);
  assert.equal(result.value.seedLockedRating.marker, "SEED_LOCKED");
});

test("Daily adapter: registered / member / walk-in / external", () => {
  for (const key of ["member1", "registered", "walkin", "external"]) {
    const result = mapDailyPlayerToParticipant(dailyPlayers[key], {
      competitionId: DAILY_SESSION_ID,
      checkedIn: true,
      queueParticipant: true,
    });
    assert.equal(result.success, true, key);
    assert.equal(validateCompetitionParticipant(result.value).valid, true, key);
    assert.equal(result.value.extensions.payload.queuePolicyRef, "daily-play:checkedInPlayerIds");
    assertJsonSafe(result);
  }
  assert.equal(
    mapDailyPlayerToParticipant(dailyPlayers.walkin, { competitionId: DAILY_SESSION_ID }).value
      .person.kind,
    PARTICIPANT_REFERENCE_KIND.GUEST
  );
  assert.equal(
    mapDailyPlayerToParticipant(dailyPlayers.external, { competitionId: DAILY_SESSION_ID }).value
      .person.kind,
    PARTICIPANT_REFERENCE_KIND.EXTERNAL
  );
});

test("Daily adapter: session queue participants + no Entry", () => {
  const result = mapDailySessionParticipants(dailySession, { playerById: dailyPlayers });
  assert.equal(result.success, true);
  assert.equal(result.value.participants.length, 4);
  assert.equal(result.value.entry, null);
});

test("Daily adapter: temporary pair is not CompetitionTeam/Entry", () => {
  const result = mapDailyTemporaryPair(dailyTemporaryMatch, {
    competitionId: DAILY_SESSION_ID,
  });
  assert.equal(result.success, true);
  assert.equal(result.value.kind, "daily_temporary_pair");
  assert.equal(result.value.extensions.payload.notCompetitionTeam, true);
  assert.equal(result.value.extensions.payload.notCompetitionEntry, true);
  assert.equal(result.value.sideA.length, 2);
  assert.equal(result.value.sideB.length, 2);
  const findings = compareDailyPlayerParity(dailyPlayers.member1, {
    success: true,
    value: mapDailyPlayerToParticipant(dailyPlayers.member1, {
      competitionId: DAILY_SESSION_ID,
    }).value,
  });
  assert.ok(findings.some((f) => f.classification === PARITY_CLASSIFICATION.EXACT));
});

test("Internal/Official: mapping evidence for registration + division/category + seed", () => {
  const internal = mapInternalOfficialEvidenceBundle({
    formatKind: "internal",
    entry: internalMemberRegistration,
    player: { id: "ip1", name: "Internal P1", rating: 4.1, playerType: "member" },
    classification: internalClassification,
    context: { competitionId: INTERNAL_TOURNAMENT_ID, seedLocked: true },
  });
  assert.equal(internal.success, true);
  assert.equal(internal.value.formatKind, "internal");
  assert.equal(internal.value.entryMapping.entry.status, COMPETITION_ENTRY_STATUS.ACTIVE);
  assert.ok(internal.value.classification.division);
  assert.ok(internal.value.classification.category);

  const official = mapOfficialOpenRegistration(officialOpenRegistration, {
    competitionId: OFFICIAL_TOURNAMENT_ID,
    seedLocked: true,
    seedLockedAt: "2026-05-10T00:00:00.000Z",
    seedIdentity: "open-ai-balance",
  });
  assert.equal(official.success, true);
  assert.ok(official.value.seedLockedRating);
  assert.equal(official.value.seedLockedRating.rating, 4.4);

  const player = mapIndividualPlayerToParticipant(officialSeedPlayer, {
    competitionId: OFFICIAL_TOURNAMENT_ID,
    seedLocked: true,
  });
  assert.equal(player.success, true);
  assert.equal(player.value.snapshot.seedLocked, true);

  const classOfficial = mapIndividualClassification(officialClassification, {
    competitionId: OFFICIAL_TOURNAMENT_ID,
  });
  assert.equal(classOfficial.success, true);

  const findings = compareInternalOfficialParity(officialOpenRegistration, official);
  assert.ok(
    findings.some((f) => f.classification === PARITY_CLASSIFICATION.EXPECTED_FORMAT_EXTENSION)
  );
});

test("Internal member registration helper", () => {
  const result = mapInternalMemberRegistration(internalMemberRegistration, {
    competitionId: INTERNAL_TOURNAMENT_ID,
  });
  assert.equal(result.success, true);
  assert.equal(result.value.formatKind, "internal");
  assert.equal(result.value.registration.extensions.payload.btcDirectActive, true);
});

test("Shadow runner: does not call executor or persistence; no source mutation", () => {
  let persistAttempts = 0;
  let executorAttempts = 0;
  const source = { ...singlesEntry };
  const before = cloneSourceSnapshot(source);

  const report = runShadowMapping({
    source,
    hooks: {
      onPersistAttempt: () => {
        persistAttempts += 1;
      },
      onExecutorAttempt: () => {
        executorAttempts += 1;
      },
    },
    steps: [
      {
        name: "individual-entry",
        map: (src, ctx) => {
          // Ensure guarded hooks exist but are not used by happy path
          assert.equal(typeof ctx.hooks.attemptPersist, "function");
          assert.equal(typeof ctx.hooks.attemptExecutor, "function");
          return mapIndividualEntry(src, { playerById: individualPlayers });
        },
        compare: compareIndividualEntryParity,
      },
    ],
  });

  assert.equal(report.shadow, true);
  assert.equal(report.wiredToRuntime, false);
  assert.equal(report.ok, true);
  assert.equal(report.persistenceWrites.attempted, false);
  assert.equal(report.executorCalls.attempted, false);
  assert.equal(persistAttempts, 0);
  assert.equal(executorAttempts, 0);
  assert.equal(assertSourceUnchanged(before, source), true);

  assert.throws(
    () =>
      runSingleShadowMap({
        source: singlesEntry,
        map: (_src, ctx) => {
          ctx.hooks.attemptPersist();
          return mapIndividualEntry(singlesEntry);
        },
      }),
    /SHADOW_RUNNER_FORBIDS_PERSISTENCE/
  );

  assert.throws(
    () =>
      runSingleShadowMap({
        source: singlesEntry,
        map: (_src, ctx) => {
          ctx.hooks.attemptExecutor();
          return mapIndividualEntry(singlesEntry);
        },
      }),
    /SHADOW_RUNNER_FORBIDS_EXECUTOR/
  );
});

test("Shadow runner: team bundle parity classifications", () => {
  const report = runShadowMapping({
    source: validTeam4,
    steps: [
      {
        name: "team",
        map: (src) =>
          mapTeamToCompetitionTeam(src, { competitionId: FIXTURE_COMPETITION_ID }),
        compare: compareTeamParity,
      },
      {
        name: "roster",
        map: (src) =>
          mapTeamRosterToCompetitionRoster(src, {
            competitionId: FIXTURE_COMPETITION_ID,
            playerById: teamPlayers,
          }),
        compare: compareRosterParity,
      },
    ],
  });
  assert.equal(report.ok, true);
  assert.ok(report.findings.some((f) => f.classification === PARITY_CLASSIFICATION.EXACT));
  assert.ok(
    report.findings.some((f) => f.classification === PARITY_CLASSIFICATION.SEMANTIC_MATCH)
  );
});

test("Canonical validation after mapping succeeds for happy paths", () => {
  assert.equal(
    validateCompetitionParticipant(
      mapTeamPlayerToParticipant(teamPlayers.p1, { competitionId: FIXTURE_COMPETITION_ID }).value
    ).valid,
    true
  );
  assert.equal(
    validateCompetitionRegistration(
      mapIndividualEntry(singlesEntry, { playerById: individualPlayers }).value.registration
    ).valid,
    true
  );
});

test("Diagnostics expose stable codes (not message-as-id)", () => {
  const result = mapIndividualEntry(missingCompetitionEntry);
  for (const d of result.diagnostics) {
    assert.ok(Object.values(MAPPING_DIAGNOSTIC_CODE).includes(d.code));
    assert.ok(d.path !== undefined);
    assert.ok(d.message);
    assert.ok(d.severity);
    assert.ok("sourceType" in d);
    assert.ok("sourceId" in d);
    assert.ok("metadata" in d);
  }
});

test("Public API: adapters import competition-core barrel only (no deep participant imports)", () => {
  const adapterDirs = [
    path.join(ROOT, "src/features/team-tournament/adapters/competition-core"),
    path.join(ROOT, "src/features/individual-tournament/adapters/competition-core"),
    path.join(ROOT, "src/features/daily-play/adapters/competition-core"),
    path.join(ROOT, "src/tournament/adapters/competition-core"),
  ];

  const deepParticipantRe =
    /from\s+['"][^'"]*competition-core\/participants\//;
  const coreImportRe = /from\s+['"]([^'"]+)['"]/g;

  for (const dir of adapterDirs) {
    for (const file of walkJsFiles(dir)) {
      const text = readFileSync(file, "utf8");
      assert.equal(
        deepParticipantRe.test(text),
        false,
        `${path.relative(ROOT, file)} must not deep-import competition-core/participants`
      );

      let match;
      const importRe = new RegExp(coreImportRe.source, "g");
      while ((match = importRe.exec(text))) {
        const spec = match[1];
        if (spec.includes("competition-core") && !spec.includes("adapters/competition-core")) {
          assert.ok(
            /competition-core\/index\.js$/.test(spec) || /competition-core\/index\.js/.test(spec),
            `${path.relative(ROOT, file)} must import Core public API: got ${spec}`
          );
        }
      }
    }
  }
});

test("Architecture: competition-core does not import format adapters", () => {
  const coreDir = path.join(ROOT, "src/features/competition-core");
  const forbidden =
    /team-tournament\/adapters|individual-tournament\/adapters|daily-play\/adapters|tournament\/adapters\/competition-core/;
  for (const file of walkJsFiles(coreDir)) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      forbidden.test(text),
      false,
      `${path.relative(ROOT, file)} must not import format adapters`
    );
  }
});

test("Production flags remain OFF / participant runtime inactive", () => {
  const flags = getCompetitionCoreFeatureFlags();
  assert.equal(flags.coreEnabled, false);
  assert.equal(typeof mapTeamToCompetitionTeam, "function");
});
