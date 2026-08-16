/**
 * IT-BROWSER-007 — F5 restores Internal workspace section from URL or lifecycle,
 * never defaulting to unavailable Bracket during group results.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it } from "node:test";

import {
  EVENT_TYPE,
  MATCH_STATUS,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../src/models/tournament/constants.js";
import { canonicalRowToTournament } from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import {
  INTERNAL_LIFECYCLE_STEPS,
  INTERNAL_WORKSPACE_SECTIONS,
  resolveInternalTournamentLifecycle,
  resolveInternalWorkspaceSection,
  resolveLifecycleDefaultWorkspaceSection,
} from "../src/features/tournament/internal/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOURNAMENT_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function makeGroupResultsRow() {
  return {
    id: TOURNAMENT_ID,
    tenant_id: "tenant-a",
    club_id: "club-a",
    external_key: TOURNAMENT_ID,
    name: "Internal Section Restore",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.ACTIVE,
    season_id: null,
    league_id: null,
    payload: {
      settings: { refereeRoster: [{ id: "ref-1", name: "TT A", active: true }] },
      events: [
        {
          id: "event-1",
          eventType: EVENT_TYPE.MIXED_DOUBLE,
          groups: [
            { id: "G1", label: "A", name: "Bảng A" },
            { id: "G2", label: "B", name: "Bảng B" },
          ],
          entries: [
            { id: "e1", name: "Đội 1" },
            { id: "e2", name: "Đội 2" },
            { id: "e3", name: "Đội 3" },
            { id: "e4", name: "Đội 4" },
          ],
          matches: [
            {
              id: "m-g1-1",
              groupId: "G1",
              entryAId: "e1",
              entryBId: "e2",
              status: MATCH_STATUS.COMPLETED,
              scoreA: 11,
              scoreB: 5,
              winnerId: "e1",
            },
            {
              id: "m-g1-2",
              groupId: "G1",
              entryAId: "e1",
              entryBId: "e2",
              status: MATCH_STATUS.PENDING,
            },
            {
              id: "m-g2-1",
              groupId: "G2",
              entryAId: "e3",
              entryBId: "e4",
              status: MATCH_STATUS.PENDING,
            },
          ],
        },
      ],
    },
    engine_v4: {},
    version: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makeKnockoutActiveRow() {
  const row = makeGroupResultsRow();
  row.payload.events[0].matches = row.payload.events[0].matches.map((match) => ({
    ...match,
    status: MATCH_STATUS.COMPLETED,
    scoreA: 11,
    scoreB: 4,
    winnerId: match.entryAId,
  }));
  row.payload.events[0].bracket = {
    rounds: [
      {
        name: "Ban ket",
        matches: [{ id: "R1-M1", bracketMatchId: "R1-M1", team1: "e1", team2: "e3" }],
      },
    ],
    winnersByMatch: {},
    unlockedRounds: {},
    qualifiersPerGroup: 1,
    generatedAt: new Date().toISOString(),
  };
  row.payload.events[0].matches.push({
    id: "m-ko-1",
    bracketMatchId: "R1-M1",
    entryAId: "e1",
    entryBId: "e3",
    status: MATCH_STATUS.PENDING,
  });
  return row;
}

describe("IT-BROWSER-007 — F5 restores lifecycle-safe Internal section", () => {
  it("A. GROUP_RESULTS with no URL section defaults to results, not bracket", () => {
    const tournament = canonicalRowToTournament(makeGroupResultsRow());
    const lifecycle = resolveInternalTournamentLifecycle(tournament);
    assert.equal(lifecycle.CURRENT_STEP, INTERNAL_LIFECYCLE_STEPS.STANDINGS_OR_KNOCKOUT);
    assert.equal(lifecycle.PRIMARY_ACTION_LABEL, "Nhập kết quả vòng bảng");
    const resolved = resolveInternalWorkspaceSection({
      requestedSection: "",
      lifecycle,
      event: tournament.events[0],
    });
    assert.equal(resolved.section, INTERNAL_WORKSPACE_SECTIONS.RESULTS);
    assert.equal(resolved.source, "lifecycle");
    assert.equal(
      resolveLifecycleDefaultWorkspaceSection({
        lifecycle,
        event: tournament.events[0],
      }),
      INTERNAL_WORKSPACE_SECTIONS.RESULTS
    );
  });

  it("B. GROUP_RESULTS with URL section=results stays on results", () => {
    const tournament = canonicalRowToTournament(makeGroupResultsRow());
    const lifecycle = resolveInternalTournamentLifecycle(tournament);
    const resolved = resolveInternalWorkspaceSection({
      requestedSection: "results",
      lifecycle,
      event: tournament.events[0],
    });
    assert.equal(resolved.section, INTERNAL_WORKSPACE_SECTIONS.RESULTS);
    assert.equal(resolved.source, "url");
  });

  it("C. GROUP_RESULTS with URL section=bracket falls back to results", () => {
    const tournament = canonicalRowToTournament(makeGroupResultsRow());
    const lifecycle = resolveInternalTournamentLifecycle(tournament);
    const resolved = resolveInternalWorkspaceSection({
      requestedSection: "bracket",
      lifecycle,
      event: tournament.events[0],
    });
    assert.equal(resolved.section, INTERNAL_WORKSPACE_SECTIONS.RESULTS);
    assert.equal(resolved.source, "unavailable-fallback");
  });

  it("D. KNOCKOUT_ACTIVE defaults to bracket", () => {
    const tournament = canonicalRowToTournament(makeKnockoutActiveRow());
    const lifecycle = resolveInternalTournamentLifecycle(tournament);
    assert.equal(lifecycle.CURRENT_STEP, INTERNAL_LIFECYCLE_STEPS.CHAMPION);
    const resolved = resolveInternalWorkspaceSection({
      requestedSection: "",
      lifecycle,
      event: tournament.events[0],
    });
    assert.equal(resolved.section, INTERNAL_WORKSPACE_SECTIONS.BRACKET);
    assert.equal(resolved.source, "lifecycle");
  });

  it("E/F. tab focus keeps session section; click does not mutate or full-page load", () => {
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /sessionSection \|\| sectionResolution\.section/);
    assert.match(setup, /setSessionSection\(section\)/);
    assert.match(setup, /workspaceTouchedRef/);
    assert.match(setup, /replace: true/);
    assert.match(setup, /INTERNAL_WORKSPACE_SECTION_QUERY/);
    assert.equal(/document\.visibilitychange/.test(setup), false);
    const selectBlock = setup.slice(
      setup.indexOf("const selectWorkspaceSection"),
      setup.indexOf("const groupStandings")
    );
    assert.equal(/writeCanonical|updateTournamentCommand|\.update\(/.test(selectBlock), false);
    assert.equal(/setLoading\(true\)|Đang tải giải nội bộ/.test(selectBlock), false);
  });

  it("G. persisted completed group score survives and F5 resolves results", () => {
    const tournament = canonicalRowToTournament(makeGroupResultsRow());
    const completed = tournament.events[0].matches.find((match) => match.id === "m-g1-1");
    assert.equal(completed.status, MATCH_STATUS.COMPLETED);
    assert.equal(completed.winnerId, "e1");
    const lifecycle = resolveInternalTournamentLifecycle(tournament);
    const resolved = resolveInternalWorkspaceSection({
      requestedSection: "",
      lifecycle,
      event: tournament.events[0],
    });
    assert.equal(resolved.section, INTERNAL_WORKSPACE_SECTIONS.RESULTS);
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /resolveInternalWorkspaceSection/);
    assert.equal(
      /setWorkspaceSection\(mapLifecycleStepToWorkspaceSection\(lifecycle\.CURRENT_STEP\)\)/.test(
        setup
      ),
      false
    );
  });
});
