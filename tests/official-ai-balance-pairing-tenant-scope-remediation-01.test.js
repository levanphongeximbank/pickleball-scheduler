/**
 * OFFICIAL-AI-BALANCE-PAIRING-TENANT-SCOPE-REMEDIATION-01
 *
 * Official AI Balance omitted tenant/tournament at prepareLivePrivatePairingOptions
 * → resolveLivePairingScope SCOPE_ID_REQUIRED despite page-level canonical tenant.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, it } from "node:test";

import {
  COMPETITION_CLASS,
  FEATURE_FLAG_KEYS,
  prepareLivePrivatePairingOptions,
  projectLivePrivatePairingPrepareInput,
  setPrivatePairingRpcClientForTests,
} from "../src/features/private-pairing-rules/index.js";
import { PRIVATE_PAIRING_RPC } from "../src/features/private-pairing-rules/constants/dbCodes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const PROD_CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";
const PROD_TENANT_ID = "venue-prod-main";
const PROD_TOURNAMENT_ID = "official-ai-owner-fixture-01";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

const PROD_ACTIVE_CLUB = {
  id: PROD_CLUB_ID,
  clubId: PROD_CLUB_ID,
  tenantId: PROD_TENANT_ID,
  venueId: PROD_TENANT_ID,
  name: "CLB ACCC",
};

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function mockClient(handler) {
  return { rpc: async (name, args) => handler(name, args) };
}

function emptyRulesOk(scopeType, scopeId) {
  return {
    data: {
      ok: true,
      rule_set: {
        id: `rs-${scopeId}`,
        version: 1,
        scope_type: scopeType,
        scope_id: scopeId,
        status: "active",
      },
      rules: [],
    },
    error: null,
  };
}

beforeEach(() => {
  setPrivatePairingRpcClientForTests(null);
});

describe("official-ai-balance-pairing-tenant-scope-remediation-01", () => {
  it("A. Official AI Balance with canonical tenant → prepare succeeds", async () => {
    const tournament = {
      id: PROD_TOURNAMENT_ID,
      clubId: PROD_CLUB_ID,
      tenantId: PROD_TENANT_ID,
      mode: "official_tournament",
      officialMode: "ai_balance",
    };

    const projected = projectLivePrivatePairingPrepareInput({
      tournament,
      activeClub: PROD_ACTIVE_CLUB,
      tournamentId: PROD_TOURNAMENT_ID,
      clubId: PROD_CLUB_ID,
      hostClubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      allowedByPublishedRules: false,
    });
    assert.equal(projected.ok, true);
    assert.equal(projected.tenantId, PROD_TENANT_ID);

    setPrivatePairingRpcClientForTests(
      mockClient(async (name, args) => {
        assert.equal(name, PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE);
        assert.equal(args.p_tenant_id, PROD_TENANT_ID);
        return emptyRulesOk(args.p_scope_type, args.p_scope_id);
      })
    );

    const prepared = await prepareLivePrivatePairingOptions({
      ...projected.prepareInput,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, true);
    assert.notEqual(prepared.error?.code, "SCOPE_ID_REQUIRED");
  });

  it("B. missing tenant → fail closed SCOPE_ID_REQUIRED", async () => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: { id: PROD_TOURNAMENT_ID, clubId: PROD_CLUB_ID },
      activeClub: { id: PROD_CLUB_ID, clubId: PROD_CLUB_ID },
      tournamentId: PROD_TOURNAMENT_ID,
      hostClubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.OFFICIAL,
    });
    assert.equal(projected.ok, false);
    assert.equal(projected.code, "SCOPE_ID_REQUIRED");

    const prepared = await prepareLivePrivatePairingOptions({
      clubId: PROD_CLUB_ID,
      tournamentId: PROD_TOURNAMENT_ID,
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, false);
    assert.equal(prepared.error.code, "SCOPE_ID_REQUIRED");
  });

  it("C. tenant mismatch → fail closed", () => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: {
        id: PROD_TOURNAMENT_ID,
        clubId: PROD_CLUB_ID,
        tenantId: PROD_TENANT_ID,
      },
      activeClub: {
        id: PROD_CLUB_ID,
        clubId: PROD_CLUB_ID,
        tenantId: "venue-other",
        venueId: "venue-other",
      },
      tournamentId: PROD_TOURNAMENT_ID,
      hostClubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.OFFICIAL,
    });
    assert.equal(projected.ok, false);
    assert.equal(projected.code, "TENANT_SCOPE_MISMATCH");
  });

  it("D. club mismatch → fail closed", () => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: {
        id: PROD_TOURNAMENT_ID,
        clubId: PROD_CLUB_ID,
        tenantId: PROD_TENANT_ID,
      },
      activeClub: {
        id: "club-foreign",
        clubId: "club-foreign",
        tenantId: PROD_TENANT_ID,
        venueId: PROD_TENANT_ID,
      },
      tournamentId: PROD_TOURNAMENT_ID,
      hostClubId: "club-foreign",
      competitionClass: COMPETITION_CLASS.OFFICIAL,
    });
    assert.equal(projected.ok, false);
    assert.equal(projected.code, "CLUB_SCOPE_MISMATCH");
  });

  it("E/F. Official uses shared projector; no default/localStorage/user.venueId fallback", () => {
    const src = readSrc("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(src, /projectLivePrivatePairingPrepareInput/);
    assert.match(src, /prepareOfficialPrivatePairing/);
    // Phase 2D: guided-flow / suggest-pairs CTAs left Registration; remaining
    // Official pairing + group-draw mutations still go through the shared projector.
    assert.doesNotMatch(src, /handleStartGuidedFlow/);
    assert.doesNotMatch(src, /handleSuggestAiPairs/);
    assert.match(src, /handleFormOfficialPairs[\s\S]*prepareOfficialPrivatePairing\(\)/);
    assert.match(src, /handleDrawGroups[\s\S]*prepareOfficialPrivatePairing\(\)/);
    assert.doesNotMatch(src, /handleBuildAiGroups/);
    assert.equal(
      (src.match(/prepareLivePrivatePairingOptions\(/g) || []).length,
      1,
      "only prepareOfficialPrivatePairing should call prepareLive"
    );
    assert.doesNotMatch(
      src,
      /prepareLivePrivatePairingOptions\(\{\s*clubId:\s*activeClubId/
    );
    assert.doesNotMatch(src, /["']default-tenant["']/);
    assert.doesNotMatch(src, /localStorage\.getItem/);
    assert.doesNotMatch(src, /user\.venueId/);
  });

  it("Owner AI Balance fixture: venue-prod-main + ACCC club → explicit tenant", () => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: {
        id: PROD_TOURNAMENT_ID,
        clubId: PROD_CLUB_ID,
        tenantId: PROD_TENANT_ID,
      },
      activeClub: PROD_ACTIVE_CLUB,
      tournamentId: PROD_TOURNAMENT_ID,
      hostClubId: PROD_CLUB_ID,
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      allowedByPublishedRules: false,
    });
    assert.equal(projected.ok, true);
    assert.equal(projected.prepareInput.tenantId, PROD_TENANT_ID);
    assert.equal(projected.prepareInput.clubId, PROD_CLUB_ID);
    assert.equal(projected.prepareInput.tournamentId, PROD_TOURNAMENT_ID);
    assert.equal(projected.prepareInput.competitionClass, COMPETITION_CLASS.OFFICIAL);
  });

  it("Open Mode pair registration path remains present (selector remediation)", () => {
    const src = readSrc("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(src, /mode=["']pair["']/);
    assert.match(src, /handleRegisterPair/);
    assert.match(src, /showPlayerList/);
  });
});
