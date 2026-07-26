/**
 * COACHING-04 — PLAYER self-scope & durable cutover focused tests.
 * No SQL apply. No DB writes. No file deletion.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { PLAYER_IDENTITY_MAPPING_STATUS } from "../src/features/player/constants/identityMapping.js";
import {
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
  COACHING_04_PLAYER_SELF_SCOPE_STATUS,
  COACHING_04_PLAYER_SELF_PERMISSION_IDS,
  COACHING_RUNTIME_MODE,
  COACHING_RUNTIME_ERROR_CODES,
  COACHING_PLAYER_SCOPE_STATE,
  createCoachingRuntime,
  resolveCoachingPlayerSelfScope,
  classifyCoachingDurableCollectionResult,
  assertCoachingPlayerDurableWriteAllowed,
  getCoachingLegacyIsolationContract,
  emitCoachingLegacyTelemetry,
} from "../src/features/coaching/runtime/index.js";
import {
  COACHING_PERMISSION_MANIFEST,
  COACHING_04_PLAYER_SELF_PERMISSION_VALUES,
} from "../src/features/coaching/constants/permissions.js";
import { COACHING_04_PLAYER_SELF_ACTIONS } from "../src/features/coaching/constants/actions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACK = path.join(ROOT, "docs/coaching-training/coaching-04");

function readPack(name) {
  return readFileSync(path.join(PACK, name), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("COACHING-04 PLAYER self-scope package presence", () => {
  test("player helper/rls/manifest exist", () => {
    for (const file of [
      "11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql",
      "21_COACHING_04_PLAYER_SELF_SCOPE_RLS.sql",
      "sql-migration-manifest.json",
    ]) {
      assert.ok(existsSync(path.join(PACK, file)), file);
    }
  });

  test("status authored awaiting staging GO; durable default guarded", () => {
    assert.equal(
      COACHING_04_PLAYER_SELF_SCOPE_STATUS,
      "COACHING_04_PLAYER_SELF_SCOPE_AUTHORED_AWAITING_STAGING_GO"
    );
    assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
    assert.equal(LOCALSTORAGE_RETIRED, false);
    assert.equal(COACHING_PERMISSION_MANIFEST.playerSelfScopeBlocked, false);
    assert.equal(
      COACHING_PERMISSION_MANIFEST.coaching04.playerSelfScopeStatus,
      COACHING_04_PLAYER_SELF_SCOPE_STATUS
    );
    assert.equal(
      COACHING_PERMISSION_MANIFEST.coaching04.playerMutationAuthorized,
      false
    );
  });
});

describe("COACHING-04 PLAYER SQL contracts", () => {
  test("helpers bind PM-ID-01 and forbid principal spoof args", () => {
    const helpers = stripSqlComments(
      readPack("11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql")
    );
    assert.match(helpers, /coaching_04_mapped_player_id/);
    assert.match(helpers, /player_identity_resolve_mapping/);
    assert.match(helpers, /player_identity_is_mapped/);
    assert.match(helpers, /SET search_path = public, pg_temp/);
    assert.match(helpers, /REVOKE ALL ON FUNCTION public\.coaching_04_mapped_player_id/);
    assert.doesNotMatch(helpers, /p_principal_id|p_auth_user_id/);
    assert.doesNotMatch(helpers, /profiles\.player_id/);
    assert.doesNotMatch(helpers, /auth\.uid\(\)\s*=\s*player_id/);
    assert.doesNotMatch(helpers, /USING\s*\(\s*true\s*\)/i);
    // p_player_id is allowed only as a comparison target (is_self), never as caller identity.
    assert.match(helpers, /coaching_04_player_is_self\(\s*p_player_id text/);
  });

  test("PLAYER RLS is SELECT-only self-scope; no open policies", () => {
    const rls = stripSqlComments(
      readPack("21_COACHING_04_PLAYER_SELF_SCOPE_RLS.sql")
    );
    assert.match(rls, /coaching_04_player_enrollments_select/);
    assert.match(rls, /coaching\.self\.read/);
    assert.match(rls, /coaching_04_player_is_self/);
    assert.match(rls, /FORCE ROW LEVEL SECURITY/);
    assert.doesNotMatch(rls, /FOR INSERT|FOR UPDATE|FOR DELETE/i);
    assert.doesNotMatch(rls, /USING\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(rls, /WITH CHECK\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(rls, /auth\.uid\(\)\s*=\s*player_id/);
  });

  test("grants seed coaching.self.read for PLAYER only; no records.read", () => {
    const proposal = stripSqlComments(
      readPack("40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql")
    );
    assert.match(proposal, /coaching\.self\.read/);
    assert.match(proposal, /role_id = 'PLAYER'|SELECT 'PLAYER'/);
    assert.doesNotMatch(
      proposal,
      /INSERT INTO public\.role_permissions[\s\S]{0,400}coaching\.records\.read/
    );
    assert.deepEqual([...COACHING_04_PLAYER_SELF_PERMISSION_IDS], [
      "coaching.self.read",
    ]);
    assert.deepEqual([...COACHING_04_PLAYER_SELF_PERMISSION_VALUES], [
      "coaching.self.read",
    ]);
    assert.equal(
      COACHING_04_PLAYER_SELF_ACTIONS.SELF_READ,
      "coaching.self.read"
    );
  });

  test("rollback covers player helpers/policies and is not auto-executed", () => {
    const rollback = readPack("90_COACHING_04_ROLLBACK.sql");
    assert.match(rollback, /NEVER auto-executed|Not auto-executed/i);
    assert.match(rollback, /coaching_04_mapped_player_id/);
    assert.match(rollback, /coaching_04_player_enrollments_select/);
    assert.match(rollback, /coaching\.self\.read/);
    assert.doesNotMatch(stripSqlComments(rollback), /DROP TABLE public\.coaching_/);
  });

  test("manifest has deterministic order; no production / no auto rollback", () => {
    const manifest = JSON.parse(readPack("sql-migration-manifest.json"));
    assert.equal(manifest.executeSql, false);
    assert.equal(manifest.automaticRollback, false);
    assert.equal(manifest.productionApplyApproved, false);
    assert.equal(manifest.durableRuntimeDefault, false);
    assert.equal(manifest.playerMutationPoliciesIncluded, false);
    assert.deepEqual(manifest.forwardExecutionOrder, [
      "docs/coaching-training/coaching-04/10_COACHING_04_ASSIGNMENT_HELPERS.sql",
      "docs/coaching-training/coaching-04/11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql",
      "docs/coaching-training/coaching-04/20_COACHING_04_ASSIGNMENT_RLS.sql",
      "docs/coaching-training/coaching-04/21_COACHING_04_PLAYER_SELF_SCOPE_RLS.sql",
      "docs/coaching-training/coaching-04/30_COACHING_04_SCOPED_RPCS.sql",
      "docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql",
    ]);
    assert.ok(
      !manifest.forwardExecutionOrder.includes(
        "docs/coaching-training/coaching-04/90_COACHING_04_ROLLBACK.sql"
      )
    );
  });

  test("verification expects player helpers and PM-ID-01 dependency", () => {
    const verification = readPack("99_COACHING_04_VERIFICATION.sql");
    assert.match(verification, /coaching_04_mapped_player_id/);
    assert.match(verification, /player_identity_resolve_mapping/);
    assert.match(verification, /bare TRUE|USING\/CHECK true|qual.*true/i);
    assert.match(verification, /FORCE|rls_forced/i);
  });
});

describe("COACHING-04 PLAYER runtime mapping fail-closed", () => {
  test("MAPPED PLAYER self-read ok", async () => {
    const result = await resolveCoachingPlayerSelfScope({
      tenantId: "tenant-1",
      clubId: "club-1",
      resolveMapping: async () => ({
        status: PLAYER_IDENTITY_MAPPING_STATUS.MAPPED,
        playerId: "player-1",
        tenantId: "tenant-1",
        clubId: "club-1",
        reasonCode: "OK",
      }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.state, COACHING_PLAYER_SCOPE_STATE.LIVE);
    assert.equal(result.playerId, "player-1");
  });

  test("UNMAPPED fail closed", async () => {
    const result = await resolveCoachingPlayerSelfScope({
      tenantId: "tenant-1",
      clubId: "club-1",
      resolveMapping: async () => ({
        status: PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED,
        playerId: null,
        reasonCode: "NO_LINK",
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.state, COACHING_PLAYER_SCOPE_STATE.UNMAPPED);
    assert.equal(result.playerId, null);
  });

  test("INACTIVE fail closed", async () => {
    const result = await resolveCoachingPlayerSelfScope({
      tenantId: "t",
      clubId: "c",
      resolveMapping: async () => ({
        status: PLAYER_IDENTITY_MAPPING_STATUS.INACTIVE,
        playerId: null,
        reasonCode: "LINK_REVOKED",
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.state, COACHING_PLAYER_SCOPE_STATE.INACTIVE);
  });

  test("AMBIGUOUS fail closed", async () => {
    const result = await resolveCoachingPlayerSelfScope({
      tenantId: "t",
      clubId: "c",
      resolveMapping: async () => ({
        status: PLAYER_IDENTITY_MAPPING_STATUS.AMBIGUOUS,
        playerId: null,
        reasonCode: "MULTIPLE_ACTIVE_LINKS",
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.state, COACHING_PLAYER_SCOPE_STATE.AMBIGUOUS);
  });

  test("wrong tenant/club missing scope denied", async () => {
    const result = await resolveCoachingPlayerSelfScope({
      tenantId: "",
      clubId: "club-1",
    });
    assert.equal(result.ok, false);
    assert.equal(result.state, COACHING_PLAYER_SCOPE_STATE.INVALID);
    assert.equal(result.error.code, COACHING_RUNTIME_ERROR_CODES.MISSING_SCOPE);
  });

  test("PLAYER cannot spoof principal_id/player_id", async () => {
    const result = await resolveCoachingPlayerSelfScope({
      tenantId: "t",
      clubId: "c",
      principalId: "spoof",
      playerId: "other-player",
    });
    assert.equal(result.ok, false);
    assert.equal(result.state, COACHING_PLAYER_SCOPE_STATE.FORBIDDEN);
    assert.equal(
      result.error.code,
      COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED
    );
  });

  test("PLAYER cannot read another player — self check uses mapped id only", async () => {
    const mapped = await resolveCoachingPlayerSelfScope({
      tenantId: "t",
      clubId: "c",
      resolveMapping: async () => ({
        status: PLAYER_IDENTITY_MAPPING_STATUS.MAPPED,
        playerId: "player-self",
        reasonCode: "OK",
      }),
    });
    assert.equal(mapped.playerId, "player-self");
    assert.notEqual(mapped.playerId, "player-other");
    const rls = readPack("21_COACHING_04_PLAYER_SELF_SCOPE_RLS.sql");
    assert.match(rls, /coaching_04_player_is_self\(player_id\)/);
  });

  test("durable ERROR remains ERROR; EMPTY remains EMPTY", () => {
    const err = classifyCoachingDurableCollectionResult(
      { ok: false, code: "DURABLE_UNAVAILABLE" },
      { ok: true }
    );
    assert.equal(err.state, COACHING_PLAYER_SCOPE_STATE.ERROR);
    assert.equal(err.empty, false);

    const empty = classifyCoachingDurableCollectionResult(
      { ok: true, data: [] },
      { ok: true }
    );
    assert.equal(empty.state, COACHING_PLAYER_SCOPE_STATE.EMPTY);
    assert.equal(empty.empty, true);
  });

  test("no localStorage silent-success on durable failure", async () => {
    globalThis.__COACHING_LEGACY_TELEMETRY__ = [];
    const runtime = createCoachingRuntime({
      mode: COACHING_RUNTIME_MODE.DURABLE,
      resolveTenantClub: () => ({ tenantId: "t", clubId: "c" }),
      resolveActor: () => ({ actorId: "actor-1" }),
      // missing databaseClient / applicationService → durable adapter fail-closed
    });
    const result = await runtime.listCollection("packages", "c");
    assert.equal(result.ok, false);
    assert.notEqual(runtime.mode, COACHING_RUNTIME_MODE.LEGACY);
    assert.ok(
      globalThis.__COACHING_LEGACY_TELEMETRY__.some(
        (e) => e.event === "silent_fallback_blocked"
      )
    );
    delete globalThis.__COACHING_LEGACY_TELEMETRY__;
  });

  test("PLAYER durable write fail closed", () => {
    const denied = assertCoachingPlayerDurableWriteAllowed({
      ok: true,
      playerId: "p1",
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED);
  });

  test("requirePlayerSelfScope UNMAPPED denies durable list", async () => {
    const runtime = createCoachingRuntime({
      mode: COACHING_RUNTIME_MODE.DURABLE,
      resolveTenantClub: () => ({ tenantId: "t", clubId: "c" }),
      resolveActor: () => ({ actorId: "a1" }),
      requirePlayerSelfScope: true,
      resolvePlayerSelfScope: async () => ({
        ok: false,
        state: COACHING_PLAYER_SCOPE_STATE.UNMAPPED,
        status: PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED,
        playerId: null,
        error: {
          ok: false,
          code: COACHING_RUNTIME_ERROR_CODES.PLAYER_SELF_SCOPE_BLOCKED,
          error: "UNMAPPED",
        },
      }),
    });
    const result = await runtime.listCollection("packages", "c");
    assert.equal(result.ok, false);
    assert.equal(
      result.code,
      COACHING_RUNTIME_ERROR_CODES.PLAYER_SELF_SCOPE_BLOCKED
    );
  });
});

describe("COACHING-04 coach assignment still present + safety", () => {
  test("coach helpers still authored", () => {
    const helpers = readPack("10_COACHING_04_ASSIGNMENT_HELPERS.sql");
    assert.match(helpers, /coaching_04_active_coach_reference_id/);
    assert.match(helpers, /coach_principal_id = auth\.uid\(\)::text/);
  });

  test("legacy isolation contract; telemetry event shape", () => {
    const contract = getCoachingLegacyIsolationContract();
    assert.equal(contract.retired, false);
    assert.equal(contract.silentSuccessOnDurableFailure, false);
    assert.equal(contract.implementationPresent, true);
    const event = emitCoachingLegacyTelemetry("club-x", "legacy_read");
    assert.equal(event.silentFallback, false);
  });

  test("docs declare no Production target / no auto-apply", () => {
    const scope = readPack("00_COACHING_04_SCOPE_AND_SECURITY_MODEL.md");
    assert.match(scope, /COACHING_04_OWNER_GO_APPLY_STAGING/);
    assert.match(scope, /do not apply SQL|Forbidden without/i);
    assert.match(scope, /Production/);
    const rollback = readPack("90_COACHING_04_ROLLBACK.sql");
    assert.match(rollback, /NEVER auto-executed|Not auto-executed/i);
  });
});
