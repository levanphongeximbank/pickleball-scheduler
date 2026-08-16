/**
 * Team Tournament Canonical Adapter ĐẦU B — 16-boundary adoption.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMPETITION_COURT_ADAPTER_CONTRACT_NAME,
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
} from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  createCompetitionRefereeAdapterRegistry,
  runCompetitionRefereeAdapterConformance,
} from "../src/features/competition-engine/integration/referee/index.js";
import {
  PRODUCTION_BINDING_STATUS,
  SHARED_ADAPTER_ERROR_CODE,
  isCompetitionAdapterContractError,
  runCompetitionAdapterConformance,
  WORKSTREAM_CONTRACT_DEFINITIONS,
} from "../src/features/competition-engine/integration/contracts/index.js";
import {
  TEAM_ADAPTER_B_CATALOG,
  buildTeamAdapterBMatrix,
  createTeamTournamentAdapterBRegistry,
  createTeamTournamentCourtAdapter,
  createTeamTournamentRankingAdapter,
  createTeamTournamentRatingAdapter,
  createTeamTournamentRefereeAdapter,
  readTeamRatingValue,
} from "../src/features/team-tournament/adapters/canonical/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relative) {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

function listJs(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJs(absolute);
    return entry.isFile() && /\.(js|jsx)$/.test(entry.name) ? [absolute] : [];
  });
}

function expectCode(fn, code) {
  try {
    const value = fn();
    if (value && typeof value.then === "function") {
      return value.then(
        () => {
          assert.fail(`expected ${code}`);
        },
        (err) => {
          assert.equal(isCompetitionAdapterContractError(err), true);
          assert.equal(err.code, code);
        }
      );
    }
    assert.fail(`expected ${code}`);
  } catch (err) {
    assert.equal(isCompetitionAdapterContractError(err), true);
    assert.equal(err.code, code);
  }
}

const VALID_CTX = Object.freeze({
  contractVersion: "1.0.0",
  tenantId: "tenant-1",
  competitionId: "comp-1",
  actorId: "actor-1",
  correlationId: "corr-1",
  participantId: "player-1",
  clubId: "club-1",
  matchId: "match-1",
  idempotencyKey: "idem-1",
  role: "TOURNAMENT_DIRECTOR",
});

test("all 16 Team Adapter B boundaries are represented", () => {
  assert.equal(TEAM_ADAPTER_B_CATALOG.length, 16);
  const registry = createTeamTournamentAdapterBRegistry({
    boundTenantId: "tenant-1",
  });
  const matrix = buildTeamAdapterBMatrix(registry);
  assert.equal(matrix.ALL_16_TEAM_B_BOUNDARIES_REPRESENTED, "YES");
  assert.equal(registry.list().length, 16);
  for (const row of matrix.rows) {
    assert.equal(row.adapterBReady, true, row.adapterBName);
    assert.equal(row.ownsAuthority, false, row.adapterBName);
    assert.equal(row.notConfiguredFakeSuccess, false, row.adapterBName);
  }
  assert.equal(matrix.required.length, 6);
  assert.equal(matrix.conditional.length, 3);
  assert.equal(matrix.optional.length, 5);
  assert.equal(matrix.notRequired.length, 2);
});

test("Court and Referee adapters keep End A identities", () => {
  const court = createTeamTournamentCourtAdapter();
  assert.equal(court.adapterBName, "TeamTournamentCourtAdapter");
  assert.equal(court.contractName, COMPETITION_COURT_ADAPTER_CONTRACT_NAME);
  assert.equal(court.contractVersion, COMPETITION_COURT_ADAPTER_CONTRACT_VERSION);
  assert.equal(typeof court.listEligibleCourts, "function");
  assert.equal(typeof court.validateMatchAssignment, "function");

  const referee = createTeamTournamentRefereeAdapter();
  assert.equal(referee.adapterBName, "TeamTournamentRefereeAdapter");
  assert.equal(referee.contractId, COMPETITION_REFEREE_ADAPTER_CONTRACT_ID);
  assert.equal(referee.competitionMode, "TEAM");
  assert.equal(referee.ownsScoringAuthority, false);
  assert.equal(referee.ownsResultAuthority, false);
  assert.equal(referee.ownsRefereeIdentity, false);
});

test("Referee adapter passes runCompetitionRefereeAdapterConformance", () => {
  const adapter = createTeamTournamentRefereeAdapter();
  const registry = createCompetitionRefereeAdapterRegistry({ adapters: [adapter] });
  const result = runCompetitionRefereeAdapterConformance(adapter, { registry });
  assert.equal(result.ok, true, JSON.stringify(result.results.filter((row) => !row.ok)));
});

test("optional/not-required adapters fail closed instead of empty success", async () => {
  const registry = createTeamTournamentAdapterBRegistry({ boundTenantId: "tenant-1" });
  const finance = registry.get(9);
  const federation = registry.get(13);
  const fileMedia = registry.get(11);
  assert.equal(finance.activation, false);
  assert.equal(federation.activation, false);
  assert.equal(fileMedia.activation, false);
  await expectCode(
    () => finance.getEntryFeeStatus(VALID_CTX),
    SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED
  );
  await expectCode(
    () => federation.getSanctionEvidence(VALID_CTX),
    SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED
  );
  await expectCode(
    () => fileMedia.getDocumentReference(VALID_CTX),
    SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED
  );
});

test("rating adapter does not invent a default when runtime is missing", async () => {
  const adapter = createTeamTournamentRatingAdapter({
    tournament: { settings: { eligibilityRules: { skill: { enabled: true } } } },
  });
  assert.equal(adapter.activation, true);
  assert.equal(adapter.sharedRuntime, PRODUCTION_BINDING_STATUS.NOT_CONFIGURED);
  await expectCode(
    () => adapter.getRatingSnapshot(VALID_CTX),
    SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED
  );
  assert.equal(readTeamRatingValue({ rating: 4.2 }), 4.2);
  assert.throws(() =>
    readTeamRatingValue({
      canonicalRatingEvidence: { status: "NOT_CONFIGURED", failClosed: true },
    })
  );
});

test("ranking adapter refuses to close Team Tournament", () => {
  const adapter = createTeamTournamentRankingAdapter({
    rankingEnabled: true,
  });
  assert.equal(adapter.controlsTeamLifecycle, false);
  assert.throws(() =>
    adapter.projectAcceptedTeamResult({
      id: "tt-1",
      mode: "team_tournament",
      status: "active",
      teamData: {},
    })
  );
});

test("VPR bridge cannot complete a Team Tournament", () => {
  const src = read("src/features/vpr-ranking/services/vprTournamentBridge.js");
  assert.match(src, /RANKING_MUST_NOT_CLOSE_TEAM_TOURNAMENT/);
  const panel = read("src/features/vpr-ranking/components/TournamentVprPanel.jsx");
  assert.match(panel, /isTeamTournamentMode\(tournament\)/);
  assert.match(panel, /Đóng giải thuộc Team Competition/);
});

test("identity adapter rejects name/email as actor authority", async () => {
  const registry = createTeamTournamentAdapterBRegistry({ boundTenantId: "tenant-1" });
  const identity = registry.get(1);
  await expectCode(
    () =>
      identity.resolveActorIdentity({
        ...VALID_CTX,
        actorId: "person@example.com",
      }),
    SHARED_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN
  );
});

test("tenant adapter keeps scope ids distinct", () => {
  const tenant = createTeamTournamentAdapterBRegistry({
    boundTenantId: "tenant-1",
  }).get(2);
  assert.equal(typeof tenant.distinguishScopeIds, "function");
  const setup = read(
    "src/features/team-tournament/services/teamTournamentCourtResourceSetupService.js"
  );
  assert.doesNotMatch(setup, /tenantId \|\| .*venueId|venueId \|\| .*tenantId/);
  const panel = read("src/components/tournament/team/TeamFormatVenueSetupPanel.jsx");
  assert.doesNotMatch(panel, /tournament\?\.tenantId \|\| tournament\?\.venueId/);
});

test("mode-owned contracts still pass shared conformance when bound", async () => {
  const registry = createTeamTournamentAdapterBRegistry({
    boundTenantId: "tenant-1",
    getPlayerProfile: (playerId) => ({
      outcome: "MAPPED",
      playerId,
      profile: { playerId, displayName: "A" },
    }),
  });
  const identity = registry.get(1);
  const def = WORKSTREAM_CONTRACT_DEFINITIONS.find(
    (item) => item.contractId === identity.contractId
  );
  const result = await runCompetitionAdapterConformance(identity, def, {
    validContext: VALID_CTX,
  });
  assert.equal(result.ok, true, JSON.stringify(result.results.filter((row) => !row.ok)));
});

test("static architecture: Team B does not import CourtResourceGateway or local cluster registry", () => {
  const files = [
    "src/features/team-tournament/adapters/canonical/TeamTournamentCourtAdapter.js",
    "src/features/team-tournament/services/teamTournamentCourtResourceSetupService.js",
    "src/components/tournament/team/TeamFormatVenueSetupPanel.jsx",
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /from ["'].*courtResourceGateway/);
    assert.doesNotMatch(source, /courtClusterService/);
    assert.doesNotMatch(source, /from ["'].*court-resource\/services\/courtResourceGateway/);
  }
  const engines = [
    "src/features/team-tournament/engines/eligibilityEngine.js",
    "src/features/team-tournament/engines/teamGroupSeedEngine.js",
    "src/features/team-tournament/engines/teamAutoDrawEngine.js",
  ];
  for (const file of engines) {
    assert.doesNotMatch(read(file), /getPlayerRatingInternal/);
  }
});

test("Team Adapter B area does not modify End A contract files", () => {
  const canonicalDir = path.join(
    ROOT,
    "src/features/team-tournament/adapters/canonical"
  );
  for (const file of listJs(canonicalDir)) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /COMPETITION_COURT_ADAPTER_CONTRACT_VERSION\s*=/);
    assert.doesNotMatch(source, /contractId:\s*"competition\.identity-access\.adapter\.v1"/);
  }
});
