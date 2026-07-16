import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

import {
  SETUP_MUTATION_CODES,
  SETUP_MUTATION_GATE_ENV,
  __resetSetupMutationFoundationStateForTests,
  attachSnapshotPackageToPayload,
  buildSetupMutationPayloadAsync,
  buildSetupMutationSnapshotPackageAsync,
  executeSetupMutation,
  runSetupMutation,
} from "../src/features/team-tournament/setup/index.js";
import {
  createTeamTournamentUiOrchestrator,
} from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";
import { TEAM_TOURNAMENT_DATA_MODES } from "../src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js";
import {
  TT_V6_TT32_ATHLETES,
  TT_V6_TT32_FIXTURE,
  TT_V6_TT32_FEMALE_ATHLETES,
  TT_V6_TT32_MALE_ATHLETES,
  TT_V6_TT32_RATINGS,
} from "../src/features/team-tournament/fixtures/ttV6Tt32StagingFixture.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GATE_ON = { [SETUP_MUTATION_GATE_ENV]: "true" };

before(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
      writable: true,
    });
  }
});

after(() => {
  __resetSetupMutationFoundationStateForTests();
});

describe("P1.3 complete browser hash call graph", () => {
  it("browser-bundled modules never call sync hash helpers", () => {
    const files = [
      "src/features/team-tournament/setup/executeSetupMutation.js",
      "src/features/team-tournament/ui/teamTournamentUiOrchestrator.js",
      "src/features/team-tournament/repositories/cloudTeamTournamentRepository.js",
      "src/components/tournament/team/TeamDisciplinesPanel.jsx",
      "src/components/tournament/team/TeamGroupDivisionPanel.jsx",
      "src/pages/tournament/TeamTournamentSetup.jsx",
    ];
    const forbidden = [
      /\bhashUtf8Sha256Sync\b/,
      /\bhashCanonicalSetupSnapshot\s*\(/,
      /\bhashEngineInput\s*\(/,
      /\bhashEngineOutput\s*\(/,
      /\bcalculateSetupMutationPayloadHash\s*\(/,
      /\bbuildSetupMutationEnvelope\s*\(/,
      /\bvalidateSetupMutationEnvelope\s*\(/,
      /\bbuildSetupMutationPayload\s*\(/,
      /\bbuildSetupMutationSnapshotPackage\s*\(/,
    ];
    for (const rel of files) {
      const src = readFileSync(path.join(ROOT, rel), "utf8");
      for (const pattern of forbidden) {
        assert.equal(pattern.test(src), false, `${rel} matched ${pattern}`);
      }
    }
    const executeSrc = readFileSync(
      path.join(ROOT, "src/features/team-tournament/setup/executeSetupMutation.js"),
      "utf8"
    );
    assert.match(executeSrc, /validateSetupMutationEnvelopeAsync\s*\(/);
  });

  it("executeSetupMutation reaches callRpc after async envelope validation (no sync)", async () => {
    __resetSetupMutationFoundationStateForTests();
    const versions = process.versions;
    const originalNode = versions.node;
    Object.defineProperty(versions, "node", {
      configurable: true,
      get: () => undefined,
    });

    try {
      const built = await buildSetupMutationPayloadAsync({
        method: "discipline.save",
        tournamentId: "tt-exec-async",
        expectedTournamentVersion: 2,
        idempotencyKey: "exec-async-1",
        generatedAt: "2026-01-01T00:00:00.000Z",
        engineInput: {},
        engineOutput: {},
        payload: { discipline: { id: "d1", name: "QA ĐÔI NAM" } },
      });
      assert.equal(built.ok, true);

      let rpcNameSeen = "";
      const result = await executeSetupMutation({
        provider: "cloud",
        tournamentId: "tt-exec-async",
        envelope: built.envelope,
        envSource: GATE_ON,
        callRpc: async (rpcName, args) => {
          rpcNameSeen = rpcName;
          assert.equal(rpcName, "team_tournament_save_discipline");
          assert.equal(args.p_envelope.payloadHash, built.envelope.payloadHash);
          return {
            ok: true,
            version: 3,
            replayed: false,
            snapshot: { snapshotHash: "abc", snapshotVersion: 3 },
          };
        },
      });
      assert.equal(result.ok, true);
      assert.equal(rpcNameSeen, "team_tournament_save_discipline");
      assert.equal(result.version, 3);
    } finally {
      Object.defineProperty(versions, "node", {
        configurable: true,
        value: originalNode,
        writable: true,
      });
    }
  });

  it("persistSetupTeamData → executeSetupMutation → RPC with browser node unset", async () => {
    __resetSetupMutationFoundationStateForTests();
    const versions = process.versions;
    const originalNode = versions.node;
    Object.defineProperty(versions, "node", {
      configurable: true,
      get: () => undefined,
    });

    let rpcCalled = false;
    const repo = {
      getProvider: () => "cloud",
      getTournament: async () => ({
        ok: true,
        version: 2,
        data: {
          id: "tt-complete",
          version: 2,
          teams: Array.from({ length: 8 }, (_, i) => ({ id: `team-${i + 1}`, name: `T${i + 1}` })),
          teamData: {
            teams: Array.from({ length: 8 }, (_, i) => ({ id: `team-${i + 1}`, name: `T${i + 1}` })),
            disciplines: [],
          },
          settings: {},
        },
      }),
      executeSetupMutation: async ({ envelope }) => {
        rpcCalled = true;
        assert.match(envelope.payloadHash, /^[a-f0-9]{64}$/);
        assert.ok(envelope.payload?.snapshot?.snapshotHash);
        return {
          ok: true,
          version: 3,
          data: {
            snapshot: { snapshotHash: envelope.payload.snapshot.snapshotHash },
            teamData: {
              disciplines: [{ id: "d1", name: "QA ĐÔI NAM", sortOrder: 1 }],
              teams: Array.from({ length: 8 }, (_, i) => ({ id: `team-${i + 1}`, name: `T${i + 1}` })),
            },
          },
        };
      },
    };

    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
      forceNew: true,
    });

    try {
      const result = await orch.persistSetupTeamData(
        "club-1",
        "tt-complete",
        {
          teams: Array.from({ length: 8 }, (_, i) => ({ id: `team-${i + 1}`, name: `T${i + 1}` })),
          disciplines: [{ id: "d1", name: "QA ĐÔI NAM", sortOrder: 1 }],
        },
        {
          envSource: GATE_ON,
          previousTeamData: {
            teams: Array.from({ length: 8 }, (_, i) => ({ id: `team-${i + 1}`, name: `T${i + 1}` })),
            disciplines: [],
          },
          expectedTournamentVersion: 2,
          generatedAt: "2026-01-01T00:00:00.000Z",
          aggregate: {
            id: "tt-complete",
            version: 2,
            teams: Array.from({ length: 8 }, (_, i) => ({ id: `team-${i + 1}`, name: `T${i + 1}` })),
            teamData: {
              teams: Array.from({ length: 8 }, (_, i) => ({ id: `team-${i + 1}`, name: `T${i + 1}` })),
              disciplines: [],
            },
            settings: {},
          },
          reloadAcknowledged: true,
        }
      );
      assert.equal(result.ok, true, result.error || result.code);
      assert.equal(rpcCalled, true);
      assert.notEqual(result.code, SETUP_MUTATION_CODES.BLOB_FALLBACK_FORBIDDEN);
    } finally {
      Object.defineProperty(versions, "node", {
        configurable: true,
        value: originalNode,
        writable: true,
      });
    }
  });

  it("group replace path hashes async then calls RPC", async () => {
    __resetSetupMutationFoundationStateForTests();
    const snapshot = await buildSetupMutationSnapshotPackageAsync({
      tournament: { id: "tt-groups", version: 5 },
      expectedTournamentVersion: 5,
      generatedAt: "2026-01-01T00:00:00.000Z",
      groups: [
        { id: "g1", name: "A", teamIds: ["t1", "t2", "t3", "t4"] },
        { id: "g2", name: "B", teamIds: ["t5", "t6", "t7", "t8"] },
      ],
    });
    let rpcName = "";
    const result = await runSetupMutation({
      method: "groups.replace",
      commandName: "groups.replace",
      tournamentId: "tt-groups",
      expectedTournamentVersion: 5,
      idempotencyKey: "groups-2",
      generatedAt: "2026-01-01T00:00:00.000Z",
      rulesVersion: "rules@1",
      payload: attachSnapshotPackageToPayload(
        {
          groups: [
            { id: "g1", name: "A", teamIds: ["t1", "t2", "t3", "t4"] },
            { id: "g2", name: "B", teamIds: ["t5", "t6", "t7", "t8"] },
          ],
        },
        snapshot
      ),
      engineInput: {},
      engineOutput: {},
      confirmed: true,
      envSource: GATE_ON,
      dataMode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
      repository: {
        executeSetupMutation: async ({ rpcName: name, envelope }) => {
          rpcName = name;
          assert.equal(name, "team_tournament_replace_groups");
          assert.match(envelope.payloadHash, /^[a-f0-9]{64}$/);
          return { ok: true, version: 6, data: { snapshot: null } };
        },
      },
    });
    assert.equal(result.ok, true);
    assert.equal(rpcName, "team_tournament_replace_groups");
    assert.equal(result.rpcCalled, true);
  });
});

describe("TT32 fixture registry", () => {
  it("defines 32 athletes with balanced ratings and staging emails", () => {
    assert.equal(TT_V6_TT32_ATHLETES.length, 32);
    assert.equal(TT_V6_TT32_MALE_ATHLETES.length, 16);
    assert.equal(TT_V6_TT32_FEMALE_ATHLETES.length, 16);
    assert.equal(TT_V6_TT32_RATINGS.length, 16);
    assert.equal(TT_V6_TT32_FIXTURE.clubId, "club-test-tt32-qa");
    assert.equal(TT_V6_TT32_FIXTURE.clubName, "CLB TEST TT32");
    assert.match(TT_V6_TT32_FIXTURE.marker, /QA\|TT-V6\|TT32/);
    for (const row of TT_V6_TT32_ATHLETES) {
      assert.match(row.email, /@staging\.local$/);
      assert.ok(Number.isFinite(row.rating));
      assert.ok(row.rating >= 3.0 && row.rating <= 4.5);
    }
    assert.deepEqual(
      TT_V6_TT32_MALE_ATHLETES.map((r) => r.rating),
      TT_V6_TT32_FEMALE_ATHLETES.map((r) => r.rating)
    );
  });
});
