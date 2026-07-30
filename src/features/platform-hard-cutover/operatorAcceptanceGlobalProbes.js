/**
 * Operator Acceptance A-G1..A-G6 — real hard-cutover criteria probes.
 * Never hardcodes PASS. When HC is off or evidence insufficient → FAIL/NOT_CERTIFIED.
 */

import {
  RUNTIME_AUTHORITY_MATRIX,
  isPlatformHardCutoverEnabled,
  isCompetitionRemoteSsotEnabled,
} from "./runtimeAuthorityMatrix.js";
import {
  mustBlockLegacyWriters,
  assertMatchLiveDirectWriteAllowed,
  assertMockPersistenceAllowed,
  assertMessagingDemoAuthorityAllowed,
  assertCoachingLegacyAuthorityAllowed,
  assertDashboardAnalyticsMockAllowed,
  assertDashboardAnalyticsLocalStorageAllowed,
  assertPrivatePairingLegacyPickerAllowed,
  rejectSilentFallback,
  LEGACY_AUTHORITY_ERROR,
} from "./legacyAuthorityPolicy.js";

export const GLOBAL_PROBE_CODE = Object.freeze({
  OK: "OK",
  HARD_CUTOVER_REQUIRED: "HARD_CUTOVER_REQUIRED",
  MULTIPLE_WRITERS: "MULTIPLE_CANONICAL_WRITERS",
  MATRIX_INVALID: "AUTHORITY_MATRIX_INVALID",
  LEGACY_WRITER_ACTIVE: "LEGACY_WRITER_ACTIVE",
  LOCALSTORAGE_SOT_ACTIVE: "LOCALSTORAGE_AUTHORITY_ACTIVE",
  MOCK_PERSISTENCE_ACTIVE: "MOCK_PERSISTENCE_ACTIVE",
  SILENT_FALLBACK_ACTIVE: "SILENT_FALLBACK_ACTIVE",
  HYBRID_RUNTIME: "HYBRID_RUNTIME_ACTIVE",
  NOT_CERTIFIED: "NOT_CERTIFIED",
});

function nowIso() {
  return new Date().toISOString();
}

function sanitizeEvidence(value) {
  if (Array.isArray(value)) return value.map(sanitizeEvidence);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(token|jwt|password|secret|anon[_-]?key|service[_-]?role)/i.test(String(key)))
      .map(([key, entry]) => [key, sanitizeEvidence(entry)])
  );
}

function stepResult(id, pass, code, details = {}) {
  return {
    id,
    status: pass ? "PASS" : "FAIL",
    code,
    message: pass ? null : code,
    observedAt: nowIso(),
    details: sanitizeEvidence(details),
  };
}

function requireHardCutover(env) {
  if (!isPlatformHardCutoverEnabled(env)) {
    return {
      ok: false,
      code: GLOBAL_PROBE_CODE.HARD_CUTOVER_REQUIRED,
      details: {
        requiredFlag: "VITE_PLATFORM_HARD_CUTOVER_ENABLED",
        requiredValue: "true",
        note: "Global HC criteria cannot be certified while hard cutover is off",
      },
    };
  }
  return { ok: true };
}

/**
 * A-G1 — exactly one canonical writer declaration per domain in the matrix.
 */
export function probeOneCanonicalWriterPerDomain(env) {
  const hc = requireHardCutover(env);
  if (!hc.ok) return stepResult("A-G1", false, hc.code, hc.details);

  const domains = RUNTIME_AUTHORITY_MATRIX.map((entry) => entry.domain);
  const unique = new Set(domains);
  if (unique.size !== domains.length) {
    return stepResult("A-G1", false, GLOBAL_PROBE_CODE.MATRIX_INVALID, {
      criterion: "ONE_CANONICAL_WRITER_PER_DOMAIN",
      duplicateDomains: domains.filter((d, i) => domains.indexOf(d) !== i),
    });
  }

  const multiWriter = [];
  for (const entry of RUNTIME_AUTHORITY_MATRIX) {
    const writer = String(entry.canonicalWriter || "").trim();
    if (!writer) {
      multiWriter.push({ domain: entry.domain, reason: "missing_canonical_writer" });
      continue;
    }
    // Multiple active writers encoded as "A | B" / "A and B" without fail-closed wording.
    const looksMulti =
      /\s\|\s|\sand\s|,/.test(writer) &&
      !/forbidden|none\s*\(|read-only|cache-only/i.test(writer);
    if (looksMulti) {
      multiWriter.push({ domain: entry.domain, writer });
    }
  }

  if (multiWriter.length > 0) {
    return stepResult("A-G1", false, GLOBAL_PROBE_CODE.MULTIPLE_WRITERS, {
      criterion: "ONE_CANONICAL_WRITER_PER_DOMAIN",
      domains: multiWriter,
    });
  }

  return stepResult("A-G1", true, GLOBAL_PROBE_CODE.OK, {
    criterion: "ONE_CANONICAL_WRITER_PER_DOMAIN",
    domainCount: domains.length,
  });
}

/**
 * A-G2 — legacy writers blocked under hard cutover.
 */
export function probeNoLegacyWriter(env) {
  const hc = requireHardCutover(env);
  if (!hc.ok) return stepResult("A-G2", false, hc.code, hc.details);

  if (!mustBlockLegacyWriters(env)) {
    return stepResult("A-G2", false, GLOBAL_PROBE_CODE.LEGACY_WRITER_ACTIVE, {
      criterion: "NO_LEGACY_WRITER",
      mustBlockLegacyWriters: false,
    });
  }

  const checks = [
    ["match_live", assertMatchLiveDirectWriteAllowed(env)],
    ["messaging_demo", assertMessagingDemoAuthorityAllowed(env)],
    ["coaching_legacy", assertCoachingLegacyAuthorityAllowed(env)],
    ["pairing_legacy_picker", assertPrivatePairingLegacyPickerAllowed(env)],
  ];

  const stillAllowed = checks.filter(([, result]) => result.ok === true);
  if (stillAllowed.length > 0) {
    return stepResult("A-G2", false, GLOBAL_PROBE_CODE.LEGACY_WRITER_ACTIVE, {
      criterion: "NO_LEGACY_WRITER",
      stillAllowed: stillAllowed.map(([name]) => name),
    });
  }

  return stepResult("A-G2", true, GLOBAL_PROBE_CODE.OK, {
    criterion: "NO_LEGACY_WRITER",
    blocked: checks.map(([name, result]) => ({ name, code: result.code })),
  });
}

/**
 * A-G3 — localStorage is not SoT under hard cutover.
 */
export function probeNoLocalStorageAuthority(env) {
  const hc = requireHardCutover(env);
  if (!hc.ok) return stepResult("A-G3", false, hc.code, hc.details);

  const lsGate = assertDashboardAnalyticsLocalStorageAllowed(env);
  const coachingGate = assertCoachingLegacyAuthorityAllowed(env);
  if (lsGate.ok === true || coachingGate.ok === true) {
    return stepResult("A-G3", false, GLOBAL_PROBE_CODE.LOCALSTORAGE_SOT_ACTIVE, {
      criterion: "NO_LOCALSTORAGE_AUTHORITY",
      dashboardLocalStorageAllowed: lsGate.ok === true,
      coachingLegacyAllowed: coachingGate.ok === true,
    });
  }

  const clubBlob = RUNTIME_AUTHORITY_MATRIX.find((e) => e.domain === "club_blob_local");
  const clubBlobForbidden = /forbidden|cache-only/i.test(
    String(clubBlob?.canonicalWriter || "")
  );
  if (!clubBlob || !clubBlobForbidden) {
    return stepResult("A-G3", false, GLOBAL_PROBE_CODE.NOT_CERTIFIED, {
      criterion: "NO_LOCALSTORAGE_AUTHORITY",
      reason: "club_blob_local not declared forbidden/cache-only under HC",
    });
  }

  return stepResult("A-G3", true, GLOBAL_PROBE_CODE.OK, {
    criterion: "NO_LOCALSTORAGE_AUTHORITY",
    dashboardBlockedCode: lsGate.code,
    coachingBlockedCode: coachingGate.code,
  });
}

/**
 * A-G4 — mock/demo persistence forbidden under HC.
 */
export function probeNoMockPersistence(env) {
  const hc = requireHardCutover(env);
  if (!hc.ok) return stepResult("A-G4", false, hc.code, hc.details);

  const mockGate = assertMockPersistenceAllowed("mock", env);
  const dashMock = assertDashboardAnalyticsMockAllowed(env);
  const msgDemo = assertMessagingDemoAuthorityAllowed(env);
  if (mockGate.ok === true || dashMock.ok === true || msgDemo.ok === true) {
    return stepResult("A-G4", false, GLOBAL_PROBE_CODE.MOCK_PERSISTENCE_ACTIVE, {
      criterion: "NO_MOCK_PERSISTENCE",
      mockAllowed: mockGate.ok === true,
      dashboardMockAllowed: dashMock.ok === true,
      messagingDemoAllowed: msgDemo.ok === true,
    });
  }

  return stepResult("A-G4", true, GLOBAL_PROBE_CODE.OK, {
    criterion: "NO_MOCK_PERSISTENCE",
    blockedCodes: [mockGate.code, dashMock.code, msgDemo.code],
  });
}

/**
 * A-G5 — missing backend must be typed fail-closed, never silent invent.
 */
export function probeNoSilentFallback(env) {
  const hc = requireHardCutover(env);
  if (!hc.ok) return stepResult("A-G5", false, hc.code, hc.details);

  const silent = rejectSilentFallback("probe");
  if (
    silent.ok !== false ||
    silent.code !== LEGACY_AUTHORITY_ERROR.SILENT_FALLBACK_FORBIDDEN
  ) {
    return stepResult("A-G5", false, GLOBAL_PROBE_CODE.SILENT_FALLBACK_ACTIVE, {
      criterion: "NO_SILENT_FALLBACK",
      rejectSilentFallback: silent,
    });
  }

  const missingFailClosed = RUNTIME_AUTHORITY_MATRIX.filter(
    (entry) => !String(entry.failClosedError || "").trim()
  );
  if (missingFailClosed.length > 0) {
    return stepResult("A-G5", false, GLOBAL_PROBE_CODE.NOT_CERTIFIED, {
      criterion: "NO_SILENT_FALLBACK",
      domainsMissingFailClosed: missingFailClosed.map((e) => e.domain),
    });
  }

  return stepResult("A-G5", true, GLOBAL_PROBE_CODE.OK, {
    criterion: "NO_SILENT_FALLBACK",
    matrixFailClosedCount: RUNTIME_AUTHORITY_MATRIX.length,
  });
}

/**
 * A-G6 — no dual active authorities for the same domain concern.
 */
export function probeNoHybridRuntime(env) {
  const hc = requireHardCutover(env);
  if (!hc.ok) return stepResult("A-G6", false, hc.code, hc.details);

  const clubCloud = RUNTIME_AUTHORITY_MATRIX.find((e) => e.domain === "club_cloud");
  const clubBlob = RUNTIME_AUTHORITY_MATRIX.find((e) => e.domain === "club_blob_local");
  const clubBlobIsSoT = clubBlob
    ? !/forbidden|cache-only/i.test(String(clubBlob.canonicalWriter || ""))
    : true;
  if (!clubCloud || clubBlobIsSoT) {
    return stepResult("A-G6", false, GLOBAL_PROBE_CODE.HYBRID_RUNTIME, {
      criterion: "NO_HYBRID_RUNTIME",
      concern: "club_cloud vs club_blob_local",
      clubBlobWriter: clubBlob?.canonicalWriter || null,
    });
  }

  // Competition SSOT must be exclusive when remote SSOT flag is on.
  if (isCompetitionRemoteSsotEnabled(env)) {
    const inMemory = assertMatchLiveDirectWriteAllowed(env);
    if (inMemory.ok === true) {
      return stepResult("A-G6", false, GLOBAL_PROBE_CODE.HYBRID_RUNTIME, {
        criterion: "NO_HYBRID_RUNTIME",
        concern: "competition_ssot vs tournament_match_live direct write",
      });
    }
  }

  return stepResult("A-G6", true, GLOBAL_PROBE_CODE.OK, {
    criterion: "NO_HYBRID_RUNTIME",
    competitionRemoteSsot: isCompetitionRemoteSsotEnabled(env),
    clubBlobAuthority: "cache-only/forbidden",
  });
}

/**
 * Run A-G1..A-G6 in order.
 * @param {Record<string, unknown>|undefined|null} env
 */
export function runOperatorAcceptanceGlobalProbes(env) {
  return [
    probeOneCanonicalWriterPerDomain(env),
    probeNoLegacyWriter(env),
    probeNoLocalStorageAuthority(env),
    probeNoMockPersistence(env),
    probeNoSilentFallback(env),
    probeNoHybridRuntime(env),
  ];
}
