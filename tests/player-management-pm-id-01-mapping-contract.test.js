/**
 * PM-ID-01 — Canonical principal→player mapping contract tests.
 * Covers result statuses, security fail-closed, constraints semantics,
 * SQL package static checks, JS exports, and COACHING-04 blocker regression.
 * No Staging apply. No DB writes.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import * as playerPublicApi from "../src/features/player/index.js";
import {
  PLAYER_IDENTITY_MAPPING_STATUS,
  PLAYER_IDENTITY_LINK_LIFECYCLE,
  PLAYER_IDENTITY_REASON_CODE,
  resolveAuthenticatedCanonicalPlayerMapping,
  evaluatePlayerIdentityMappingScope,
  validatePlayerIdentityMappingResult,
  buildPlayerIdentityMappingResult,
  createMemoryPlayerIdentityLinkRepository,
  createSupabasePlayerIdentityLinkAdapter,
  RESOLUTION_OUTCOME,
  resolveByAuthUser,
} from "../src/features/player/index.js";
import { COACHING_04_PLAYER_SELF_SCOPE_STATUS } from "../src/features/coaching/runtime/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACK = path.join(ROOT, "docs/player-management/pm-id-01");

function readPack(name) {
  return readFileSync(path.join(PACK, name), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

const PRINCIPAL = "11111111-1111-1111-1111-111111111111";
const TENANT = "venue-1";
const CLUB = "club-1";
const PLAYER = "player-auth-11111111-1111-1111-1111-111111111111";

function baseSeed(overrides = {}) {
  return {
    clubs: { [CLUB]: TENANT, ...(overrides.clubs || {}) },
    memberships: overrides.memberships || [
      { tenantId: TENANT, clubId: CLUB, userId: PRINCIPAL, status: "active" },
    ],
    links: overrides.links || [],
  };
}

async function resolveWith(seed, input = {}) {
  const repository = createMemoryPlayerIdentityLinkRepository(baseSeed(seed));
  return resolveAuthenticatedCanonicalPlayerMapping({
    tenantId: TENANT,
    clubId: CLUB,
    repository,
    getSessionUserId: () => PRINCIPAL,
    ...input,
  });
}

describe("PM-ID-01 package presence", () => {
  test("required docs and SQL files exist", () => {
    const required = [
      "00_PM_ID_01_EXECUTIVE_SUMMARY.md",
      "01_PM_ID_01_SOURCE_OF_TRUTH_AUDIT.md",
      "02_PM_ID_01_CANONICAL_MAPPING_CONTRACT.md",
      "03_PM_ID_01_SECURITY_AND_TENANT_MODEL.md",
      "04_PM_ID_01_BACKFILL_AND_AMBIGUITY_POLICY.md",
      "05_PM_ID_01_COACHING_CONSUMER_HANDOFF.md",
      "10_PM_ID_01_MAPPING_TABLE.sql",
      "20_PM_ID_01_CONSTRAINTS_AND_INDEXES.sql",
      "30_PM_ID_01_RESOLUTION_HELPERS.sql",
      "40_PM_ID_01_MAPPING_MANAGEMENT_RPCS.sql",
      "50_PM_ID_01_RLS_AND_GRANTS.sql",
      "90_PM_ID_01_ROLLBACK.sql",
      "99_PM_ID_01_VERIFICATION.sql",
    ];
    for (const name of required) {
      assert.equal(existsSync(path.join(PACK, name)), true, `missing ${name}`);
    }
  });
});

describe("A. Mapping result statuses", () => {
  test("one active mapping → MAPPED with playerId", async () => {
    const result = await resolveWith({
      links: [
        {
          linkId: "l1",
          tenantId: TENANT,
          clubId: CLUB,
          principalId: PRINCIPAL,
          playerId: PLAYER,
          status: PLAYER_IDENTITY_LINK_LIFECYCLE.ACTIVE,
          version: 1,
        },
      ],
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.MAPPED);
    assert.equal(result.playerId, PLAYER);
    assert.equal(result.source, "player_identity_links");
  });

  test("no mapping → UNMAPPED without playerId", async () => {
    const result = await resolveWith({ links: [] });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED);
    assert.equal(result.playerId, null);
  });

  test("revoked mapping → INACTIVE without playerId", async () => {
    const result = await resolveWith({
      links: [
        {
          linkId: "l1",
          tenantId: TENANT,
          clubId: CLUB,
          principalId: PRINCIPAL,
          playerId: PLAYER,
          status: PLAYER_IDENTITY_LINK_LIFECYCLE.REVOKED,
          version: 2,
        },
      ],
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.INACTIVE);
    assert.equal(result.playerId, null);
    assert.equal(result.reasonCode, PLAYER_IDENTITY_REASON_CODE.LINK_REVOKED);
  });

  test("multiple active mappings → AMBIGUOUS; no first-row pick", async () => {
    const result = await resolveWith({
      links: [
        {
          linkId: "l1",
          tenantId: TENANT,
          clubId: CLUB,
          principalId: PRINCIPAL,
          playerId: "player-a",
          status: "ACTIVE",
          version: 1,
        },
        {
          linkId: "l2",
          tenantId: TENANT,
          clubId: CLUB,
          principalId: PRINCIPAL,
          playerId: "player-b",
          status: "ACTIVE",
          version: 1,
        },
      ],
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.AMBIGUOUS);
    assert.equal(result.playerId, null);
  });

  test("malformed active player_id → INVALID", async () => {
    const result = await resolveWith({
      links: [
        {
          linkId: "l1",
          tenantId: TENANT,
          clubId: CLUB,
          principalId: PRINCIPAL,
          playerId: "   ",
          status: "ACTIVE",
          version: 1,
        },
      ],
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.INVALID);
    assert.equal(result.playerId, null);
  });

  test("only MAPPED includes playerId (validator)", () => {
    for (const status of [
      PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED,
      PLAYER_IDENTITY_MAPPING_STATUS.INACTIVE,
      PLAYER_IDENTITY_MAPPING_STATUS.AMBIGUOUS,
      PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
    ]) {
      const bad = validatePlayerIdentityMappingResult({
        status,
        playerId: PLAYER,
        tenantId: TENANT,
        clubId: CLUB,
        source: null,
        reasonCode: "X",
      });
      assert.equal(bad.ok, false);
    }
    const good = validatePlayerIdentityMappingResult({
      status: PLAYER_IDENTITY_MAPPING_STATUS.MAPPED,
      playerId: PLAYER,
      tenantId: TENANT,
      clubId: CLUB,
      source: "player_identity_links",
      reasonCode: "OK",
    });
    assert.equal(good.ok, true);
  });
});

describe("B. Security fail-closed", () => {
  test("unauthenticated → INVALID", async () => {
    const repository = createMemoryPlayerIdentityLinkRepository(baseSeed());
    const result = await resolveAuthenticatedCanonicalPlayerMapping({
      tenantId: TENANT,
      clubId: CLUB,
      repository,
      getSessionUserId: () => null,
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.INVALID);
    assert.equal(result.reasonCode, PLAYER_IDENTITY_REASON_CODE.UNAUTHENTICATED);
    assert.equal(result.playerId, null);
  });

  test("caller-supplied principalId rejected", async () => {
    const result = await resolveWith(
      {
        links: [
          {
            linkId: "l1",
            tenantId: TENANT,
            clubId: CLUB,
            principalId: PRINCIPAL,
            playerId: PLAYER,
            status: "ACTIVE",
            version: 1,
          },
        ],
      },
      { principalId: "attacker-principal" }
    );
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.INVALID);
    assert.equal(result.reasonCode, PLAYER_IDENTITY_REASON_CODE.CALLER_PRINCIPAL_FORBIDDEN);
  });

  test("caller-supplied authUserId / playerId rejected", async () => {
    for (const forbidden of [{ authUserId: "x" }, { playerId: "y" }, { user_id: "z" }]) {
      const result = await resolveWith({ links: [] }, forbidden);
      assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.INVALID);
      assert.equal(result.reasonCode, PLAYER_IDENTITY_REASON_CODE.CALLER_PRINCIPAL_FORBIDDEN);
    }
  });

  test("wrong tenant denied", async () => {
    const result = await resolveWith({
      clubs: { [CLUB]: "other-tenant" },
      links: [
        {
          linkId: "l1",
          tenantId: TENANT,
          clubId: CLUB,
          principalId: PRINCIPAL,
          playerId: PLAYER,
          status: "ACTIVE",
          version: 1,
        },
      ],
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.INVALID);
    assert.equal(result.reasonCode, PLAYER_IDENTITY_REASON_CODE.TENANT_CLUB_MISMATCH);
    assert.equal(result.playerId, null);
  });

  test("wrong club (missing club) denied", async () => {
    const repository = createMemoryPlayerIdentityLinkRepository({
      clubs: {},
      memberships: [],
      links: [],
    });
    const result = await resolveAuthenticatedCanonicalPlayerMapping({
      tenantId: TENANT,
      clubId: "missing-club",
      repository,
      getSessionUserId: () => PRINCIPAL,
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.INVALID);
    assert.equal(result.playerId, null);
  });

  test("inactive membership denied (ACTIVE link → INACTIVE)", async () => {
    const result = await resolveWith({
      memberships: [
        { tenantId: TENANT, clubId: CLUB, userId: PRINCIPAL, status: "left" },
      ],
      links: [
        {
          linkId: "l1",
          tenantId: TENANT,
          clubId: CLUB,
          principalId: PRINCIPAL,
          playerId: PLAYER,
          status: "ACTIVE",
          version: 1,
        },
      ],
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.INACTIVE);
    assert.equal(result.playerId, null);
    assert.equal(result.reasonCode, PLAYER_IDENTITY_REASON_CODE.MEMBERSHIP_INACTIVE);
  });

  test("revoked link denied immediately", async () => {
    const result = await resolveWith({
      links: [
        {
          linkId: "l1",
          tenantId: TENANT,
          clubId: CLUB,
          principalId: PRINCIPAL,
          playerId: PLAYER,
          status: "REVOKED",
          version: 2,
        },
      ],
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.INACTIVE);
    assert.equal(result.playerId, null);
  });

  test("cross-tenant link rows do not map in requested scope", async () => {
    const result = await resolveWith({
      links: [
        {
          linkId: "l1",
          tenantId: "other-tenant",
          clubId: CLUB,
          principalId: PRINCIPAL,
          playerId: PLAYER,
          status: "ACTIVE",
          version: 1,
        },
      ],
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED);
    assert.equal(result.playerId, null);
  });

  test("cross-club link rows do not map in requested scope", async () => {
    const result = await resolveWith({
      links: [
        {
          linkId: "l1",
          tenantId: TENANT,
          clubId: "other-club",
          principalId: PRINCIPAL,
          playerId: PLAYER,
          status: "ACTIVE",
          version: 1,
        },
      ],
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED);
  });

  test("no email/name guessing in evaluate helper", () => {
    const result = evaluatePlayerIdentityMappingScope({
      tenantId: TENANT,
      clubId: CLUB,
      principalId: PRINCIPAL,
      clubBelongsToTenant: true,
      membershipActive: true,
      links: [],
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED);
  });
});

describe("C. Constraint semantics (evaluate + SQL static)", () => {
  test("SQL unique indexes for active principal and player", () => {
    const sql = readPack("20_PM_ID_01_CONSTRAINTS_AND_INDEXES.sql");
    assert.match(sql, /uq_player_identity_links_active_principal/);
    assert.match(sql, /uq_player_identity_links_active_player/);
    assert.match(sql, /WHERE status = 'ACTIVE'/);
  });

  test("SQL revoke retains history (no hard delete RPC)", () => {
    const rpc = readPack("40_PM_ID_01_MAPPING_MANAGEMENT_RPCS.sql");
    assert.match(rpc, /status = 'REVOKED'/);
    assert.doesNotMatch(stripSqlComments(rpc), /\bDELETE FROM public\.player_identity_links\b/i);
  });

  test("player_id column is text in table DDL", () => {
    const ddl = readPack("10_PM_ID_01_MAPPING_TABLE.sql");
    assert.match(ddl, /player_id text NOT NULL/i);
    assert.doesNotMatch(ddl, /player_id uuid/i);
  });

  test("version conflict handling present in admin RPCs", () => {
    const rpc = readPack("40_PM_ID_01_MAPPING_MANAGEMENT_RPCS.sql");
    assert.match(rpc, /VERSION_CONFLICT/);
    assert.match(rpc, /p_expected_version/);
  });
});

describe("D. SQL package security static checks", () => {
  test("fixed search_path on SECURITY DEFINER helpers", () => {
    for (const name of [
      "20_PM_ID_01_CONSTRAINTS_AND_INDEXES.sql",
      "30_PM_ID_01_RESOLUTION_HELPERS.sql",
      "40_PM_ID_01_MAPPING_MANAGEMENT_RPCS.sql",
    ]) {
      const sql = readPack(name);
      assert.match(sql, /SET search_path = pg_catalog, public/i);
      assert.match(sql, /SECURITY DEFINER/i);
    }
  });

  test("no PUBLIC/anon execute; revoke present", () => {
    const grants = readPack("50_PM_ID_01_RLS_AND_GRANTS.sql");
    assert.match(grants, /REVOKE ALL ON FUNCTION public\.player_identity_resolve_mapping/i);
    assert.match(grants, /FROM anon/i);
    assert.match(grants, /FROM PUBLIC/i);
    assert.match(grants, /GRANT EXECUTE ON FUNCTION public\.player_identity_resolve_mapping/i);
    assert.match(grants, /TO authenticated/i);
    assert.doesNotMatch(stripSqlComments(grants), /GRANT EXECUTE[\s\S]*TO anon/i);
    assert.doesNotMatch(stripSqlComments(grants), /GRANT EXECUTE[\s\S]*TO PUBLIC/i);
  });

  test("no true policies", () => {
    const grants = stripSqlComments(readPack("50_PM_ID_01_RLS_AND_GRANTS.sql"));
    assert.doesNotMatch(grants, /USING\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(grants, /WITH CHECK\s*\(\s*true\s*\)/i);
  });

  test("resolver uses auth.uid() and has no principal parameter", () => {
    const helpers = readPack("30_PM_ID_01_RESOLUTION_HELPERS.sql");
    assert.match(helpers, /auth\.uid\(\)/);
    assert.match(
      helpers,
      /player_identity_resolve_mapping\(\s*p_tenant_id text,\s*p_club_id text\s*\)/i
    );
    assert.doesNotMatch(
      helpers,
      /player_identity_resolve_mapping\([^)]*p_principal/i
    );
  });

  test("rollback covers PM-ID-01 objects only", () => {
    const rb = readPack("90_PM_ID_01_ROLLBACK.sql");
    assert.match(rb, /DROP TABLE IF EXISTS public\.player_identity_links/);
    assert.match(rb, /player_identity_resolve_mapping/);
    assert.doesNotMatch(rb, /DROP TABLE IF EXISTS public\.profiles/i);
    assert.doesNotMatch(rb, /DROP TABLE IF EXISTS public\.club_members/i);
    assert.doesNotMatch(rb, /coaching_/i);
  });

  test("verification covers table, indexes, helpers, RLS, grants", () => {
    const v = readPack("99_PM_ID_01_VERIFICATION.sql");
    assert.match(v, /player_identity_links/);
    assert.match(v, /indisunique/);
    assert.match(v, /security_definer/);
    assert.match(v, /relrowsecurity/);
    assert.match(v, /has_function_privilege/);
  });

  test("package documents no automatic apply", () => {
    const summary = readPack("00_PM_ID_01_EXECUTIVE_SUMMARY.md");
    assert.match(summary, /PM_ID_01_OWNER_GO_APPLY_STAGING/);
    assert.match(summary, /sqlApplied/);
  });
});

describe("E. JavaScript contract", () => {
  test("public exports present", () => {
    for (const key of [
      "PLAYER_IDENTITY_MAPPING_STATUS",
      "resolveAuthenticatedCanonicalPlayerMapping",
      "validatePlayerIdentityMappingResult",
      "createMemoryPlayerIdentityLinkRepository",
      "createSupabasePlayerIdentityLinkAdapter",
    ]) {
      assert.ok(key in playerPublicApi, `missing export ${key}`);
    }
  });

  test("typed result validation rejects principal fields on result", () => {
    const validated = validatePlayerIdentityMappingResult({
      status: PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED,
      playerId: null,
      tenantId: TENANT,
      clubId: CLUB,
      source: null,
      reasonCode: "NO_LINK",
      principalId: PRINCIPAL,
    });
    assert.equal(validated.ok, false);
  });

  test("repository errors translated to INVALID", async () => {
    const repository = {
      async resolveScope() {
        const err = new Error("boom");
        err.code = "NETWORK";
        throw err;
      },
    };
    const result = await resolveAuthenticatedCanonicalPlayerMapping({
      tenantId: TENANT,
      clubId: CLUB,
      repository,
      getSessionUserId: () => PRINCIPAL,
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.INVALID);
    assert.equal(result.playerId, null);
    assert.equal(result.reasonCode, "NETWORK");
  });

  test("supabase adapter does not send principal argument", async () => {
    /** @type {Record<string, unknown>|null} */
    let args = null;
    const adapter = createSupabasePlayerIdentityLinkAdapter({
      async rpc(fn, payload) {
        args = { fn, payload };
        return {
          data: {
            status: "UNMAPPED",
            player_id: null,
            tenant_id: TENANT,
            club_id: CLUB,
            source: "player_identity_links",
            reason_code: "NO_LINK",
          },
          error: null,
        };
      },
    });
    const result = await resolveAuthenticatedCanonicalPlayerMapping({
      tenantId: TENANT,
      clubId: CLUB,
      adapter,
      getSessionUserId: () => PRINCIPAL,
    });
    assert.equal(result.status, PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED);
    assert.equal(args?.fn, "player_identity_resolve_mapping");
    assert.deepEqual(Object.keys(args?.payload || {}).sort(), ["p_club_id", "p_tenant_id"]);
  });

  test("build strips playerId for non-MAPPED", () => {
    const result = buildPlayerIdentityMappingResult({
      status: PLAYER_IDENTITY_MAPPING_STATUS.INACTIVE,
      playerId: PLAYER,
      tenantId: TENANT,
      clubId: CLUB,
      reasonCode: "LINK_REVOKED",
    });
    assert.equal(result.playerId, null);
  });
});

describe("F. Regression — Player facade + COACHING-04 blocker", () => {
  test("Phase 1B resolveByAuthUser still exported and works", () => {
    assert.equal(typeof resolveByAuthUser, "function");
    const result = resolveByAuthUser("");
    assert.equal(result.outcome, RESOLUTION_OUTCOME.INVALID);
  });

  test("PM-ID-01 does not claim DERIVED status", () => {
    assert.equal("DERIVED" in PLAYER_IDENTITY_MAPPING_STATUS, false);
  });

  test("COACHING-04 PLAYER self-scope consumes PM-ID-01 (authored; Staging GO separate)", () => {
    assert.equal(
      COACHING_04_PLAYER_SELF_SCOPE_STATUS,
      "COACHING_04_PLAYER_SELF_SCOPE_AUTHORED_AWAITING_STAGING_GO"
    );
    const coachingDoc = readFileSync(
      path.join(ROOT, "docs/coaching-training/coaching-04/02_COACHING_04_PLAYER_SELF_SCOPE_MAPPING.md"),
      "utf8"
    );
    assert.match(coachingDoc, /COACHING_04_PLAYER_SELF_SCOPE_AUTHORED_AWAITING_STAGING_GO/);
    assert.match(coachingDoc, /player_identity_resolve_mapping/);
    const helpers = readFileSync(
      path.join(ROOT, "docs/coaching-training/coaching-04/11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql"),
      "utf8"
    );
    assert.match(helpers, /player_identity_resolve_mapping/);
    assert.match(
      stripSqlComments(helpers),
      /CREATE OR REPLACE FUNCTION public\.coaching_04_mapped_player_id/i
    );
  });

  test("handoff forbids coaching.self.read grant in this branch", () => {
    const handoff = readPack("05_PM_ID_01_COACHING_CONSUMER_HANDOFF.md");
    assert.match(handoff, /coaching\.self\.read/);
    assert.match(handoff, /must not/i);
  });

  test("no unexpected files deleted from pack directory listing", () => {
    const names = readdirSync(PACK);
    assert.ok(names.includes("10_PM_ID_01_MAPPING_TABLE.sql"));
  });
});
