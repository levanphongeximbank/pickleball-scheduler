/**
 * TEAM-TOURNAMENT-STAGING-ACCEPTANCE-REMEDIATION-01
 *
 * B01: canonical + header name sync (header PK independent)
 * B02: opaque Owner pairing runtime (no secret disclosure, rules still enforced)
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ROLES, normalizeRole } from "../src/features/identity/constants/roles.js";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import { getPermissionsForRole } from "../src/features/identity/matrix/rolePermissions.js";
import { PRIVATE_PAIRING_PR4_FIXTURE } from "../src/features/private-pairing-rules/testing/pr4SecurityFixture.js";
import { canViewPrivatePairingRules } from "../src/features/private-pairing-rules/ui/privatePairingPermissions.js";
import { PRIVATE_PAIRING_RPC } from "../src/features/private-pairing-rules/constants/dbCodes.js";
import { formTeamTournamentPairingOpaque } from "../src/features/team-tournament/services/opaqueTeamFormationRuntime.js";
import { generateMlpTeamFormationCandidatePool } from "../src/features/team-tournament/engines/teamAutoDrawEngine.js";
import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const pkg = join(
  ROOT,
  "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01"
);

const LOCKED = Object.freeze({
  "01_PRECHECK.sql": "d5dd6cd52251e4e489e3e6742db9208ec04799dd0f403d03dceb21c0ff92a10a",
  "02_APPLY.sql": "b6f50955565d2512554d06e2f39261a3f3bbda3abe375ca6d865b6d243469555",
  "03_VERIFY.sql": "34bf83354e59ed550c7d3b1b13aa9059b095f654c2917666a6dd5856b649e805",
  "04_ROLLBACK.sql": "46980f70046fdd7b1d4ca0121574566740db399f26807841372b2bb8acac67e0",
});

function sha256(rel) {
  const text = readFileSync(join(pkg, rel), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function readSrc(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function mlpPlayers(count = 8) {
  const players = [];
  for (let i = 1; i <= count / 2; i += 1) {
    players.push({ id: `m${i}`, name: `Nam ${i}`, gender: "male", rating: 4 + i / 10 });
    players.push({ id: `f${i}`, name: `Nu ${i}`, gender: "female", rating: 4 + i / 10 });
  }
  return players;
}

describe("team-tournament-staging-acceptance-remediation-01 package", () => {
  it("locked SHA256 fingerprints match package files", () => {
    for (const [file, expected] of Object.entries(LOCKED)) {
      assert.equal(sha256(file), expected, file);
    }
  });

  it("B01 identity is canonical.id = header.tournament_id, header PK independent", () => {
    const apply = readSrc(
      "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01/02_APPLY.sql"
    );
    const create = readSrc(
      "docs/v5/migrations/team-tournament-canonical-dashboard-lifecycle-01/02_APPLY.sql"
    );
    assert.match(apply, /team_tournament_rename/);
    assert.match(apply, /t\.id::text = v_header\.tournament_id/);
    assert.match(apply, /tt\.tournament_id = NEW\.id::text/);
    assert.doesNotMatch(
      apply,
      /where\s+t\.id\s*=\s*v_header\.id|canonical_tournaments\.id\s*=\s*team_tournaments\.id(?!\s*;)/
    );
    assert.match(create, /tt\.tournament_id = v_row\.id::text/);
    assert.match(apply, /trg_team_tournaments_sync_canonical_name/);
    assert.match(apply, /trg_canonical_tournaments_sync_team_header_name/);
  });

  it("B01 rename writes canonical + header in one function", () => {
    const apply = readSrc(
      "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01/02_APPLY.sql"
    );
    const renameStart = apply.indexOf("create or replace function public.team_tournament_rename");
    const renameEnd = apply.indexOf("create or replace function public.team_tournament_trg_sync_name_from_header");
    const rename = apply.slice(renameStart, renameEnd);
    assert.match(rename, /update public\.team_tournaments/);
    assert.match(rename, /update public\.canonical_tournaments/);
    assert.match(rename, /team_tournament_can_manage/);
    assert.match(rename, /team_tournament_assert_tenant/);
    assert.doesNotMatch(rename, /localStorage/);
  });

  it("create/rename/F5/dashboard/setup resolve the same synchronized name", () => {
    const apply = readSrc(
      "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01/02_APPLY.sql"
    );
    const create = readSrc(
      "docs/v5/migrations/team-tournament-canonical-dashboard-lifecycle-01/02_APPLY.sql"
    );
    const list = readSrc(
      "docs/v5/migrations/team-tournament-list-my-dashboards-01/02_APPLY.sql"
    );
    const repo = readSrc(
      "src/features/tournament/repositories/cloudTournamentRepository.js"
    );
    const setup = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
    assert.match(create, /insert into public\.canonical_tournaments/);
    assert.match(create, /insert into public\.team_tournaments/);
    assert.match(create, /v_name/);
    assert.match(create, /'name', v_header\.name/);
    assert.match(list, /tt\.name/);
    assert.match(repo, /team_tournament_rename/);
    assert.match(apply, /'canonicalName', v_canonical\.name/);
    assert.match(apply, /'headerName', v_header\.name/);
    assert.match(setup, /tournament\?\.name/);
  });

  it("B02 opaque runtime loads rules internally and never grants Owner view", () => {
    const apply = readSrc(
      "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01/02_APPLY.sql"
    );
    const verify = readSrc(
      "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01/03_VERIFY.sql"
    );
    assert.match(apply, /private_pairing_load_active_rules_internal/);
    assert.match(apply, /team_tournament_form_pairing_opaque/);
    assert.match(apply, /revoke all on function public.private_pairing_load_active_rules_internal/);
    assert.doesNotMatch(
      apply.slice(apply.indexOf("team_tournament_form_pairing_opaque")),
      /pairing\.private_rules\.view/
    );
    assert.match(apply, /NO_FEASIBLE_PAIRING/);
    assert.match(apply, /PAIRING_SEARCH_LIMIT_REACHED/);
    assert.match(apply, /PAIRING_RULE_CONSTRAINT_UNSATISFIED/);
    assert.match(verify, /internal rule loader must not be granted/);
    assert.match(verify, /Super Admin view RPC must remain permission-gated/);
  });

  it("VERIFY keeps commit_pairing and PR423 referee RPC", () => {
    const verify = readSrc(
      "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01/03_VERIFY.sql"
    );
    assert.match(verify, /team_tournament_commit_pairing/);
    assert.match(verify, /team_tournament_create_referee_assignment/);
  });

  it("PRECHECK does not couple to canonical_tournament_update signature history", () => {
    const precheck = readSrc(
      "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01/01_PRECHECK.sql"
    );
    const apply = readSrc(
      "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01/02_APPLY.sql"
    );
    const verify = readSrc(
      "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01/03_VERIFY.sql"
    );
    const rollback = readSrc(
      "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01/04_ROLLBACK.sql"
    );
    assert.doesNotMatch(precheck, /canonical_tournament_update/);
    assert.doesNotMatch(apply, /canonical_tournament_update/);
    assert.doesNotMatch(verify, /canonical_tournament_update/);
    assert.doesNotMatch(rollback, /canonical_tournament_update/);
    assert.match(precheck, /team_tournament_commit_pairing/);
    assert.match(precheck, /private_pairing_get_active_rules_for_scope/);
    assert.match(precheck, /team_tournament_rename already exists/);
    assert.match(precheck, /team_tournament_form_pairing_opaque already exists/);
  });
});

describe("Owner private-rule permission boundary", () => {
  it("VENUE_OWNER / COURT_OWNER / TENANT_OWNER do not receive private rule permissions", () => {
    const ownerRoles = [ROLES.VENUE_OWNER, ROLES.COURT_OWNER, ROLES.TENANT_OWNER];
    const forbidden = [
      PERMISSIONS.PAIRING_PRIVATE_RULES_VIEW,
      PERMISSIONS.PAIRING_PRIVATE_RULES_MANAGE,
      PERMISSIONS.PAIRING_PRIVATE_RULES_AUDIT,
      PERMISSIONS.PAIRING_PRIVATE_RULES_SIMULATE,
    ];
    for (const role of ownerRoles) {
      const perms = getPermissionsForRole(role);
      for (const permission of forbidden) {
        assert.equal(
          perms.includes(permission),
          false,
          `${normalizeRole(role)} must not have ${permission}`
        );
      }
      assert.equal(
        canViewPrivatePairingRules(
          { id: "owner", role, status: "active", permissions: perms },
          { rbacEnabled: true, envSource: { VITE_PRIVATE_PAIRING_RULES_ENABLED: "true" } }
        ),
        false
      );
    }
    const superPerms = getPermissionsForRole(ROLES.SUPER_ADMIN);
    for (const permission of forbidden) {
      assert.equal(superPerms.includes(permission), true, `SUPER_ADMIN must keep ${permission}`);
    }
    assert.equal(
      canViewPrivatePairingRules(
        { id: "sa", role: ROLES.SUPER_ADMIN, status: "active", permissions: superPerms },
        { rbacEnabled: true, envSource: { VITE_PRIVATE_PAIRING_RULES_ENABLED: "true" } }
      ),
      true
    );
    assert.equal(PRIVATE_PAIRING_PR4_FIXTURE.blockedRoles.includes("COURT_OWNER"), true);
    assert.equal(PRIVATE_PAIRING_PR4_FIXTURE.allowedRoles.includes("SUPER_ADMIN"), true);
  });
});

describe("opaque Owner pairing runtime", () => {
  it("TeamAiPairingDialog does not call Super Admin private-rule read RPC", () => {
    const dialog = readSrc("src/components/tournament/team/TeamAiPairingDialog.jsx");
    assert.match(dialog, /formTeamTournamentPairingOpaque/);
    assert.doesNotMatch(dialog, /prepareLivePrivatePairingOptions/);
    assert.doesNotMatch(dialog, /private_pairing_get_active_rules_for_scope/);
    assert.doesNotMatch(dialog, /GET_ACTIVE_FOR_SCOPE/);
    assert.match(dialog, /team_tournament_commit_pairing|onApply/);
  });

  it("VENUE_OWNER pairing service never calls private_pairing_get_active_rules_for_scope", async () => {
    const runtime = readSrc(
      "src/features/team-tournament/services/opaqueTeamFormationRuntime.js"
    );
    assert.doesNotMatch(runtime, /private_pairing_get_active_rules_for_scope/);
    assert.doesNotMatch(runtime, /prepareLivePrivatePairingOptions/);
    assert.doesNotMatch(runtime, /PRIVATE_PAIRING_RPC/);
    assert.match(runtime, /rpcTeamTournamentFormPairingOpaque/);
    assert.equal(PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE, "private_pairing_get_active_rules_for_scope");

    const players = mlpPlayers(8);
    const called = [];
    const result = await formTeamTournamentPairingOpaque({
      tournamentId: "11111111-1111-4111-8111-111111111111",
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      seed: 7,
      formPairing: async (args) => {
        called.push(args);
        return {
          ok: true,
          teams: args.candidates[0].teams,
          waitingPlayerIds: [],
          warnings: [],
          ruleSetVersion: "3",
          algorithmVersion: "tt-opaque-formation-v1",
          requestId: "req-1",
          enforced: true,
          candidateCount: args.candidates.length,
          rejectedCandidateCount: 0,
        };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(called.length, 1);
    assert.ok(Array.isArray(called[0].candidates));
    assert.ok(called[0].candidates.length >= 1);
    assert.equal(result.privatePairingMeta.ruleSetVersion, "3");
    assert.equal("rules" in (result.privatePairingMeta || {}), false);
    assert.equal("privatePairingRules" in result, false);
    assert.equal(JSON.stringify(result).includes("reason_text"), false);
  });

  it("active applicable hard rules are not silently skipped", async () => {
    const players = mlpPlayers(8);
    const result = await formTeamTournamentPairingOpaque({
      tournamentId: "11111111-1111-4111-8111-111111111111",
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      seed: 3,
      formPairing: async ({ candidates }) => {
        assert.ok(candidates.length > 0, "client must send candidates");
        return {
          ok: false,
          code: "NO_FEASIBLE_PAIRING",
        };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "NO_FEASIBLE_PAIRING");
    assert.equal(result.teams, undefined);
  });

  it("PERMISSION_DENIED is not converted to empty rules", async () => {
    const players = mlpPlayers(8);
    const result = await formTeamTournamentPairingOpaque({
      tournamentId: "11111111-1111-4111-8111-111111111111",
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      formPairing: async () => ({ ok: false, code: "PERMISSION_DENIED" }),
    });
    assert.equal(result.ok, false);
    assert.notEqual(result.code, "OK");
    assert.equal(Array.isArray(result.teams) && result.teams.length > 0, false);
  });

  it("missing opaque RPC fails closed without local empty-rule pairing", async () => {
    const players = mlpPlayers(8);
    const result = await formTeamTournamentPairingOpaque({
      tournamentId: "11111111-1111-4111-8111-111111111111",
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      formPairing: async () => ({ ok: false, code: "RPC_MISSING" }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "RPC_MISSING");
    assert.match(result.message, /không bỏ qua quy tắc riêng/i);
  });

  it("candidate pool generates without private rule payloads", () => {
    const players = mlpPlayers(8);
    const generated = generateMlpTeamFormationCandidatePool({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      seed: 11,
      requireFullFill: true,
    });
    assert.equal(generated.ok, true);
    assert.ok(generated.candidates.length >= 1);
    const blob = JSON.stringify(generated);
    assert.equal(blob.includes("reason_text"), false);
    assert.equal(blob.includes("must_not_partner"), false);
  });
});

describe("SUPER_ADMIN private rules paths remain", () => {
  it("admin repository and menu still use view RPC / permission", () => {
    const repo = readSrc(
      "src/features/private-pairing-rules/repository/privatePairingRulesRepository.js"
    );
    const menu = readSrc("src/features/canonical-shell/config/canonicalMenuData.js");
    const sql = readSrc("docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql");
    const dbCodes = readSrc(
      "src/features/private-pairing-rules/constants/dbCodes.js"
    );
    assert.match(repo, /GET_ACTIVE_FOR_SCOPE/);
    assert.match(dbCodes, /private_pairing_get_active_rules_for_scope/);
    assert.equal(PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE, "private_pairing_get_active_rules_for_scope");
    assert.match(menu, /pairing\.private_rules\.view/);
    assert.match(sql, /pairing\.private_rules\.view/);
    assert.match(sql, /private_pairing_get_active_rules_for_scope/);
  });
});

describe("canonical pairing persistence remains fail-closed", () => {
  it("commit_pairing is the sole confirm writer; no save_team / replace_groups fallback", () => {
    const persist = readSrc(
      "src/features/team-tournament/services/aiPairingCloudPersistence.js"
    );
    const dialog = readSrc("src/components/tournament/team/TeamAiPairingDialog.jsx");
    assert.match(persist, /team_tournament_commit_pairing/);
    assert.match(persist, /FAIL CLOSED|fail closed|RPC_MISSING/i);
    assert.doesNotMatch(persist, /save_team\(|rpcTeamTournamentSaveTeam|replace_groups\(|groups\.replace/);
    assert.equal(persist.includes("replace_groups"), false);
    assert.equal(persist.includes("groups.replace"), false);
    assert.match(dialog, /onApply/);
    assert.match(dialog, /formTeamTournamentPairingOpaque/);
  });

  it("header ensure is not name authority on update", () => {
    const sync = readSrc(
      "src/features/team-tournament/services/teamTournamentCloudSync.js"
    );
    assert.match(sync, /team_tournament_rename/);
    assert.match(sync, /Existing rows keep name/);
    assert.doesNotMatch(
      sync,
      /name: String\(tournament\?\.name \|\| "Giải đồng đội"\)\.trim\(\),\s*status/
    );
  });
});

describe("PR412/416/417/418/423 regression locks", () => {
  it("PR412 captain confirm + commit_pairing remain", () => {
    const persist = readSrc(
      "src/features/team-tournament/services/aiPairingCloudPersistence.js"
    );
    const dialog = readSrc("src/components/tournament/team/TeamAiPairingDialog.jsx");
    assert.match(persist, /commitPairing/);
    assert.match(dialog, /team-ai-pairing-captain-confirm-cta/);
  });

  it("PR416/417 create + pairing identity remain tournament_id keyed", () => {
    const create = readSrc(
      "docs/v5/migrations/team-tournament-canonical-dashboard-lifecycle-01/02_APPLY.sql"
    );
    const post417 = readSrc(
      "docs/v5/migrations/team-tournament-post417-regression-closure-01/02_APPLY.sql"
    );
    assert.match(create, /team_tournament_create/);
    assert.match(create, /tournament_id/);
    assert.match(post417, /team_tournament_commit_pairing/);
  });

  it("PR418 / PR423 referee foundation RPCs are not dropped by rollback", () => {
    const rollback = readSrc(
      "docs/v5/migrations/team-tournament-staging-acceptance-remediation-01/04_ROLLBACK.sql"
    );
    const referee = readSrc(
      "docs/v5/migrations/team-tournament-production-referee-foundation-01/02_APPLY.sql"
    );
    assert.doesNotMatch(rollback, /drop function if exists public\.team_tournament_create_referee_assignment/);
    assert.doesNotMatch(rollback, /drop table .*referee_assignments/);
    assert.match(referee, /team_tournament_create_referee_assignment/);
  });
});
