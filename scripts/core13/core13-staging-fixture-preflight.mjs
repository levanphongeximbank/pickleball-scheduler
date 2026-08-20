/**
 * CORE-13 final fixture semantic / Daily preflight.
 * Read-only. Test/acceptance tooling only. Not product runtime.
 *
 * Must return NOT_READY before createCanonicalTournament when Daily or
 * 29-case receipt dependencies cannot be proven.
 *
 * DAILY_PRODUCT_RULE_CHANGE_GO=NO
 * CREATE_PLAYER_GO=NO
 * EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE=DENY
 */

import { CASE_CATALOG } from "./core13-staging-acceptance-proofs.mjs";
import {
  REQUIRED_MATCH_KEYS,
  REQUIRED_TOURNAMENT_KEYS,
  REQUIRED_USER_KEYS,
} from "./core13-staging-fixture-receipt.mjs";
import {
  CANONICAL_WRITER_CATALOG,
  evaluateWriterCoverage,
  REQUIRED_WRITER_PORTS,
} from "./core13-staging-fixture-writers.mjs";
import { evaluateExistingQaIdentitySet } from "./core13-staging-qa-auth.mjs";
import { DAILY_ATHLETE_ELIGIBILITY_AUTHORITY } from "./core13-staging-daily-eligibility.mjs";

export const MIN_EXISTING_ELIGIBLE_DAILY_PLAYERS_REQUIRED = 4;
export const DAILY_ELIGIBILITY_AUTHORITY = DAILY_ATHLETE_ELIGIBILITY_AUTHORITY;
export const DAILY_FIXTURE_MATCH_TYPE = "open_double";
export const DAILY_PRODUCT_RULE_CHANGED = "NO";
export const EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE = "DENY";

function proof(ok, detail, extra = {}) {
  return Object.freeze({ ok: ok === true, detail: String(detail || ""), ...extra });
}

function text(value) {
  return String(value || "").trim();
}

function uniqueIds(values = []) {
  return [...new Set((values || []).map((value) => text(value)).filter(Boolean))];
}

export function createReadyDailyPreflightSnapshot(overrides = {}) {
  const eligiblePlayerIds = uniqueIds(
    overrides.eligiblePlayerIds || [
      "dddddddd-dddd-4ddd-8ddd-000000000001",
      "dddddddd-dddd-4ddd-8ddd-000000000002",
      "dddddddd-dddd-4ddd-8ddd-000000000003",
      "dddddddd-dddd-4ddd-8ddd-000000000004",
    ]
  );
  return {
    ok: true,
    tenantId: overrides.tenantId || "core13-qa-tenant-a",
    clubId: overrides.clubId || "core13-qa-club-a",
    clubTenantId: overrides.clubTenantId || overrides.tenantId || "core13-qa-tenant-a",
    eligiblePlayerIds,
    eligiblePlayerCount: eligiblePlayerIds.length,
    fabricated: false,
    hasCourtCapability: overrides.hasCourtCapability !== false,
    usableCourtCount: overrides.usableCourtCount ?? 1,
    dailyEnabledScopable: true,
    dailyDisabledScopable: true,
    organizerAuthorized: true,
    rpc: {
      getState: true,
      checkIn: true,
      createMatches: true,
      ...(overrides.rpc || {}),
    },
    casReadable: true,
    idempotencyKeysBuildable: true,
    doublesPayloadValid: true,
    DAILY_ELIGIBILITY_AUTHORITY: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
    canonicalEligibilityVerified: overrides.canonicalEligibilityVerified !== false,
    PRECHECK_ELIGIBILITY_RULE_EQUALS_CREATE_MATCHES: "YES",
    CLUB_DATA_V3_AS_PLAYER_SSOT: "DENY",
    PLAYER_ELIGIBILITY_BYPASS: "DENY",
    HARDCODED_PLAYER_IDS: "DENY",
    ...overrides,
    eligiblePlayerIds,
    DAILY_ELIGIBILITY_AUTHORITY: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
  };
}

export function evaluateDailyDoublesPayload(input = {}) {
  const playerIds = uniqueIds(input.playerIds || input.eligiblePlayerIds);
  const matchType = text(input.matchType || DAILY_FIXTURE_MATCH_TYPE);
  if (input.fabricated === true) {
    return proof(false, "fabricated Daily players denied");
  }
  if (playerIds.length !== 4) {
    return proof(false, "Daily doubles payload requires exactly four distinct eligible players");
  }
  if (matchType !== DAILY_FIXTURE_MATCH_TYPE) {
    return proof(false, `CORE13 Daily fixture requires ${DAILY_FIXTURE_MATCH_TYPE}`);
  }
  const teamA = uniqueIds(input.teamAPlayerIds || playerIds.slice(0, 2));
  const teamB = uniqueIds(input.teamBPlayerIds || playerIds.slice(2, 4));
  if (teamA.length !== 2 || teamB.length !== 2) {
    return proof(false, "Daily doubles payload requires 2v2 teams");
  }
  const combined = uniqueIds([...teamA, ...teamB]);
  if (combined.length !== 4) {
    return proof(false, "Daily doubles payload cannot duplicate players");
  }
  const allowed = new Set(uniqueIds(input.eligiblePlayerIds || playerIds));
  if (combined.some((id) => !allowed.has(id))) {
    return proof(false, "Daily doubles payload cannot use ineligible or fabricated players");
  }
  return proof(true, "daily-doubles-payload", {
    matchType,
    teamAPlayerIds: teamA,
    teamBPlayerIds: teamB,
    playerIds: combined,
  });
}

export function evaluateDailyFixturePreflight(snapshot = {}) {
  const expectedTenantId = text(snapshot.expectedTenantId || snapshot.tenantId);
  const tenantId = text(snapshot.tenantId);
  const clubId = text(snapshot.clubId);
  const clubTenantId = text(snapshot.clubTenantId || snapshot.tenantId);
  const eligiblePlayerIds = uniqueIds(snapshot.eligiblePlayerIds);
  const rpc = snapshot.rpc || {};

  if (snapshot.ok === false) {
    return proof(false, snapshot.detail || "DAILY_PREFLIGHT_NOT_READY", {
      verdict: "NOT_READY",
      FINAL_FRESH_FIXTURE_RUN_READY: false,
    });
  }
  if (!tenantId) {
    return proof(false, "canonical Tenant A is required before Daily mutation", {
      verdict: "NOT_READY",
    });
  }
  if (expectedTenantId && tenantId !== expectedTenantId) {
    return proof(false, "Daily club/tenant does not match canonical Tenant A", {
      verdict: "DENY",
      reason: "wrong tenant",
    });
  }
  if (!clubId) {
    return proof(false, "canonical Daily club scope is required", { verdict: "NOT_READY" });
  }
  if (clubTenantId !== tenantId) {
    return proof(false, "selected Daily club does not belong to Tenant A", {
      verdict: "DENY",
      reason: "wrong club",
    });
  }
  if (snapshot.wrongClub === true) {
    return proof(false, "selected Daily club does not belong to Tenant A", {
      verdict: "DENY",
      reason: "wrong club",
    });
  }
  if (snapshot.fabricated === true) {
    return proof(false, "fabricated Daily players denied", { verdict: "DENY" });
  }
  if (text(snapshot.DAILY_ELIGIBILITY_AUTHORITY) !== DAILY_ATHLETE_ELIGIBILITY_AUTHORITY) {
    return proof(false, "Daily eligibility authority must be daily_play_athlete_eligible_for_club", {
      verdict: "NOT_READY",
      expectedAuthority: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
      actualAuthority: snapshot.DAILY_ELIGIBILITY_AUTHORITY || null,
    });
  }
  if (snapshot.canonicalEligibilityVerified !== true) {
    return proof(false, "Daily eligible athletes must be verified via canonical RPC", {
      verdict: "NOT_READY",
      PRECHECK_ELIGIBILITY_RULE_EQUALS_CREATE_MATCHES: "YES",
    });
  }
  if (snapshot.PLAYER_ELIGIBILITY_BYPASS === true) {
    return proof(false, "PLAYER_ELIGIBILITY_BYPASS denied", { verdict: "DENY" });
  }
  if (snapshot.CLUB_DATA_V3_AS_PLAYER_SSOT === true) {
    return proof(false, "CLUB_DATA_V3_AS_PLAYER_SSOT denied", { verdict: "DENY" });
  }
  if (eligiblePlayerIds.length < MIN_EXISTING_ELIGIBLE_DAILY_PLAYERS_REQUIRED) {
    return proof(
      false,
      `DAILY_CHECKED_IN_PLAYERS_INSUFFICIENT existing eligible=${eligiblePlayerIds.length} required=${MIN_EXISTING_ELIGIBLE_DAILY_PLAYERS_REQUIRED}`,
      {
        verdict: "NOT_READY",
        eligiblePlayerCount: eligiblePlayerIds.length,
        required: MIN_EXISTING_ELIGIBLE_DAILY_PLAYERS_REQUIRED,
      }
    );
  }
  if (eligiblePlayerIds.length !== uniqueIds(eligiblePlayerIds).length) {
    return proof(false, "Daily eligible athletes must be distinct", { verdict: "NOT_READY" });
  }
  const usableCourtCount = Number(snapshot.usableCourtCount ?? (snapshot.hasCourtCapability ? 1 : 0));
  if (snapshot.hasCourtCapability !== true || usableCourtCount < 1) {
    return proof(false, "usable Daily court capability is required", {
      verdict: "NOT_READY",
      reason: "no usable court",
    });
  }
  if (snapshot.dailyEnabledScopable === false || snapshot.dailyDisabledScopable === false) {
    return proof(false, "Daily enabled/disabled tournaments cannot be scoped to the selected club", {
      verdict: "NOT_READY",
    });
  }
  if (snapshot.organizerAuthorized !== true) {
    return proof(false, "Organizer A Daily product authorization is not proven", {
      verdict: "NOT_READY",
    });
  }
  if (rpc.getState !== true || rpc.checkIn !== true || rpc.createMatches !== true) {
    return proof(false, "Daily canonical getState/checkIn/createMatches surface is not available", {
      verdict: "NOT_READY",
    });
  }
  if (snapshot.casReadable !== true) {
    return proof(false, "authoritative Daily CAS/revision cannot be obtained", {
      verdict: "NOT_READY",
    });
  }
  if (snapshot.idempotencyKeysBuildable !== true) {
    return proof(false, "deterministic Daily idempotency keys cannot be built", {
      verdict: "NOT_READY",
    });
  }
  const payload = evaluateDailyDoublesPayload({
    playerIds: eligiblePlayerIds.slice(0, 4),
    eligiblePlayerIds,
    matchType: DAILY_FIXTURE_MATCH_TYPE,
    fabricated: snapshot.fabricated,
  });
  if (!payload.ok) return payload;

  return proof(true, "daily-preflight-ready", {
    verdict: "READY",
    tenantId,
    clubId,
    eligiblePlayerIds: eligiblePlayerIds.slice(0, 4),
    eligiblePlayerCount: eligiblePlayerIds.length,
    required: MIN_EXISTING_ELIGIBLE_DAILY_PLAYERS_REQUIRED,
    hasCourtCapability: true,
    usableCourtCount,
    matchType: DAILY_FIXTURE_MATCH_TYPE,
    DAILY_ELIGIBILITY_AUTHORITY: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
    canonicalEligibilityVerified: true,
    PRECHECK_ELIGIBILITY_RULE_EQUALS_CREATE_MATCHES: "YES",
    selectedPlayerTrace: snapshot.selectedPlayerTrace || null,
    FINAL_FRESH_FIXTURE_RUN_READY: true,
  });
}

export function evaluateSemantic29CasePreflight(input = {}) {
  if (CASE_CATALOG.length !== 29) {
    return proof(false, `CASE_CATALOG must remain 29, found ${CASE_CATALOG.length}`, {
      verdict: "NOT_READY",
      FINAL_FRESH_FIXTURE_RUN_READY: false,
    });
  }
  const identity = evaluateExistingQaIdentitySet({
    organizerA: input.organizerA || input.identities?.organizerA || input.identities?.userA,
    organizerB: input.organizerB || input.identities?.organizerB || input.identities?.userB,
    refereeA: input.refereeA || input.identities?.refereeA,
    replacementReferee: input.replacementReferee || input.identities?.replacementReferee,
    inactiveReferee: input.inactiveReferee || input.identities?.inactiveReferee,
  });
  if (!identity.ok) {
    return proof(false, identity.detail || "identity preflight not ready", {
      verdict: "NOT_READY",
      FINAL_FRESH_FIXTURE_RUN_READY: false,
    });
  }
  const tenantA = text(input.tenantA?.id || input.tenantA);
  const tenantB = text(input.tenantB?.id || input.tenantB);
  if (!tenantA || !tenantB || tenantA === tenantB) {
    return proof(false, "Tenant A and Tenant B must be distinct", {
      verdict: "NOT_READY",
      FINAL_FRESH_FIXTURE_RUN_READY: false,
    });
  }
  if (input.venueAsTenant === true) {
    return proof(false, "VENUE_AS_TENANT_FALLBACK denied", {
      verdict: "NOT_READY",
      FINAL_FRESH_FIXTURE_RUN_READY: false,
    });
  }
  const coverage = evaluateWriterCoverage(input.writers || {});
  if (!coverage.ok) {
    return proof(false, coverage.detail || "canonical writer ports missing", {
      verdict: "NOT_READY",
      missing: coverage.missing,
      FINAL_FRESH_FIXTURE_RUN_READY: false,
    });
  }
  const requiredInternal = [
    "createCanonicalTournament",
    "createInternalMatch",
    "initializeMatchExecution",
    "bootstrapRefereeAssignment",
    "startMatchLive",
    "declareForfeit",
    "finalizeMatchLive",
    "setCourtSchedule",
    "createDailyPlayTournament",
    "createDailyPlayMatches",
  ];
  const missingInternal = requiredInternal.filter(
    (name) => typeof input.writers?.[name] !== "function"
  );
  if (missingInternal.length) {
    return proof(false, `missing internal/daily writers: ${missingInternal.join(",")}`, {
      verdict: "NOT_READY",
      FINAL_FRESH_FIXTURE_RUN_READY: false,
    });
  }
  const daily =
    input.daily && input.daily.ok === true
      ? input.daily
      : evaluateDailyFixturePreflight(input.daily || {});
  if (!daily.ok) {
    return proof(false, daily.detail || "Daily semantic preflight not ready", {
      verdict: "NOT_READY",
      FINAL_FRESH_FIXTURE_RUN_READY: false,
      daily,
    });
  }
  if (REQUIRED_TOURNAMENT_KEYS.length !== 5 || REQUIRED_MATCH_KEYS.length !== 10) {
    return proof(false, "receipt tournament/match key inventory drifted", {
      verdict: "NOT_READY",
      FINAL_FRESH_FIXTURE_RUN_READY: false,
    });
  }
  if (REQUIRED_USER_KEYS.length !== 6) {
    return proof(false, "receipt identity key inventory drifted", {
      verdict: "NOT_READY",
      FINAL_FRESH_FIXTURE_RUN_READY: false,
    });
  }
  if (input.resumePartial === true || input.validLive29CaseSsot === true && input.status === "PARTIAL") {
    return proof(false, "partial receipts remain invalid live29 SSOT", {
      verdict: "NOT_READY",
      FINAL_FRESH_FIXTURE_RUN_READY: false,
    });
  }
  if (CANONICAL_WRITER_CATALOG.createDailyPlayMatches.forbiddenAsInternalInitializer !== true) {
    return proof(false, "Daily writer must remain forbidden as INTERNAL authority", {
      verdict: "NOT_READY",
    });
  }
  return proof(true, "semantic-29-case-preflight-ready", {
    verdict: "READY",
    FINAL_FRESH_FIXTURE_RUN_READY: true,
    CATALOG_CASE_COUNT: CASE_CATALOG.length,
    REQUIRED_WRITER_PORTS: REQUIRED_WRITER_PORTS.length,
    daily,
    EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE,
  });
}
