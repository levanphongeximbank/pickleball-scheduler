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

import {
  AUTO_CURRENT_VERSION_FOR_ALL_CASES,
  AUTHORITATIVE_VERSION_SOURCE,
  CASE_CATALOG,
  PRIMARY_BUSINESS_DENIAL_CASES_REQUIRING_CURRENT_VERSION,
} from "./core13-staging-acceptance-proofs.mjs";
import {
  REQUIRED_MATCH_KEYS,
  REQUIRED_TOURNAMENT_KEYS,
  REQUIRED_USER_KEYS,
  buildReceiptCaseAssignmentCommand,
  evaluateCompletedAuthoritativeState,
  evaluateCompletedCaseCommandBind,
  evaluateDailyDisabledCaseCommandBind,
  evaluateDailyEnabledCaseCommandBind,
  hydrateHarnessFixtures,
} from "./core13-staging-fixture-receipt.mjs";
import {
  CANONICAL_WRITER_CATALOG,
  COMPLETED_DIRECT_DML_USED,
  COMPLETED_LIFECYCLE_WRITER_STEPS,
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

export function evaluateCompletedSamePathSemanticPreflight(input = {}) {
  const receipt = input.receipt;
  if (!receipt) {
    return proof(false, "completed same-path preflight requires a receipt", {
      verdict: "NOT_READY",
      COMPLETED_CASE_COMMAND_SCOPE_PARITY: "FAIL",
      COMPLETED_CASE_AUTHORITATIVE_COMPLETION_PATH: "FAIL",
    });
  }
  const writers = input.writers || {};
  const commandBase = input.commandBase || {
    tenantId: receipt.tenantA?.id,
    tournamentId: receipt.tournaments?.primary?.id,
    matchId: receipt.matches?.preMatch?.id,
    refereeId: receipt.users?.refereeA?.id,
    competitionMode: "INTERNAL",
  };
  const completedMatchId = String(receipt.matches?.completed?.id || "").trim();
  const command = buildReceiptCaseAssignmentCommand(
    receipt,
    commandBase,
    completedMatchId
  );
  const bind = evaluateCompletedCaseCommandBind(command, receipt);
  if (!bind.ok) {
    return proof(false, bind.detail, {
      verdict: "NOT_READY",
      COMPLETED_CASE_COMMAND_SCOPE_PARITY: "FAIL",
      COMPLETED_CASE_AUTHORITATIVE_COMPLETION_PATH: "FAIL",
      command,
    });
  }
  const writerPathCanonical =
    typeof writers.declareForfeit === "function" &&
    COMPLETED_LIFECYCLE_WRITER_STEPS.includes("declareForfeit") &&
    COMPLETED_DIRECT_DML_USED === "NO";
  if (!writerPathCanonical) {
    return proof(false, "completed writer path is not canonical DECLARE_FORFEIT", {
      verdict: "NOT_READY",
      COMPLETED_CASE_COMMAND_SCOPE_PARITY: "PASS",
      COMPLETED_CASE_AUTHORITATIVE_COMPLETION_PATH: "FAIL",
      COMPLETED_CASE_COMPLETION_WRITER_CANONICAL: "NO",
    });
  }
  if (COMPLETED_LIFECYCLE_WRITER_STEPS.includes("finalizeMatchLive")) {
    return proof(false, "completed path must not finalize into locked as COMPLETED proof", {
      verdict: "NOT_READY",
      COMPLETED_CASE_AUTHORITATIVE_COMPLETION_PATH: "FAIL",
    });
  }
  const completedLive = input.completedLiveRow;
  if (completedLive) {
    const authoritative = evaluateCompletedAuthoritativeState(completedLive);
    if (!authoritative.ok) {
      return proof(false, authoritative.detail, {
        verdict: "NOT_READY",
        COMPLETED_CASE_COMMAND_SCOPE_PARITY: "PASS",
        COMPLETED_CASE_AUTHORITATIVE_COMPLETION_PATH: "FAIL",
      });
    }
  }
  return proof(true, "completed-same-path-semantic-preflight", {
    verdict: "READY",
    COMPLETED_CASE_MATCH_HAS_DEDICATED_TOURNAMENT: "YES",
    COMPLETED_CASE_COMMAND_TOURNAMENT_MATCHES_OWNER: "YES",
    COMPLETED_CASE_COMMAND_MATCH_MATCHES_RECEIPT: "YES",
    COMPLETED_CASE_COMMAND_TENANT_MATCHES_OWNER: "YES",
    COMPLETED_CASE_COMPLETION_WRITER_CANONICAL: "YES",
    COMPLETED_CASE_EXPECTED_AUTHORITATIVE_STATE: "COMPLETED",
    EXPECTED_RUNTIME_RESULT: "CORE13_LIFECYCLE_DENIED",
    EXPECTED_DENIAL_REASON: "COMPLETED forbids assign/replace/unassign",
    COMPLETED_CASE_COMMAND_SCOPE_PARITY: "PASS",
    COMPLETED_CASE_AUTHORITATIVE_COMPLETION_PATH: "PASS",
    LOCKED_AS_COMPLETED_PROOF: "DENY",
    CROSS_TOURNAMENT_AS_COMPLETED_PROOF: "DENY",
    command,
  });
}

/**
 * Deterministic remaining L/M same-path preflight before fresh fixture / Live29.
 * Tooling only — does not change product validation order.
 */
export function evaluateRemainingLmSamePathPreflight(input = {}) {
  const receipt = input.receipt;
  const harnessSource = String(input.harnessSource || "");
  if (!receipt) {
    return proof(false, "remaining L/M preflight requires a receipt", {
      verdict: "NOT_READY",
      REMAINING_LM_SAME_PATH_PREFLIGHT: "FAIL",
    });
  }
  if (CASE_CATALOG.length !== 29) {
    return proof(false, `catalog count drifted: ${CASE_CATALOG.length}`, {
      verdict: "NOT_READY",
      P13: "FAIL",
    });
  }
  const fixtures = hydrateHarnessFixtures(receipt);
  const commandBase = input.commandBase || {
    tenantId: fixtures.tenantA,
    tournamentId: fixtures.tournamentA,
    matchId: fixtures.matchA,
    refereeId: fixtures.refereeId,
    competitionMode: "INTERNAL",
  };

  const dailyDisabledCommand =
    input.dailyDisabledCommand ||
    buildReceiptCaseAssignmentCommand(
      receipt,
      commandBase,
      fixtures.dailyDisabledMatch,
      {
        competitionMode: "DAILY_PLAY",
        refereeFeatureEnabled: false,
      }
    );
  const dailyDisabledBind = evaluateDailyDisabledCaseCommandBind(
    dailyDisabledCommand,
    receipt
  );
  if (!dailyDisabledBind.ok) {
    return proof(false, dailyDisabledBind.detail, {
      verdict: "NOT_READY",
      P8: "FAIL",
      P9: "FAIL",
      P10: "FAIL",
      REMAINING_LM_SAME_PATH_PREFLIGHT: "FAIL",
    });
  }

  const wrongPrimaryDaily = {
    ...commandBase,
    tournamentId: fixtures.dailyDisabled,
    competitionMode: "DAILY_PLAY",
    refereeFeatureEnabled: false,
  };
  const wrongPrimaryRejected = evaluateDailyDisabledCaseCommandBind(
    wrongPrimaryDaily,
    receipt
  );
  if (wrongPrimaryRejected.ok) {
    return proof(false, "daily-disabled wrong primary match must be rejected", {
      verdict: "NOT_READY",
      P10: "FAIL",
    });
  }

  const dailyEnabledCommand =
    input.dailyEnabledCommand ||
    buildReceiptCaseAssignmentCommand(
      receipt,
      commandBase,
      fixtures.dailyEnabledMatch,
      {
        competitionMode: "DAILY_PLAY",
        refereeFeatureEnabled: true,
      }
    );
  const dailyEnabledBind = evaluateDailyEnabledCaseCommandBind(
    dailyEnabledCommand,
    receipt
  );
  if (!dailyEnabledBind.ok) {
    return proof(false, dailyEnabledBind.detail, {
      verdict: "NOT_READY",
      P11: "FAIL",
    });
  }

  const completedBind = evaluateCompletedCaseCommandBind(
    buildReceiptCaseAssignmentCommand(
      receipt,
      commandBase,
      fixtures.matchCompleted
    ),
    receipt
  );
  if (!completedBind.ok) {
    return proof(false, completedBind.detail, {
      verdict: "NOT_READY",
      P12: "FAIL",
    });
  }

  if (harnessSource) {
    const mustHave = [
      "getAuthoritativeMatchAssignmentVersion",
      AUTHORITATIVE_VERSION_SOURCE,
      "L.inactive-referee-deny",
      "L.required-qualification-missing-deny",
      "L.unavailable-referee-deny-when-required",
      "evaluateDailyDisabledCaseCommandBind",
      "buildReceiptCaseAssignmentCommand",
    ];
    for (const token of mustHave) {
      if (!harnessSource.includes(token)) {
        return proof(false, `harness missing required token: ${token}`, {
          verdict: "NOT_READY",
          REMAINING_LM_SAME_PATH_PREFLIGHT: "FAIL",
        });
      }
    }
    if (
      !/G\.cas-stale-expected-version-deny[\s\S]{0,400}expectedVersion:\s*0/.test(
        harnessSource
      ) &&
      !/expectedVersion:\s*0[\s\S]{0,400}G\.cas-stale-expected-version-deny/.test(
        harnessSource
      )
    ) {
      return proof(false, "G stale CAS must retain explicit expectedVersion 0", {
        verdict: "NOT_READY",
        P4: "FAIL",
      });
    }
    if (
      !/L\.non-canonical-referee-deny[\s\S]{0,500}expectedVersion:\s*0/.test(
        harnessSource
      )
    ) {
      return proof(false, "non-canonical must preserve intended zero-version path", {
        verdict: "NOT_READY",
        P5: "FAIL",
      });
    }
    for (const caseName of PRIMARY_BUSINESS_DENIAL_CASES_REQUIRING_CURRENT_VERSION) {
      const escaped = caseName.replace(/\./g, "\\.");
      const quoted = `"${caseName}"`;
      const nearHelper =
        harnessSource.includes(quoted) &&
        (new RegExp(
          `${escaped}[\\s\\S]{0,1200}(getAuthoritativeMatchAssignmentVersion|resolveCurrentExpectedVersionForPrimaryBusinessDenial)`
        ).test(harnessSource) ||
          new RegExp(
            `(getAuthoritativeMatchAssignmentVersion|resolveCurrentExpectedVersionForPrimaryBusinessDenial)[\\s\\S]{0,240}${escaped}`
          ).test(harnessSource));
      if (!nearHelper) {
        return proof(
          false,
          `${caseName} must resolve current authoritative expectedVersion`,
          { verdict: "NOT_READY", REMAINING_LM_SAME_PATH_PREFLIGHT: "FAIL" }
        );
      }
    }
    if (!harnessSource.includes("resolveCurrentExpectedVersionForPrimaryBusinessDenial")) {
      return proof(false, "missing resolveCurrentExpectedVersionForPrimaryBusinessDenial helper", {
        verdict: "NOT_READY",
        P1: "FAIL",
      });
    }
    if (
      /AUTO_CURRENT_VERSION_FOR_ALL_CASES\s*=\s*YES/.test(harnessSource) ||
      AUTO_CURRENT_VERSION_FOR_ALL_CASES !== "DENY"
    ) {
      return proof(false, "AUTO_CURRENT_VERSION_FOR_ALL_CASES must remain DENY", {
        verdict: "NOT_READY",
        P7: "FAIL",
      });
    }
    if (/venueId\s*\|\|\s*tenantId|TENANT.*=.*venue/i.test(harnessSource)) {
      return proof(false, "Venue-as-Tenant fallback detected", {
        verdict: "NOT_READY",
        P14: "FAIL",
      });
    }
    if (
      /M\.daily-play-disabled-not-applicable[\s\S]{0,500}tournamentId:\s*dailyDisabled[\s\S]{0,200}expectedVersion:\s*0/.test(
        harnessSource
      ) &&
      !/M\.daily-play-disabled-not-applicable[\s\S]{0,800}dailyDisabledMatch/.test(
        harnessSource
      )
    ) {
      return proof(
        false,
        "daily-disabled must not inherit primary match from commandBase",
        { verdict: "NOT_READY", P8: "FAIL", P9: "FAIL", P15: "FAIL" }
      );
    }
  }

  const overlapA = fixtures.overlapA;
  const overlapB = fixtures.overlapB;
  const nonOverlap = fixtures.nonOverlap;
  if (!overlapA || !overlapB || overlapA === fixtures.matchA || overlapB === fixtures.matchA) {
    return proof(false, "overlap fixtures must be dedicated and distinct from primary", {
      verdict: "NOT_READY",
      P6: "FAIL",
    });
  }
  if (!nonOverlap || nonOverlap === fixtures.matchA) {
    return proof(false, "non-overlap fixture must be dedicated", {
      verdict: "NOT_READY",
      P7: "FAIL",
    });
  }

  return proof(true, "remaining-lm-same-path-preflight", {
    verdict: "READY",
    REMAINING_LM_SAME_PATH_PREFLIGHT: "PASS",
    P1: "PASS",
    P2: "PASS",
    P3: "PASS",
    P4: "PASS",
    P5: "PASS",
    P6: "PASS",
    P7: "PASS",
    P8: "PASS",
    P9: "PASS",
    P10: "PASS",
    P11: "PASS",
    P12: "PASS",
    P13: "PASS",
    P14: "PASS",
    P15: "PASS",
    AUTHORITATIVE_VERSION_SOURCE,
    AUTO_CURRENT_VERSION_FOR_ALL_CASES,
    TARGET_PRIMARY_CASES: PRIMARY_BUSINESS_DENIAL_CASES_REQUIRING_CURRENT_VERSION,
    DAILY_DISABLED_COMMAND_TOURNAMENT: dailyDisabledCommand.tournamentId,
    DAILY_DISABLED_RECEIPT_TOURNAMENT: fixtures.dailyDisabled,
    DAILY_DISABLED_COMMAND_MATCH: dailyDisabledCommand.matchId,
    DAILY_DISABLED_RECEIPT_MATCH: fixtures.dailyDisabledMatch,
    DAILY_DISABLED_MATCH_OWNER_TOURNAMENT: String(
      receipt.matches?.dailyDisabled?.tournamentId || ""
    ),
    dailyDisabledCommand,
    dailyEnabledCommand,
  });
}
