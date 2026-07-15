/**
 * PHASE 45B.2 — Pairing candidate service (public gateway).
 *
 * listCandidates(query, dependencies?) → contract object (never a bare array).
 * No blob roster reads. No React. No UI cutover in this phase.
 */

import {
  PAIRING_CANDIDATE_GATEWAY_VERSION,
  PAIRING_CANDIDATE_STATUS,
  buildPairingCandidateResponse,
} from "./pairingCandidateContract.js";
import { PAIRING_CANDIDATE_REASON_CODES } from "./pairingCandidateReasonCodes.js";
import { mapPairingIdentities } from "./pairingIdentityMapper.js";
import {
  evaluateAllPairingEligibility,
  applyOptionalPrivatePairingSeam,
} from "./pairingEligibilityEvaluator.js";
import { createCanonicalAthleteRepository } from "./canonicalAthleteRepository.js";

function normalizeId(value) {
  return String(value || "").trim();
}

function compareCandidates(a, b) {
  const nameA = String(a.displayName || "").toLocaleLowerCase();
  const nameB = String(b.displayName || "").toLocaleLowerCase();
  if (nameA < nameB) return -1;
  if (nameA > nameB) return 1;
  const idA = String(a.athleteId || "");
  const idB = String(b.athleteId || "");
  if (idA < idB) return -1;
  if (idA > idB) return 1;
  return 0;
}

/**
 * @param {object} [deps]
 */
export function createPairingCandidateService(deps = {}) {
  const athleteRepository =
    deps.athleteRepository ||
    createCanonicalAthleteRepository({
      listScopeRows: deps.listScopeRows,
      loadAthletes: deps.loadAthletes,
      loadMemberships: deps.loadMemberships,
    });

  /**
   * Optional seam — must NOT import private-pairing engines by default.
   * @type {(query: object, candidates: object[]) => Promise<object|null>|object|null}
   */
  const evaluatePrivatePairingRules = deps.evaluatePrivatePairingRules || null;

  /**
   * @param {object} query
   * @param {object} [runtimeDeps]
   */
  async function listCandidates(query = {}, runtimeDeps = {}) {
    const warnings = [];
    const clubId = normalizeId(query.clubId);
    const tenantId = normalizeId(query.tenantId) || null;
    const scope = {
      clubId: clubId || null,
      tenantId,
      tournamentId: query.tournamentId || null,
      eventType: query.eventType || null,
      teamId: query.teamId || null,
    };

    if (!clubId) {
      return buildPairingCandidateResponse({
        status: PAIRING_CANDIDATE_STATUS.ERROR,
        candidates: [],
        excluded: [],
        summary: {
          sourceCount: 0,
          eligibleCount: 0,
          excludedCount: 0,
          byReason: { [PAIRING_CANDIDATE_REASON_CODES.WRONG_SCOPE]: 1 },
        },
        diagnostics: {
          scope,
          identityCoverage: { mapped: 0, derived: 0, unmapped: 0 },
          sourceBreakdown: {
            athleteRows: 0,
            membershipRows: 0,
            activeMembershipRows: 0,
            preEligibilityRows: 0,
            eligibleRows: 0,
          },
          gatewayVersion: PAIRING_CANDIDATE_GATEWAY_VERSION,
          warnings: ["clubId is required"],
          error: {
            code: PAIRING_CANDIDATE_REASON_CODES.WRONG_SCOPE,
            message: "clubId is required for pairingCandidateService.listCandidates.",
          },
        },
      });
    }

    const repo =
      runtimeDeps.athleteRepository ||
      athleteRepository;
    const repoResult = await repo.listInScope({
      ...scope,
      userContext: query.userContext,
    });

    if (!repoResult?.ok) {
      return buildPairingCandidateResponse({
        status: PAIRING_CANDIDATE_STATUS.ERROR,
        candidates: [],
        excluded: [],
        summary: { sourceCount: 0, eligibleCount: 0, excludedCount: 0, byReason: {} },
        diagnostics: {
          scope,
          identityCoverage: { mapped: 0, derived: 0, unmapped: 0 },
          sourceBreakdown: {
            athleteRows: repoResult?.sourceBreakdown?.athleteRows || 0,
            membershipRows: repoResult?.sourceBreakdown?.membershipRows || 0,
            activeMembershipRows:
              repoResult?.sourceBreakdown?.activeMembershipRows || 0,
            preEligibilityRows: 0,
            eligibleRows: 0,
            registeredRows: repoResult?.sourceBreakdown?.registeredRows,
          },
          gatewayVersion: PAIRING_CANDIDATE_GATEWAY_VERSION,
          warnings,
          error: {
            code: repoResult?.error?.code || "REPOSITORY_ERROR",
            message:
              repoResult?.error?.message ||
              "canonicalAthleteRepository.listInScope failed.",
          },
        },
      });
    }

    const rows = Array.isArray(repoResult.rows) ? repoResult.rows : [];
    const { seeds, excluded: identityExcluded, identityCoverage } =
      mapPairingIdentities(rows);

    const { candidates: eligibleSeeds, excluded: eligibilityExcluded } =
      evaluateAllPairingEligibility(seeds, query);

    let candidates = eligibleSeeds;
    let ruleExcluded = [];
    let status = PAIRING_CANDIDATE_STATUS.READY;
    let blockedError = null;

    const applyRules = query.applyPrivatePairingRules === true;
    const ruleFn = runtimeDeps.evaluatePrivatePairingRules || evaluatePrivatePairingRules;
    if (applyRules && typeof ruleFn === "function") {
      const ruleResult = await ruleFn(query, candidates);
      const applied = applyOptionalPrivatePairingSeam(candidates, ruleResult);
      candidates = applied.candidates;
      ruleExcluded = applied.excluded || [];
      if (applied.status === PAIRING_CANDIDATE_STATUS.BLOCKED) {
        status = PAIRING_CANDIDATE_STATUS.BLOCKED;
        blockedError = applied.error || {
          code: PAIRING_CANDIDATE_REASON_CODES.FATAL_RULE_CONFLICT,
          message: "Private pairing blocked.",
        };
      }
    } else if (applyRules && typeof ruleFn !== "function") {
      warnings.push(
        "applyPrivatePairingRules requested but no evaluatePrivatePairingRules seam provided"
      );
    }

    candidates = [...candidates].sort(compareCandidates);
    const excluded = [...identityExcluded, ...eligibilityExcluded, ...ruleExcluded];

    const registeredRows = query.requireRegistration
      ? rows.filter((r) => r.registrationStatus).length
      : undefined;

    const sourceBreakdown = {
      athleteRows: repoResult.sourceBreakdown?.athleteRows ?? rows.length,
      membershipRows: repoResult.sourceBreakdown?.membershipRows ?? 0,
      activeMembershipRows: repoResult.sourceBreakdown?.activeMembershipRows ?? 0,
      registeredRows,
      preEligibilityRows: seeds.length,
      eligibleRows: candidates.length,
    };

    return buildPairingCandidateResponse({
      status,
      candidates,
      excluded,
      summary: {
        sourceCount: rows.length,
        eligibleCount: candidates.length,
        excludedCount: excluded.length,
      },
      diagnostics: {
        scope,
        identityCoverage,
        sourceBreakdown,
        gatewayVersion: PAIRING_CANDIDATE_GATEWAY_VERSION,
        warnings,
        ...(blockedError ? { error: blockedError } : {}),
      },
    });
  }

  return {
    listCandidates,
  };
}

export const pairingCandidateService = createPairingCandidateService();
