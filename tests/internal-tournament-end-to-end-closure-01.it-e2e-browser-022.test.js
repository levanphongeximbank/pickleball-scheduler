/**
 * IT-E2E-BROWSER-022 — Internal Awards workspace + fail-closed completion.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  EVENT_TYPE,
  MATCH_STAGE,
  MATCH_STATUS,
  TOURNAMENT_MODE,
} from "../src/models/tournament/constants.js";
import {
  canonicalRowToTournament,
  tournamentToCanonicalRow,
} from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import {
  INTERNAL_AWARDS_CONFIRMATION_REQUIRED,
  INTERNAL_AWARDS_PERSISTENCE_PATH,
  INTERNAL_LIFECYCLE_STEPS,
  INTERNAL_WORKSPACE_SECTIONS,
  confirmInternalAwards,
  mapLifecycleStepToWorkspaceSection,
  projectInternalAwardsWorkspace,
  resolveInternalCompletionAction,
  resolveInternalTournamentLifecycle,
  resolveInternalWorkspaceSection,
} from "../src/features/tournament/internal/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function team(id, name, playerIds) {
  return { id, name, playerIds, rating: 7, seed: 1 };
}

function player(id, name) {
  return { id, name, playerIds: [id], rating: 7, seed: 1 };
}

function doneMatch({
  id,
  groupId = "",
  bracketMatchId = "",
  stage,
  entryAId,
  entryBId,
  scoreA,
  scoreB,
}) {
  const winnerId = scoreA > scoreB ? entryAId : entryBId;
  return {
    id,
    groupId,
    bracketMatchId,
    stage,
    entryAId,
    entryBId,
    status: MATCH_STATUS.COMPLETED,
    scoreA,
    scoreB,
    winnerId,
    loserId: winnerId === entryAId ? entryBId : entryAId,
  };
}

const A1 = team("a1", "IT421 Nam 05 / TT412-SEED-M01", ["p5", "m01"]);
const A2 = team("a2", "IT421 Nam 08 / TT412-SEED-M04", ["p8", "m04"]);
const B1 = team("b1", "IT421 Nam 06 / TT412-SEED-M02", ["p6", "m02"]);
const B2 = team("b2", "IT421 Nam 07 / TT412-SEED-M03", ["p7", "m03"]);

function makeFinalCompletedTournament({
  eventType = EVENT_TYPE.MEN_DOUBLE,
  entries = [A1, A2, B1, B2],
} = {}) {
  return {
    id: "d3a35fd1-5caf-4d18-86b4-5df0881c9dc3",
    name: "Giải nội bộ 14/8/2026",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: "active",
    clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
    tenantId: "venue-staging-a",
    settings: {},
    events: [
      {
        id: "event-022",
        type: eventType,
        eventType,
        entries,
        groups: [
          { id: "G1", label: "A", name: "Bảng A", entryIds: [entries[0].id, entries[1].id] },
          { id: "G2", label: "B", name: "Bảng B", entryIds: [entries[2].id, entries[3].id] },
        ],
        matches: [
          doneMatch({
            id: "GA-R1-M1",
            groupId: "G1",
            stage: "group",
            entryAId: entries[0].id,
            entryBId: entries[1].id,
            scoreA: 11,
            scoreB: 5,
          }),
          doneMatch({
            id: "GB-R1-M1",
            groupId: "G2",
            stage: "group",
            entryAId: entries[2].id,
            entryBId: entries[3].id,
            scoreA: 11,
            scoreB: 7,
          }),
          doneMatch({
            id: "ko-R1-M1",
            bracketMatchId: "R1-M1",
            stage: MATCH_STAGE.SEMIFINAL,
            entryAId: entries[0].id,
            entryBId: entries[3].id,
            scoreA: 15,
            scoreB: 10,
          }),
          doneMatch({
            id: "ko-R1-M2",
            bracketMatchId: "R1-M2",
            stage: MATCH_STAGE.SEMIFINAL,
            entryAId: entries[1].id,
            entryBId: entries[2].id,
            scoreA: 13,
            scoreB: 15,
          }),
          doneMatch({
            id: "ko-R2-M1",
            bracketMatchId: "R2-M1",
            stage: MATCH_STAGE.FINAL,
            entryAId: entries[0].id,
            entryBId: entries[2].id,
            scoreA: 15,
            scoreB: 11,
          }),
        ],
        bracket: {
          rounds: [
            { name: "Ban ket", matches: [{ id: "R1-M1" }, { id: "R1-M2" }] },
            { name: "Chung ket", matches: [{ id: "R2-M1" }] },
          ],
          winnersByMatch: {},
        },
      },
    ],
  };
}

function makeOneGroupTournament() {
  const p1 = player("p1", "IT421 Nam 05");
  const p2 = player("p2", "IT421 Nam 06");
  const p3 = player("p3", "IT421 Nam 07");
  return {
    id: "one-group-022",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: "active",
    settings: {},
    events: [
      {
        id: "event-og",
        type: EVENT_TYPE.MEN_SINGLE,
        eventType: EVENT_TYPE.MEN_SINGLE,
        entries: [p1, p2, p3],
        groups: [{ id: "G1", label: "A", name: "Bảng A", entryIds: [p1.id, p2.id, p3.id] }],
        matches: [
          doneMatch({
            id: "g1",
            groupId: "G1",
            stage: "group",
            entryAId: p1.id,
            entryBId: p2.id,
            scoreA: 11,
            scoreB: 5,
          }),
          doneMatch({
            id: "g2",
            groupId: "G1",
            stage: "group",
            entryAId: p1.id,
            entryBId: p3.id,
            scoreA: 11,
            scoreB: 7,
          }),
          doneMatch({
            id: "g3",
            groupId: "G1",
            stage: "group",
            entryAId: p2.id,
            entryBId: p3.id,
            scoreA: 11,
            scoreB: 8,
          }),
        ],
      },
    ],
  };
}

describe("IT-E2E-BROWSER-022 Internal Awards workspace", () => {
  it("A. Final completed → Awards click maps to awards workspace", () => {
    const tournament = makeFinalCompletedTournament();
    const lifecycle = resolveInternalTournamentLifecycle(tournament);
    assert.equal(lifecycle.CURRENT_STEP, INTERNAL_LIFECYCLE_STEPS.AWARDS);
    assert.equal(
      mapLifecycleStepToWorkspaceSection(INTERNAL_LIFECYCLE_STEPS.AWARDS),
      INTERNAL_WORKSPACE_SECTIONS.AWARDS
    );
    const clicked = resolveInternalWorkspaceSection({
      requestedSection: "awards",
      lifecycle,
      event: tournament.events[0],
    });
    assert.equal(clicked.section, INTERNAL_WORKSPACE_SECTIONS.AWARDS);
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    const workspace = readSrc(
      "src/components/tournament/internal/InternalAwardsWorkspace.jsx"
    );
    assert.match(setup, /InternalAwardsWorkspace/);
    assert.match(setup, /INTERNAL_WORKSPACE_SECTIONS\.AWARDS/);
    assert.match(workspace, /data-testid="internal-awards-workspace"/);
    assert.match(workspace, /TRAO GIẢI/);
  });

  it("B. direct ?section=awards stays Awards, not Results", () => {
    const tournament = makeFinalCompletedTournament();
    const lifecycle = resolveInternalTournamentLifecycle(tournament);
    const resolved = resolveInternalWorkspaceSection({
      requestedSection: "awards",
      lifecycle,
      event: tournament.events[0],
    });
    assert.equal(resolved.section, "awards");
    assert.equal(resolved.source, "url");
    assert.notEqual(resolved.section, INTERNAL_WORKSPACE_SECTIONS.RESULTS);
  });

  it("C/D. champion and runner-up match Final 15-11", () => {
    const projection = projectInternalAwardsWorkspace(makeFinalCompletedTournament());
    assert.equal(projection.champion.name, "IT421 Nam 05 / TT412-SEED-M01");
    assert.equal(projection.runnerUp.name, "IT421 Nam 06 / TT412-SEED-M02");
    assert.equal(projection.champion.entryId, A1.id);
    assert.equal(projection.runnerUp.entryId, B1.id);
  });

  it("E. before Awards confirm, Complete is disabled", () => {
    const tournament = makeFinalCompletedTournament();
    const projection = projectInternalAwardsWorkspace(tournament);
    const action = resolveInternalCompletionAction(tournament);
    assert.equal(projection.derivedReady, true);
    assert.equal(projection.awardsReady, false);
    assert.equal(action.enabled, false);
    assert.equal(INTERNAL_AWARDS_CONFIRMATION_REQUIRED, true);
  });

  it("F. after Awards confirm, Complete is enabled", () => {
    const tournament = makeFinalCompletedTournament();
    const confirmed = confirmInternalAwards(tournament, { actor: { id: "owner" } });
    assert.equal(confirmed.ok, true);
    const projection = projectInternalAwardsWorkspace(confirmed.tournament);
    const action = resolveInternalCompletionAction(confirmed.tournament);
    assert.equal(projection.awardsReady, true);
    assert.equal(projection.completionReady, true);
    assert.equal(action.enabled, true);
    assert.equal(
      confirmed.tournament.settings.awards.assignments.champion,
      A1.id
    );
    assert.equal(
      confirmed.tournament.settings.awards.assignments.runnerUp,
      B1.id
    );
    assert.equal(INTERNAL_AWARDS_PERSISTENCE_PATH, "settings.awards.assignments");
  });

  it("G. F5 Awards route persistence", () => {
    const confirmed = confirmInternalAwards(makeFinalCompletedTournament()).tournament;
    const row = tournamentToCanonicalRow(confirmed, {
      tenantId: confirmed.tenantId,
      clubId: confirmed.clubId,
    });
    row.version = 33;
    row.created_at = "2026-08-14T00:00:00.000Z";
    row.updated_at = "2026-08-14T00:00:00.000Z";
    const remounted = canonicalRowToTournament(row);
    const lifecycle = resolveInternalTournamentLifecycle(remounted);
    const resolved = resolveInternalWorkspaceSection({
      requestedSection: "awards",
      lifecycle,
      event: remounted.events[0],
    });
    assert.equal(resolved.section, "awards");
    const projection = projectInternalAwardsWorkspace(remounted);
    assert.equal(projection.awardsReady, true);
    assert.equal(projection.champion.name, "IT421 Nam 05 / TT412-SEED-M01");
  });

  it("H. one-group parity: live awards then complete, no knockout", () => {
    const tournament = makeOneGroupTournament();
    const lifecycle = resolveInternalTournamentLifecycle(tournament);
    assert.equal(lifecycle.oneGroup, true);
    assert.equal(lifecycle.skipKnockout, true);
    assert.equal(lifecycle.CURRENT_STEP, INTERNAL_LIFECYCLE_STEPS.AWARDS);
    const projection = projectInternalAwardsWorkspace(tournament);
    assert.equal(projection.champion.name, "IT421 Nam 05");
    assert.equal(projection.runnerUp.name, "IT421 Nam 06");
    assert.equal(projection.awardsReady, false);
    const confirmed = confirmInternalAwards(tournament);
    assert.equal(confirmed.projection.awardsReady, true);
    assert.equal(resolveInternalCompletionAction(confirmed.tournament).enabled, true);
  });

  it("I/J. singles PLAYER rows and doubles TEAM rows", () => {
    const singles = projectInternalAwardsWorkspace(makeOneGroupTournament());
    assert.equal(singles.rowIdentity, "PLAYER");
    const doubles = projectInternalAwardsWorkspace(makeFinalCompletedTournament());
    assert.equal(doubles.rowIdentity, "TEAM");
  });

  it("K/L. Results and Bracket routes stay independent of Awards", () => {
    const tournament = makeFinalCompletedTournament();
    const lifecycle = resolveInternalTournamentLifecycle(tournament);
    const results = resolveInternalWorkspaceSection({
      requestedSection: "results",
      lifecycle,
      event: tournament.events[0],
    });
    const bracket = resolveInternalWorkspaceSection({
      requestedSection: "bracket",
      lifecycle,
      event: tournament.events[0],
    });
    assert.equal(results.section, INTERNAL_WORKSPACE_SECTIONS.RESULTS);
    assert.equal(bracket.section, INTERNAL_WORKSPACE_SECTIONS.BRACKET);
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /INTERNAL_WORKSPACE_SECTIONS\.RESULTS &&/);
    assert.match(setup, /INTERNAL_WORKSPACE_SECTIONS\.BRACKET &&/);
    assert.match(setup, /INTERNAL_WORKSPACE_SECTIONS\.AWARDS \?/);
    assert.doesNotMatch(
      setup,
      /mapLifecycleStepToWorkspaceSection\(INTERNAL_LIFECYCLE_STEPS\.AWARDS\).*RESULTS/
    );
  });
});
