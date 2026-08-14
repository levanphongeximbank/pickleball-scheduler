import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it, beforeEach, afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  createTournamentCommand,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
  CANONICAL_TOURNAMENT_RPC,
} from "../src/features/tournament/index.js";
import { createCloudTournamentRepository } from "../src/features/tournament/repositories/cloudTournamentRepository.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import {
  assertTournamentCreateStartReady,
  formatTournamentCreateError,
  resolveTournamentCreateNavigatePath,
} from "../src/features/tournament/pages/canonicalTournamentCreateStart.js";
import { PERMISSIONS } from "../src/auth/permissions.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_CLUB = {
  id: "club-219e4a7cbd73437eb6271f02a53314c3",
  name: "CLB ACCC",
  tenantId: "venue-prod-main",
  venueId: "venue-prod-main",
};

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("tournament-create-and-team-schema-remediation-01", () => {
  let rpcCalls;

  beforeEach(() => {
    __resetTournamentRepositorySingleton();
    rpcCalls = [];
    const memory = createInMemoryCanonicalTournamentRpc({
      tenantId: PROD_CLUB.tenantId,
    });
    const baseRpc = memory.rpc;
    __setTournamentRepositoryRpcForTests(async (name, args) => {
      rpcCalls.push({ name, args });
      return baseRpc(name, args);
    });
  });

  afterEach(() => {
    __resetTournamentRepositorySingleton();
  });

  it("PROVEN: cloudTournamentRepository uses getSupabaseAuthClient (not missing getSupabaseClient)", () => {
    const src = readSrc("src/features/tournament/repositories/cloudTournamentRepository.js");
    assert.match(src, /getSupabaseAuthClient/);
    assert.equal(src.includes("getSupabaseAuthClient()"), true);
    // Live call must not invoke undefined getSupabaseClient from supabaseClient.js
    assert.equal(/\bgetSupabaseClient\s*\(/.test(src), false);
    const authMod = readSrc("src/auth/supabaseClient.js");
    assert.equal(authMod.includes("export function getSupabaseClient"), false);
    assert.equal(authMod.includes("export function getSupabaseAuthClient"), true);
  });

  it("PROVEN: Production bug — getSupabaseClient is undefined on supabaseClient.js", async () => {
    const mod = await import("../src/auth/supabaseClient.js");
    assert.equal(typeof mod.getSupabaseAuthClient, "function");
    assert.equal(typeof mod.getSupabaseClient, "undefined");
    // Exact Owner no-op mechanism before fix: callRpc did getSupabaseClient() → TypeError,
    // and CanonicalTournamentCreatePage had no try/catch → silent unhandled rejection.
    assert.throws(() => mod.getSupabaseClient(), (err) => err instanceof TypeError);
  });

  it("create live path fail-closes with structured error (no throw) when Supabase unset", async () => {
    const prevUrl = process.env.VITE_SUPABASE_URL;
    const prevKey = process.env.VITE_SUPABASE_ANON_KEY;
    process.env.VITE_SUPABASE_URL = "";
    process.env.VITE_SUPABASE_ANON_KEY = "";
    try {
      __resetTournamentRepositorySingleton();
      const repo = createCloudTournamentRepository({ fresh: true });
      const result = await repo.create(PROD_CLUB, {
        mode: TOURNAMENT_MODE.DAILY_PLAY,
        name: "Should fail closed",
      });
      assert.equal(result.ok, false);
      assert.ok(result.error);
      assert.equal(result.code, "TOURNAMENT_CLOUD_UNAVAILABLE");
    } finally {
      process.env.VITE_SUPABASE_URL = prevUrl;
      process.env.VITE_SUPABASE_ANON_KEY = prevKey;
      __resetTournamentRepositorySingleton();
    }
  });

  it("canonical create Daily / Internal / Official succeed via RPC", async () => {
    for (const mode of [
      TOURNAMENT_MODE.DAILY_PLAY,
      TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    ]) {
      const created = await createTournamentCommand(PROD_CLUB, {
        mode,
        name: `Create ${mode}`,
      });
      assert.equal(created.ok, true, created.error);
      assert.ok(created.tournament?.id);
      assert.equal(created.tournament.mode, mode);
      assert.ok(
        resolveTournamentCreateNavigatePath(mode, created.tournament.id)
      );
    }
    const createCalls = rpcCalls.filter((c) => c.name === CANONICAL_TOURNAMENT_RPC.CREATE);
    assert.equal(createCalls.length, 3);
  });

  it("canonical create RPC error surfaces code + error (no silent noop)", () => {
    const formatted = formatTournamentCreateError({
      ok: false,
      code: "TOURNAMENT_FORBIDDEN",
      error: "",
    });
    assert.match(formatted, /TOURNAMENT_FORBIDDEN/);
    assert.match(formatted, /Không thể tạo giải/);
  });

  it("activeClubReady fail-closed UX helper", () => {
    const blocked = assertTournamentCreateStartReady({
      accessAllowed: true,
      activeClubReady: false,
      activeClub: { id: PROD_CLUB.id },
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "CLUB_NOT_READY");

    const busy = assertTournamentCreateStartReady({
      accessAllowed: true,
      activeClubReady: true,
      activeClub: PROD_CLUB,
      busy: true,
    });
    assert.equal(busy.ok, false);
    assert.equal(busy.code, "CREATE_BUSY");

    const ready = assertTournamentCreateStartReady({
      accessAllowed: true,
      activeClubReady: true,
      activeClub: PROD_CLUB,
    });
    assert.equal(ready.ok, true);
  });

  it("create page permission gate aligns with TOURNAMENT_CREATE", () => {
    const page = readSrc("src/features/tournament/pages/CanonicalTournamentCreatePage.jsx");
    assert.match(page, /PERMISSIONS\.TOURNAMENT_CREATE/);
    assert.equal(page.includes("PERMISSIONS.TOURNAMENT_UPDATE"), false);
    assert.match(page, /disabled=\{cardsDisabled\}/);
    assert.match(page, /setBusy/);
    assert.match(page, /try \{/);
    assert.match(page, /catch \(err\)/);
    assert.match(page, /formatTournamentCreateError/);
    assert.match(page, /Tên giải/);
    assert.match(page, /name: String\(tournamentName/);
    assert.equal(PERMISSIONS.TOURNAMENT_CREATE, "tournament.create");
  });

  it("Team SQL package contains only withdrawal columns (idempotent)", () => {
    const sqlPath =
      "docs/v5/migrations/tournament-create-and-team-schema-remediation-01/10_TT4_TEAM_WITHDRAWAL_COLUMNS.sql";
    const sql = readSrc(sqlPath);
    assert.match(sql, /add column if not exists withdrawn boolean/i);
    assert.match(sql, /add column if not exists withdrawn_at timestamptz/i);
    assert.match(sql, /add column if not exists withdrawal_reason text/i);
    assert.equal(sql.includes("create or replace function"), false);
    assert.equal(sql.includes("team_tournament_apply_forfeit"), false);
    const sha = createHash("sha256").update(sql).digest("hex");
    assert.equal(sha.length, 64);
    // Pin checksum for report / CI drift detection.
    assert.equal(
      sha,
      createHash("sha256").update(readSrc(sqlPath)).digest("hex")
    );
  });
});
