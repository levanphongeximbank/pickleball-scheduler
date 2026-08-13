/**
 * IT-P27-001 — locked alone ≠ complete (Pass 2.8).
 * Exact bypass: closeTournament lockAllMatches must not manufacture completion.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  MATCH_STATUS,
} from "../src/models/tournament/constants.js";
import { createCloudTournamentRepository } from "../src/features/tournament/repositories/cloudTournamentRepository.js";
import { canonicalRowToTournament } from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import {
  assertInternalCompetitionComplete,
  assertInternalStatusCompletionGate,
  classifyInternalMatchCompletionShape,
  isInternalMatchGenuinelyTerminal,
} from "../src/features/tournament/internal/index.js";
import {
  canCloseTournament,
  closeTournament,
} from "../src/features/individual-tournament/engines/tournamentClosingEngine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makeRow(overrides = {}) {
  return {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    tenant_id: "tenant-a",
    club_id: "club-a",
    external_key: "it-p27",
    name: "P27",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.ACTIVE,
    season_id: null,
    league_id: null,
    payload: { events: [], settings: {} },
    engine_v4: {},
    version: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function oneGroupIncomplete(locked = false) {
  return canonicalRowToTournament(
    makeRow({
      payload: {
        events: [
          {
            id: "ev1",
            groups: [{ id: "g1", entryIds: ["e1", "e2"] }],
            matches: [
              {
                id: "m1",
                status: "scheduled",
                locked,
                winnerId: null,
              },
            ],
          },
        ],
        settings: {},
      },
    })
  );
}

function oneGroupTerminal(locked = false) {
  return canonicalRowToTournament(
    makeRow({
      payload: {
        events: [
          {
            id: "ev1",
            groups: [{ id: "g1", entryIds: ["e1", "e2"] }],
            matches: [
              {
                id: "m1",
                status: MATCH_STATUS.COMPLETED,
                locked,
                winnerId: "e1",
              },
            ],
          },
        ],
        settings: {},
      },
    })
  );
}

function multiGroupIncompleteFinal(locked = false) {
  return canonicalRowToTournament(
    makeRow({
      payload: {
        events: [
          {
            id: "ev1",
            groups: [{ id: "g1" }, { id: "g2" }],
            matches: [
              {
                id: "m1",
                status: MATCH_STATUS.COMPLETED,
                winnerId: "e1",
              },
              {
                id: "m2",
                bracketMatchId: "b-final",
                stage: "final",
                status: "scheduled",
                locked,
                winnerId: null,
              },
            ],
          },
        ],
        settings: {},
      },
    })
  );
}

function multiGroupTerminalFinal() {
  return canonicalRowToTournament(
    makeRow({
      payload: {
        events: [
          {
            id: "ev1",
            groups: [{ id: "g1" }, { id: "g2" }],
            matches: [
              {
                id: "m1",
                status: MATCH_STATUS.COMPLETED,
                winnerId: "e1",
              },
              {
                id: "m2",
                bracketMatchId: "b-final",
                stage: "final",
                status: MATCH_STATUS.COMPLETED,
                locked: true,
                winnerId: "e1",
              },
            ],
          },
        ],
        settings: {},
      },
    })
  );
}

describe("IT-P27-001 terminal parity matrix", () => {
  it("locked alone never counts as complete", () => {
    const shapes = [
      { status: "scheduled", locked: false },
      { status: "scheduled", locked: true },
      { status: MATCH_STATUS.COMPLETED, locked: false },
      { status: MATCH_STATUS.COMPLETED, locked: true },
      { status: MATCH_STATUS.FORFEIT, locked: true },
    ].map((match) => classifyInternalMatchCompletionShape(match));

    assert.equal(shapes[0].countsAsCompetitionComplete, false);
    assert.equal(shapes[1].countsAsCompetitionComplete, false);
    assert.equal(shapes[1].lockedAloneCountsAsComplete, false);
    assert.equal(shapes[2].countsAsCompetitionComplete, true);
    assert.equal(shapes[3].countsAsCompetitionComplete, true);
    assert.equal(shapes[4].countsAsCompetitionComplete, true);
    assert.equal(isInternalMatchGenuinelyTerminal({ status: "scheduled", locked: true }), false);
  });
});

describe("IT-P27-001 INCOMPLETE_LOCKED_MATCH_CANNOT_COMPLETE", () => {
  it("closeTournament rejects incomplete even if lock would run", () => {
    const unfinished = oneGroupIncomplete(false);
    const unlockedClose = canCloseTournament(unfinished);
    assert.equal(unlockedClose.ok, false);

    const lockedIncomplete = oneGroupIncomplete(true);
    const lockedClose = canCloseTournament(lockedIncomplete);
    assert.equal(lockedClose.ok, false);

    const closed = closeTournament(lockedIncomplete, { autoAwards: true });
    assert.equal(closed.ok, false);
    assert.equal(lockedIncomplete.status, TOURNAMENT_STATUS.ACTIVE);
  });

  it("repo rejects manufactured locked+completed patch using pre-patch competition", async () => {
    const existing = oneGroupIncomplete(false);
    const row = makeRow({
      version: 4,
      status: TOURNAMENT_STATUS.ACTIVE,
      payload: {
        events: existing.events,
        settings: {},
      },
    });

    let writeCount = 0;
    const repo = createCloudTournamentRepository({
      rpc: async (name) => {
        if (name === "canonical_tournament_get") {
          return { ok: true, tournament: row };
        }
        if (name === "canonical_tournament_update") {
          writeCount += 1;
          return { ok: true, tournament: { ...row, version: 5 } };
        }
        return { ok: false };
      },
    });

    // Malicious/incorrect close-shaped patch: lock unfinished + fabricate snapshot.
    const denied = await repo.update(
      { id: "club-a", tenantId: "tenant-a" },
      row.id,
      {
        status: TOURNAMENT_STATUS.COMPLETED,
        events: [
          {
            ...existing.events[0],
            matches: existing.events[0].matches.map((m) => ({
              ...m,
              locked: true,
            })),
          },
        ],
        settings: {
          resultsOps: {
            closed: true,
            summary: { champion: { entryId: "e1", entryName: "Fake" } },
          },
        },
      },
      { tenantId: "tenant-a", expectedVersion: 4 }
    );

    assert.equal(denied.ok, false);
    assert.equal(denied.code, "INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE");
    assert.equal(writeCount, 0);
    assert.equal(row.version, 4);
    assert.equal(row.status, TOURNAMENT_STATUS.ACTIVE);
  });
});

describe("IT-P27-001 one-group matrix", () => {
  it("A/B incomplete unlocked and locked rejected", () => {
    assert.equal(assertInternalCompetitionComplete(oneGroupIncomplete(false)).ok, false);
    assert.equal(assertInternalCompetitionComplete(oneGroupIncomplete(true)).ok, false);
  });

  it("C/D genuine terminal unlocked/locked accepted for competition", () => {
    assert.equal(assertInternalCompetitionComplete(oneGroupTerminal(false)).ok, true);
    assert.equal(assertInternalCompetitionComplete(oneGroupTerminal(true)).ok, true);
  });

  it("E/F close path: incomplete rejected; genuine close succeeds with snapshot", () => {
    assert.equal(closeTournament(oneGroupIncomplete(true)).ok, false);

    const terminal = oneGroupTerminal(false);
    terminal.events = [
      {
        ...terminal.events[0],
        entries: [
          { id: "e1", name: "Alpha", playerIds: ["p1"] },
          { id: "e2", name: "Beta", playerIds: ["p2"] },
        ],
      },
    ];
    const okClose = closeTournament(terminal, { autoAwards: true });
    assert.equal(okClose.ok, true);
    assert.equal(okClose.tournament.status, TOURNAMENT_STATUS.COMPLETED);
    assert.equal(okClose.tournament.settings.resultsOps.closed, true);

    // Ensure close snapshot has a real champion identity for gate B.
    const closedWithChampion = {
      ...okClose.tournament,
      settings: {
        ...okClose.tournament.settings,
        resultsOps: {
          ...okClose.tournament.settings.resultsOps,
          summary: {
            ...(okClose.tournament.settings.resultsOps.summary || {}),
            champion: { entryId: "e1", entryName: "Alpha" },
          },
        },
      },
    };

    const gate = assertInternalStatusCompletionGate(
      terminal,
      TOURNAMENT_STATUS.COMPLETED,
      closedWithChampion
    );
    assert.equal(gate.ok, true);
  });
});

describe("IT-P27-001 multi-group matrix", () => {
  it("A/B incomplete final unlocked/locked rejected", () => {
    assert.equal(assertInternalCompetitionComplete(multiGroupIncompleteFinal(false)).ok, false);
    assert.equal(assertInternalCompetitionComplete(multiGroupIncompleteFinal(true)).ok, false);
  });

  it("C genuine final terminal accepted", () => {
    assert.equal(assertInternalCompetitionComplete(multiGroupTerminalFinal()).ok, true);
  });
});

describe("IT-P27-001 SQL structural contract", () => {
  it("APPLY uses pre-patch payload and ignores lock-only terminal", () => {
    const apply = readFileSync(
      path.join(
        root,
        "docs/v5/migrations/internal-tournament-end-to-end-closure-01/02_APPLY.sql"
      ),
      "utf8"
    );
    assert.match(apply, /v_current\.payload/);
    assert.match(apply, /v_status NOT IN \('completed', 'forfeit'\)/);
    assert.doesNotMatch(
      apply,
      /v_locked[\s\S]{0,40}OR v_status IN \('completed', 'forfeit'\)/
    );
    assert.match(apply, /IT-P27-001/);
  });
});
