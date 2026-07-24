/**
 * E2E-05 — Public Competition Experience MVP targeted tests.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PUBLICATION_OPS_STATE,
  PUBLIC_ERROR_CODE,
  PUBLIC_FORBIDDEN_KEYS,
  PUBLIC_MATCH_STATUS,
  buildPublicCompetitionExperienceSections,
  createPublicCompetitionExperienceFacade,
  isPublicCompetitionExperienceError,
  snapshotInput,
} from "../src/features/competition-engine/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function baseQuery(overrides = {}) {
  return {
    tenantId: "tenant-1",
    competitionId: "comp-e2e05",
    ...overrides,
  };
}

function publishedSnapshot(overrides = {}) {
  return {
    tenantId: "tenant-1",
    competitionId: "comp-e2e05",
    venueId: "venue-a",
    venueName: "Arena A",
    publicTitle: "Open Pool Knockout",
    branding: {
      publicTitle: "Open Pool Knockout",
      primaryColor: "#0A7",
      logoRef: "logo://open",
      email: "secret@internal.test",
    },
    dates: {
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      timezone: "Asia/Ho_Chi_Minh",
    },
    timezone: "Asia/Ho_Chi_Minh",
    divisions: [{ divisionId: "div-md", label: "Men Doubles" }],
    templateId: "individual-pool-knockout",
    publicationState: PUBLICATION_OPS_STATE.OPERATIONAL_PLAN_PUBLISHED,
    entries: [
      {
        participantId: "p1",
        displayName: "Alpha",
        status: "ELIGIBLE",
        publicVisible: true,
      },
      {
        participantId: "p2",
        displayName: "Bravo",
        status: "ELIGIBLE",
        publicVisible: true,
      },
      {
        participantId: "p-private",
        displayName: "Hidden",
        status: "ELIGIBLE",
        publicVisible: false,
        email: "hidden@example.com",
      },
    ],
    schedule: {
      fingerprint: "sched-fp-1",
      timezone: "Asia/Ho_Chi_Minh",
      matches: [
        {
          matchId: "m2",
          scheduledTime: "2026-08-01T10:00:00+07:00",
          courtId: "c2",
          courtName: "Court 2",
          venueId: "venue-a",
          status: "READY",
          participantIds: ["p1", "p2"],
          concurrencyDiagnostics: { peak: 9 },
        },
        {
          matchId: "m1",
          scheduledTime: "2026-08-01T09:00:00+07:00",
          courtId: "c1",
          courtName: "Court 1",
          venueId: "venue-a",
          status: "DELAYED",
          participantIds: ["p1", "p2"],
        },
      ],
    },
    courts: [
      { courtId: "c2", courtName: "Court 2", venueId: "venue-a" },
      { courtId: "c1", courtName: "Court 1", venueId: "venue-a" },
    ],
    pools: {
      fingerprint: "pool-fp-1",
      groups: [
        {
          groupId: "gB",
          groupLabel: "Group B",
          participantIds: ["p2"],
        },
        {
          groupId: "gA",
          groupLabel: "Group A",
          participantIds: ["p1"],
        },
      ],
    },
    matches: [
      {
        matchId: "m1",
        stage: "POOL",
        round: "R1",
        scheduledTime: "2026-08-01T09:00:00+07:00",
        status: "DELAYED",
        participantIds: ["p1", "p2"],
        venueId: "venue-a",
        courtId: "c1",
        courtName: "Court 1",
        scoreAccepted: false,
        score: { home: 5, away: 3 },
        refereeEmail: "ref@internal.test",
      },
      {
        matchId: "m2",
        stage: "POOL",
        round: "R1",
        scheduledTime: "2026-08-01T10:00:00+07:00",
        status: "COMPLETED",
        participantIds: ["p1", "p2"],
        venueId: "venue-a",
        courtId: "c2",
        scoreAccepted: true,
        scorePublished: true,
        score: { home: 11, away: 7 },
        validatedResult: {
          accepted: true,
          score: "11-7",
          winnerParticipantId: "p1",
        },
        nextMatchId: "m3",
      },
      {
        matchId: "m3",
        stage: "POOL",
        status: "SUSPENDED",
        scheduledTime: "2026-08-01T11:00:00+07:00",
        participantIds: ["p1", "p2"],
      },
      {
        matchId: "m4",
        stage: "POOL",
        status: "CANCELLED",
        scheduledTime: "2026-08-01T12:00:00+07:00",
        participantIds: ["p1", "p2"],
      },
    ],
    standings: {
      fingerprint: "stand-fp-1",
      unresolvedTie: false,
      tieBreakExplanation: "Head-to-head then point differential",
      rows: [
        {
          participantId: "p2",
          displayName: "Bravo",
          groupId: "gA",
          rank: 2,
          played: 1,
          wins: 0,
          losses: 1,
          points: 0,
        },
        {
          participantId: "p1",
          displayName: "Alpha",
          groupId: "gA",
          rank: 1,
          played: 1,
          wins: 1,
          losses: 0,
          points: 3,
        },
      ],
    },
    qualification: {
      fingerprint: "qual-fp-1",
      unresolvedTie: false,
      qualifiers: [
        {
          participantId: "p1",
          displayName: "Alpha",
          groupId: "gA",
          seedSlot: 1,
          status: "QUALIFIED",
        },
      ],
    },
    bracket: {
      fingerprint: "ko-fp-1",
      rounds: [{ roundId: "SF", roundLabel: "Semi-Final", status: "PENDING" }],
      slots: [
        {
          slotId: "sf-1",
          roundId: "SF",
          position: 1,
          participantId: "p1",
          displayName: "Alpha",
          isBye: false,
          isPlaceholder: false,
        },
        {
          slotId: "sf-2",
          roundId: "SF",
          position: 2,
          participantId: null,
          isPlaceholder: true,
        },
      ],
      champion: { participantId: "p1", displayName: "Alpha" },
    },
    finalResults: {
      fingerprint: "final-fp-1",
      ranking: [
        {
          participantId: "p1",
          displayName: "Alpha",
          placement: 1,
          award: "GOLD",
        },
      ],
      awards: [
        {
          awardId: "gold",
          label: "Gold",
          participantId: "p1",
          displayName: "Alpha",
        },
      ],
    },
    archive: {
      status: "ARCHIVED",
      visible: true,
      archivedAt: "2026-08-10T00:00:00.000Z",
    },
    diagnostics: { capacityDiagnostics: { overload: true } },
    ...overrides,
  };
}

function createFacadeWithPublished(snapshotOverrides = {}) {
  const facade = createPublicCompetitionExperienceFacade({
    clockIso: "2026-07-24T12:00:00.000Z",
  });
  facade.putPublishedCompetitionSnapshot({
    ...baseQuery(),
    snapshot: publishedSnapshot(snapshotOverrides),
  });
  return facade;
}

function assertNoForbiddenKeys(value, pathLabel = "$") {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoForbiddenKeys(item, `${pathLabel}[${i}]`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(
      PUBLIC_FORBIDDEN_KEYS.includes(key),
      false,
      `Forbidden key leaked at ${pathLabel}.${key}`
    );
    assertNoForbiddenKeys(child, `${pathLabel}.${key}`);
  }
}

test("publication — unpublished competition hidden / fail-closed", async () => {
  const facade = createFacadeWithPublished({
    publicationState: PUBLICATION_OPS_STATE.NONE,
  });
  await assert.rejects(
    () => facade.getPublicCompetitionOverview(baseQuery()),
    (err) =>
      isPublicCompetitionExperienceError(err) &&
      err.code === PUBLIC_ERROR_CODE.COMPETITION_UNPUBLISHED
  );
});

test("publication — draft/unpublished schedule hidden", async () => {
  const facade = createFacadeWithPublished({
    visibility: {
      competitionPublished: true,
      schedulePublished: false,
      participantsVisible: true,
      resultsPublished: false,
      bracketPublished: false,
      finalResultsPublished: false,
      archiveVisible: false,
    },
  });
  await assert.rejects(
    () => facade.getPublicSchedule(baseQuery()),
    (err) =>
      isPublicCompetitionExperienceError(err) &&
      err.code === PUBLIC_ERROR_CODE.SCHEDULE_UNPUBLISHED
  );
});

test("privacy — private participant hidden; public participant visible; internal fields excluded", async () => {
  const facade = createFacadeWithPublished();
  const res = await facade.getPublicParticipants(baseQuery());
  assert.equal(res.ok, true);
  const ids = res.result.participants.map((p) => p.participantId);
  assert.deepEqual(ids, ["p1", "p2"]);
  assert.equal(ids.includes("p-private"), false);
  assertNoForbiddenKeys(res.result);
  assert.equal("email" in (res.result.participants[0] || {}), false);
});

test("privacy — unpublished result hidden; accepted/published result visible", async () => {
  const facadeOps = createFacadeWithPublished();
  await assert.rejects(
    () => facadeOps.getPublicStandings(baseQuery()),
    (err) =>
      isPublicCompetitionExperienceError(err) &&
      err.code === PUBLIC_ERROR_CODE.RESULTS_UNPUBLISHED
  );

  const facadeFinal = createFacadeWithPublished({
    publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
  });
  const standings = await facadeFinal.getPublicStandings(baseQuery());
  assert.equal(standings.result.available, true);
  assert.equal(standings.result.computedLocally, false);
  assert.equal(standings.result.rows[0].participantId, "p1");

  const matchCenter = await facadeFinal.getPublicMatchCenter(baseQuery());
  const m1 = matchCenter.result.matches.find((m) => m.matchId === "m1");
  const m2 = matchCenter.result.matches.find((m) => m.matchId === "m2");
  assert.equal(m1.score, null);
  assert.ok(m2.score);
  assert.equal(m2.validatedResult.accepted, true);
  assertNoForbiddenKeys(matchCenter.result);
  assert.equal(
    JSON.stringify(matchCenter.result).includes("ref@internal.test"),
    false
  );
});

test("privacy — archive visibility gated", async () => {
  const facadeHidden = createFacadeWithPublished({
    publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
    visibility: {
      competitionPublished: true,
      schedulePublished: true,
      participantsVisible: true,
      resultsPublished: true,
      bracketPublished: true,
      finalResultsPublished: true,
      archiveVisible: false,
    },
  });
  await assert.rejects(
    () => facadeHidden.getPublicArchiveState(baseQuery()),
    (err) =>
      isPublicCompetitionExperienceError(err) &&
      err.code === PUBLIC_ERROR_CODE.ARCHIVE_HIDDEN
  );

  const facadeVisible = createFacadeWithPublished({
    publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
    visibility: {
      competitionPublished: true,
      schedulePublished: true,
      participantsVisible: true,
      resultsPublished: true,
      bracketPublished: true,
      finalResultsPublished: true,
      archiveVisible: true,
    },
  });
  const archive = await facadeVisible.getPublicArchiveState(baseQuery());
  assert.equal(archive.result.visible, true);
  assert.equal(archive.result.status, "ARCHIVED");
});

test("privacy — cross-tenant competition rejection", async () => {
  const facadeEmpty = createPublicCompetitionExperienceFacade({
    clockIso: "2026-07-24T12:00:00.000Z",
  });
  await assert.rejects(
    () =>
      facadeEmpty.getPublicCompetitionOverview({
        tenantId: "tenant-1",
        competitionId: "comp-e2e05",
        publishedRecord: {
          tenantId: "tenant-other",
          competitionId: "comp-e2e05",
          publicationState: PUBLICATION_OPS_STATE.OPERATIONAL_PLAN_PUBLISHED,
          visibility: {
            competitionPublished: true,
            schedulePublished: true,
            participantsVisible: true,
            resultsPublished: false,
            bracketPublished: false,
            finalResultsPublished: false,
            archiveVisible: false,
          },
        },
      }),
    (err) =>
      isPublicCompetitionExperienceError(err) &&
      err.code === PUBLIC_ERROR_CODE.CROSS_TENANT_REJECTED
  );

  const facade = createFacadeWithPublished();
  await assert.rejects(
    () =>
      facade.getPublicCompetitionOverview(
        baseQuery({ tenantId: "tenant-other" })
      ),
    (err) =>
      isPublicCompetitionExperienceError(err) &&
      err.code === PUBLIC_ERROR_CODE.RECORD_NOT_FOUND
  );
});

test("schedule — published certified order/timezone; states; no diagnostics leak", async () => {
  const facade = createFacadeWithPublished();
  const query = baseQuery();
  const before = snapshotInput(query);
  const res = await facade.getPublicSchedule(query);
  assert.deepEqual(query, before);
  assert.equal(res.result.timezone, "Asia/Ho_Chi_Minh");
  assert.deepEqual(
    res.result.matches.map((m) => m.matchId),
    ["m1", "m2"]
  );
  assert.equal(res.result.matches[0].status, PUBLIC_MATCH_STATUS.DELAYED);
  assert.equal(res.result.matches[1].status, PUBLIC_MATCH_STATUS.SCHEDULED);
  assert.deepEqual(
    res.result.courts.map((c) => c.courtId),
    ["c1", "c2"]
  );
  assert.equal(res.result.certifiedFingerprint, "sched-fp-1");
  assertNoForbiddenKeys(res.result);
  assert.equal(
    JSON.stringify(res.result).includes("concurrencyDiagnostics"),
    false
  );

  const again = await facade.getPublicSchedule(query);
  assert.equal(res.fingerprint, again.fingerprint);
  assert.equal(
    res.result.projectionFingerprint,
    again.result.projectionFingerprint
  );
});

test("pools/standings/qualification — published groups; unresolved tie preserved; no local compute", async () => {
  const facade = createFacadeWithPublished({
    publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
  });
  const pools = await facade.getPublicPools(baseQuery());
  assert.deepEqual(
    pools.result.groups.map((g) => g.groupId),
    ["gA", "gB"]
  );

  const standings = await facade.getPublicStandings(baseQuery());
  assert.equal(standings.result.computedLocally, false);
  assert.equal(
    standings.result.tieBreakExplanation,
    "Head-to-head then point differential"
  );

  const facadeTie = createFacadeWithPublished({
    publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
    unresolvedTie: true,
    qualification: {
      unresolvedTie: true,
      qualifiers: [
        {
          participantId: "p1",
          displayName: "Alpha",
          seedSlot: 1,
          status: "QUALIFIED",
        },
      ],
    },
  });
  const qualification = await facadeTie.getPublicQualification(baseQuery());
  assert.equal(qualification.result.unresolvedTie, true);
  assert.deepEqual(qualification.result.qualifiers, []);
  assert.equal(qualification.result.pendingReason, "UNRESOLVED_TIE");
});

test("bracket — canonical slots/placeholders; no winner inference; champion only when final published", async () => {
  const facadeOps = createFacadeWithPublished({
    publicationState: PUBLICATION_OPS_STATE.OPERATIONAL_PLAN_PUBLISHED,
  });
  await assert.rejects(
    () => facadeOps.getPublicBracket(baseQuery()),
    (err) =>
      isPublicCompetitionExperienceError(err) &&
      err.code === PUBLIC_ERROR_CODE.BRACKET_UNPUBLISHED
  );

  const facadeFinal = createFacadeWithPublished({
    publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
  });
  const bracket = await facadeFinal.getPublicBracket(baseQuery());
  assert.equal(bracket.result.inferredWinners, false);
  assert.equal(bracket.result.slots.length, 2);
  assert.equal(bracket.result.slots[1].isPlaceholder, true);
  assert.equal(bracket.result.champion.participantId, "p1");
});

test("match center — statuses, score policy, fingerprint, no referee private data", async () => {
  const facade = createFacadeWithPublished({
    publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
  });
  const res = await facade.getPublicMatchCenter(baseQuery());
  assert.equal(res.result.realtimeEnabled, false);
  const byId = Object.fromEntries(
    res.result.matches.map((m) => [m.matchId, m])
  );
  assert.equal(byId.m1.status, PUBLIC_MATCH_STATUS.DELAYED);
  assert.equal(byId.m2.status, PUBLIC_MATCH_STATUS.COMPLETED);
  assert.equal(byId.m3.status, PUBLIC_MATCH_STATUS.SUSPENDED);
  assert.equal(byId.m4.status, PUBLIC_MATCH_STATUS.CANCELLED);
  assert.equal(byId.m2.nextMatchId, "m3");
  assert.ok(res.result.projectionFingerprint.startsWith("e2e05-match-center:"));
  assertNoForbiddenKeys(res.result);
});

test("architecture — no Supabase / no parallel engines / presentation sections", async () => {
  const publicRoot = path.join(
    ROOT,
    "src/features/competition-engine/operations/public"
  );
  const files = [
    "createPublicCompetitionExperienceFacade.js",
    "projections/buildPublicCompetitionProjection.js",
    "gates/publicationPrivacyGates.js",
    "adapters/projectPublishedRecordFromOrganizer.js",
  ];
  for (const rel of files) {
    const src = readFileSync(path.join(publicRoot, rel), "utf8");
    assert.equal(src.includes("from \"@supabase"), false);
    assert.equal(src.includes("from '@supabase"), false);
    assert.equal(src.includes("Date.now("), false);
    assert.equal(src.includes("Math.random("), false);
    assert.equal(src.includes("randomUUID"), false);
    assert.equal(src.includes("calculateCanonicalStandings"), false);
    assert.equal(src.includes("composeKnockoutStage"), false);
    assert.equal(src.includes("calculateCanonicalSchedule"), false);
  }

  // Must not import E2E-04 player/referee ownership paths.
  const facadeSrc = readFileSync(
    path.join(publicRoot, "createPublicCompetitionExperienceFacade.js"),
    "utf8"
  );
  assert.equal(facadeSrc.includes("operations/player"), false);
  assert.equal(facadeSrc.includes("operations/referee"), false);

  const facade = createFacadeWithPublished({
    publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
    visibility: {
      competitionPublished: true,
      schedulePublished: true,
      participantsVisible: true,
      resultsPublished: true,
      bracketPublished: true,
      finalResultsPublished: true,
      archiveVisible: true,
    },
  });
  const experience = await facade.getPublicCompetitionExperience(baseQuery());
  const sections = buildPublicCompetitionExperienceSections(experience.result);
  assert.equal(sections.length, 10);
  assert.equal(sections.every((s) => typeof s.id === "string"), true);
  assert.ok(experience.result.experienceFingerprint);
});

test("overview + final results happy path", async () => {
  const facade = createFacadeWithPublished({
    publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
  });
  const overview = await facade.getPublicCompetitionOverview(baseQuery());
  assert.equal(overview.result.publicTitle, "Open Pool Knockout");
  assert.equal(overview.result.venue.venueId, "venue-a");
  assertNoForbiddenKeys(overview.result);
  assert.equal("email" in (overview.result.branding || {}), false);

  const finals = await facade.getPublicFinalResults(baseQuery());
  assert.equal(finals.result.ranking[0].placement, 1);
  assert.equal(finals.result.awards[0].awardId, "gold");
});
