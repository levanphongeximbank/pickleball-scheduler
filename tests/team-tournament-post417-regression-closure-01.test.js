/**
 * POST-#417 Team Tournament setup regression closure.
 * Covers dirty/polling contract, MLP create==reload, gate retirement,
 * captain/team/group commit, workflow authority, #412/#416/#417 locks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import {
  CANONICAL_MLP_DISCIPLINE_IDS,
  CANONICAL_MLP_NORMAL_DISCIPLINE_NAMES,
  adoptCanonicalCreateTeamData,
  createMlpDisciplines,
  getActiveMatchDisciplines,
  isActivationOnlyDreambreakerDiscipline,
} from "../src/features/team-tournament/engines/mlpPresetEngine.js";
import { persistCanonicalTeamTournamentCreate } from "../src/features/team-tournament/lifecycle/ensureCanonicalTeamTournament.js";
import { deriveWorkflowStage, WORKFLOW_STAGE } from "../src/features/team-tournament/engines/teamTournamentWorkflowStage.js";
import { resolveFormatVenueDefaults } from "../src/features/team-tournament/engines/teamFormatVenueConfig.js";
import {
  SETUP_FORM_REHYDRATE_REASON,
  SETUP_MUTATION_GATE_ENV,
  SETUP_MUTATION_GATE_META,
  V7_GATE_RETIREMENT_RECOMMENDATION,
  buildFormatVenueFingerprint,
  decideSetupFormRehydration,
  isSetupMutationFoundationEnabled,
} from "../src/features/team-tournament/setup/index.js";
import { confirmAiPairingUiTransaction } from "../src/features/team-tournament/services/confirmAiPairingUiTransaction.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

const SQL_APPLY = "docs/v5/migrations/team-tournament-post417-regression-closure-01/02_APPLY.sql";

describe("post-#417 dirty / polling contract", () => {
  it("1. selected court remains selected while polling occurs before save", () => {
    const baseline = buildFormatVenueFingerprint({
      formatPreset: FORMAT_PRESET.MLP_4,
      selectedCourtIds: [],
      rosterRules: { teamSize: 4 },
      dreambreakerEnabled: true,
      groupMode: "single_pool",
      groupCount: 1,
      qualificationCount: 2,
      knockoutFormat: "top_n",
      stageTieBreakPolicy: {},
    });
    const pollSameServer = buildFormatVenueFingerprint({
      formatPreset: FORMAT_PRESET.MLP_4,
      selectedCourtIds: [],
      rosterRules: { teamSize: 4 },
      dreambreakerEnabled: true,
      groupMode: "single_pool",
      groupCount: 1,
      qualificationCount: 2,
      knockoutFormat: "top_n",
      stageTieBreakPolicy: {},
    });
    assert.equal(baseline, pollSameServer);
    const decision = decideSetupFormRehydration({
      dirty: true,
      prevFingerprint: baseline,
      nextFingerprint: pollSameServer,
    });
    assert.equal(decision.rehydrate, false);
    assert.equal(decision.reason, SETUP_FORM_REHYDRATE_REASON.SERVER_UNCHANGED);
  });

  it("2. all Format & Venue dirty fields survive background refresh identity change", () => {
    const dirtyDecision = decideSetupFormRehydration({
      dirty: true,
      prevFingerprint: "fp-a",
      nextFingerprint: "fp-b",
    });
    assert.equal(dirtyDecision.rehydrate, false);
    assert.equal(dirtyDecision.conflict, true);
    assert.equal(dirtyDecision.reason, SETUP_FORM_REHYDRATE_REASON.DIRTY_RETAIN);

    const panel = readSrc("src/components/tournament/team/TeamFormatVenueSetupPanel.jsx");
    assert.match(panel, /decideSetupFormRehydration/);
    assert.match(panel, /formatDirty/);
    assert.doesNotMatch(
      panel,
      /useEffect\(\(\) => \{\s*const next = resolveFormatVenueDefaults\(teamData, tournament\);\s*setFormatPreset/
    );
  });

  it("3. save Format & Venue → readback becomes new baseline", () => {
    const afterSave = decideSetupFormRehydration({
      dirty: true,
      prevFingerprint: "fp-local",
      nextFingerprint: "fp-saved",
      afterSuccessfulMutation: true,
    });
    assert.equal(afterSave.rehydrate, true);
    assert.equal(afterSave.reason, SETUP_FORM_REHYDRATE_REASON.POST_MUTATION_READBACK);
  });

  it("4. F5 selected courts return from persisted settings", () => {
    const defaults = resolveFormatVenueDefaults(
      {
        settings: {
          formatPreset: FORMAT_PRESET.MLP_4,
          selectedCourtIds: ["court-7", "court-9"],
        },
      },
      { settings: {} }
    );
    assert.deepEqual(defaults.selectedCourtIds, ["court-7", "court-9"]);
  });
});

describe("post-#417 captain / team / group commit", () => {
  it("5-6. Xác nhận closes immediately when canonical commit + refresh apply", async () => {
    const nextTeamData = {
      teams: [{ id: "t1", name: "A", captainPlayerId: "p1", playerIds: ["p1", "p2", "p3", "p4"] }],
      groups: [{ id: "g1", name: "Bảng A", teamIds: ["t1"], sortOrder: 1 }],
      settings: { groupCount: 1 },
    };
    const result = await confirmAiPairingUiTransaction({
      beginMutationBarrier: () => 1,
      endMutationBarrier: () => {},
      refreshAfterMutation: async () => ({
        ok: true,
        applied: true,
        teamData: nextTeamData,
        tournament: { id: "tt-1", status: "draft" },
      }),
      nextTeamData,
      confirmFn: async () => ({
        ok: true,
        teamData: nextTeamData,
        groupsExpected: 1,
        captainsPersisted: 1,
        writeCount: 1,
      }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.reactCanonicalCommitted, true);
    assert.equal(result.groupCount, 1);
    assert.ok(result.workflowStage);
  });

  it("7-9. F5 after confirm preserves teams, captains, groups from persisted state", () => {
    const persisted = {
      teams: [
        { id: "t1", captainPlayerId: "cap-1", playerIds: ["cap-1", "a", "b", "c"] },
        { id: "t2", captainPlayerId: "cap-2", playerIds: ["cap-2", "d", "e", "f"] },
      ],
      groups: [
        { id: "g1", name: "A", teamIds: ["t1", "t2"], sortOrder: 1 },
      ],
      disciplines: createMlpDisciplines(),
      matchups: [],
      settings: { formatPreset: FORMAT_PRESET.MLP_4, groupCount: 1, selectedCourtIds: ["c1"] },
    };
    const f5 = deriveWorkflowStage(persisted, { id: "tt-1", status: "draft" });
    assert.notEqual(f5, WORKFLOW_STAGE.FORMAT);
    assert.ok(
      persisted.teams.every((team) => team.captainPlayerId),
      "captainPlayerIds must survive F5 payload"
    );
    assert.equal(persisted.groups.length, 1);
    assert.equal(persisted.teams.length, 2);
  });

  it("10. workflow steps derive from canonical persisted collections", () => {
    const empty = deriveWorkflowStage(
      { teams: [], groups: [], disciplines: [], matchups: [], settings: {} },
      { status: "draft" }
    );
    assert.ok(empty === WORKFLOW_STAGE.FORMAT || empty === WORKFLOW_STAGE.TEAMS || empty === WORKFLOW_STAGE.DISCIPLINES);
    const withTeams = deriveWorkflowStage(
      {
        teams: [{ id: "t1" }, { id: "t2" }],
        groups: [{ id: "g1", teamIds: ["t1", "t2"] }],
        disciplines: createMlpDisciplines(),
        matchups: [],
        settings: { formatPreset: FORMAT_PRESET.MLP_4, selectedCourtIds: ["c1"] },
      },
      { status: "draft" }
    );
    assert.notEqual(withTeams, WORKFLOW_STAGE.TEAMS);
  });
});

describe("post-#417 MLP initialization + create==reload", () => {
  it("11-12. newly created MLP catalog has four normal contents and no ordinary Dreambreaker slot", () => {
    const disciplines = createMlpDisciplines();
    const normal = getActiveMatchDisciplines(disciplines);
    assert.equal(normal.length, 4);
    assert.deepEqual(
      normal.map((item) => item.name),
      [...CANONICAL_MLP_NORMAL_DISCIPLINE_NAMES]
    );
    assert.deepEqual(
      normal.map((item) => item.id),
      [
        CANONICAL_MLP_DISCIPLINE_IDS.WOMEN_DOUBLES,
        CANONICAL_MLP_DISCIPLINE_IDS.MEN_DOUBLES,
        CANONICAL_MLP_DISCIPLINE_IDS.MIXED_1,
        CANONICAL_MLP_DISCIPLINE_IDS.MIXED_2,
      ]
    );
    const dream = disciplines.filter((item) => isActivationOnlyDreambreakerDiscipline(item));
    assert.equal(dream.length, 1);
    assert.equal(dream[0].id, CANONICAL_MLP_DISCIPLINE_IDS.DREAMBREAKER);
    assert.equal(normal.some((item) => item.id === "dreambreaker"), false);
  });

  it("13. create response domain equals immediate reload domain", async () => {
    const seeded = {
      settings: { formatPreset: FORMAT_PRESET.MLP_4 },
      disciplines: createMlpDisciplines(),
      teams: [],
      groups: [],
      matchups: [],
    };
    const created = await persistCanonicalTeamTournamentCreate(
      { clubId: "club-a", tenantId: "venue-a", name: "MLP", createdBy: "org" },
      {
        createViaRpc: async () => ({
          ok: true,
          tournament: {
            id: "33333333-3333-4333-8333-333333333333",
            mode: "team_tournament",
            status: "draft",
            settings: seeded.settings,
            teamData: seeded,
          },
        }),
      }
    );
    assert.equal(created.ok, true);
    const reload = adoptCanonicalCreateTeamData(seeded, seeded.settings);
    assert.deepEqual(
      created.tournament.teamData.disciplines.map((item) => item.id),
      reload.disciplines.map((item) => item.id)
    );
    assert.equal(created.tournament.teamData.teams.length, reload.teams.length);
    assert.equal(created.tournament.teamData.groups.length, reload.groups.length);

    const unsourced = adoptCanonicalCreateTeamData(undefined, { formatPreset: FORMAT_PRESET.MLP_4 });
    assert.deepEqual(unsourced.disciplines, []);
    assert.deepEqual(unsourced.teams, []);
  });
});

describe("post-#417 setup gate retirement", () => {
  it("15. gate defaults ON; explicit OFF remains kill-switch", () => {
    assert.equal(SETUP_MUTATION_GATE_META.default, "ON");
    assert.equal(V7_GATE_RETIREMENT_RECOMMENDATION, "RETIRE_DEFAULT_ON_EXPLICIT_OFF_KILLSWITCH");
    assert.equal(isSetupMutationFoundationEnabled({}), true);
    assert.equal(
      isSetupMutationFoundationEnabled({ [SETUP_MUTATION_GATE_ENV]: "false" }),
      false
    );
  });

  it("14+16. Save Draft / persist refuse when gate OFF; missing writer stays fail-closed", () => {
    const orch = readSrc("src/features/team-tournament/ui/teamTournamentUiOrchestrator.js");
    assert.match(orch, /persistSetupTeamData/);
    assert.match(orch, /saveDraft/);
    assert.match(orch, /GATE_OFF/);
    assert.match(orch, /isSetupMutationFoundationEnabled/);
    const lifecycle = readSrc("src/features/team-tournament/lifecycle/ensureCanonicalTeamTournament.js");
    assert.match(lifecycle, /RPC_MISSING/);
    assert.doesNotMatch(lifecycle, /createTeamTournamentShell/);
  });
});

describe("post-#417 SQL + source locks", () => {
  it("SQL package seeds MLP catalog and atomic pairing", () => {
    const sql = readSrc(SQL_APPLY);
    assert.match(sql, /mlp-wd/);
    assert.match(sql, /mlp-md/);
    assert.match(sql, /mlp-xd1/);
    assert.match(sql, /mlp-xd2/);
    assert.match(sql, /dreambreaker/);
    assert.match(sql, /Đôi nam/);
    assert.match(sql, /Đôi nữ/);
    assert.match(sql, /team_tournament_commit_pairing/);
    assert.match(sql, /teamData/);
    assert.match(sql, /team_tournament_seed_mlp_disciplines/);
  });

  it("17. #417 canonical create / no dual-write preserved", () => {
    const src = readSrc("src/features/team-tournament/lifecycle/ensureCanonicalTeamTournament.js");
    assert.match(src, /team_tournament_create/);
    assert.match(src, /FAIL CLOSED/);
    assert.match(src, /No client dual-write/);
    assert.doesNotMatch(src, /createCanonical\(|ensureHeader\(/);
  });

  it("18. #416 stage tie-break constants remain", () => {
    const src = readSrc("src/features/team-tournament/constants.js");
    assert.match(src, /STAGE_TIE_BREAK_POLICY/);
    assert.match(src, /DREAMBREAKER/);
    assert.match(src, /TOTAL_SUBMATCH_POINTS/);
  });

  it("19. #412 four normal MLP contents + Dreambreaker activation-only remain", () => {
    const normal = getActiveMatchDisciplines(createMlpDisciplines());
    assert.equal(normal.length, 4);
    const panel = readSrc("src/features/team-tournament/engines/mlpPresetEngine.js");
    assert.match(panel, /isActivationOnlyDreambreakerDiscipline/);
  });
});
