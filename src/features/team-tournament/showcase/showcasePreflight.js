/**
 * P1.5A Showcase — pre-flight validation (no DB write, no engine run).
 */

import { getPlayerGenderKey } from "../../../models/player.js";
import { listGroupDivisionOptions } from "../engines/teamGroupDivisionPolicy.js";
import { DEFAULT_ENGINE_VERSION } from "../canonical/teamTournamentMutationEnvelope.js";
import { isSetupMutationFoundationEnabled } from "../setup/setupMutationFeatureGate.js";
import { SHOWCASE_DEFAULT_TEAM_COUNT } from "./showcaseConstants.js";

function asList(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * @param {object} input
 * @returns {{ ok: boolean, blockers: string[], warnings: string[], summary: object }}
 */
export function buildShowcasePreflight(input = {}) {
  const athletes = asList(input.athletes || input.players);
  const blockers = [];
  const warnings = [];

  const tournamentName =
    input.tournamentName || input.tournament?.name || "Giải đấu đồng đội";
  const clubName = input.clubName || input.club?.name || input.clubId || "—";
  const requestedTeamCount = Math.max(
    0,
    Number(input.requestedTeamCount ?? SHOWCASE_DEFAULT_TEAM_COUNT) || 0
  );

  if (athletes.length === 0) {
    blockers.push("Chưa chọn vận động viên cho lễ bốc thăm.");
  }

  const missingIdentity = athletes.filter((athlete) => !String(athlete?.id || "").trim());
  if (missingIdentity.length) {
    blockers.push(`Thiếu athletes.id cho ${missingIdentity.length} vận động viên.`);
  }

  if (input.athleteRepositoryError) {
    blockers.push(
      String(input.athleteRepositoryError.message || input.athleteRepositoryError)
    );
  }

  const males = athletes.filter((a) => getPlayerGenderKey(a.gender) === "male");
  const females = athletes.filter((a) => getPlayerGenderKey(a.gender) === "female");
  const expectedTeamCount = Math.min(
    requestedTeamCount,
    Math.floor(males.length / 2),
    Math.floor(females.length / 2)
  );
  const expectedWaiting = Math.max(0, athletes.length - expectedTeamCount * 4);

  if (requestedTeamCount < 2) {
    blockers.push("Số đội yêu cầu không hợp lệ (tối thiểu 2).");
  }
  if (expectedTeamCount < requestedTeamCount) {
    blockers.push(
      `Không đủ nam/nữ để tạo ${requestedTeamCount} đội MLP (dự kiến chỉ ${expectedTeamCount}).`
    );
  }
  if (males.length < requestedTeamCount * 2 || females.length < requestedTeamCount * 2) {
    blockers.push("Thiếu số lượng nam/nữ cho định dạng MLP 2 nam + 2 nữ mỗi đội.");
  }

  const rulesVersion = String(input.rulesVersion || "").trim();
  if (!rulesVersion && input.requireRulesVersion !== false) {
    blockers.push("Thiếu rulesVersion — không thể bắt đầu lễ bốc thăm.");
  }

  if (input.fatalConflicts === true || (asList(input.fatalConflictList).length > 0)) {
    blockers.push("Có xung đột quy tắc bắt buộc (fatalConflicts).");
  }
  if (input.blockedByPolicy === true) {
    blockers.push("Bị chặn bởi chính sách pairing (blockedByPolicy).");
  }

  if (input.setupBlocked === true) {
    blockers.push(
      input.setupBlockCode
        ? `Setup bị khóa (${input.setupBlockCode}).`
        : "Setup bị khóa — không thể bắt đầu lễ bốc thăm."
    );
  }

  const gateOn =
    input.setupMutationGate === true ||
    isSetupMutationFoundationEnabled(input.envSource);
  if (input.requireSetupMutationGate !== false && !gateOn) {
    blockers.push(
      "Setup mutation v7 đang tắt — Preview gate chưa cho phép lưu kết quả lễ bốc thăm."
    );
  }

  if (input.canManage === false) {
    blockers.push("Chỉ BTC / Super Admin mới được bắt đầu lễ bốc thăm.");
  }
  if (input.tournamentEditable === false) {
    blockers.push("Giải đấu không còn chỉnh sửa được.");
  }

  const withRating = athletes.filter((a) => {
    const value = Number(a.rating ?? a.level ?? a.ratingValue);
    return Number.isFinite(value) && value > 0;
  });
  const ratingCoverage =
    athletes.length === 0 ? 0 : Math.round((withRating.length / athletes.length) * 100);

  if (ratingCoverage < 100) {
    warnings.push(`Chỉ ${ratingCoverage}% VĐV có trình độ canonical.`);
  }

  const softRuleSummary = input.softRuleSummary || {
    applied: Number(input.softRulesApplied || 0),
    missed: Number(input.softRulesMissed || 0),
  };

  const groupOptions = listGroupDivisionOptions(expectedTeamCount || requestedTeamCount);

  const summary = {
    tournamentName,
    clubName,
    athleteCount: athletes.length,
    maleCount: males.length,
    femaleCount: females.length,
    requestedTeamCount,
    expectedTeamCount,
    expectedWaitingListCount: expectedWaiting,
    groupOptions,
    engineVersion: input.engineVersion || DEFAULT_ENGINE_VERSION,
    rulesVersion: rulesVersion || null,
    hardRuleResult: input.hardRuleResult || (blockers.length ? "FAIL" : "PASS"),
    softRuleSummary,
    identityDiagnostics: {
      total: athletes.length,
      missingIdCount: missingIdentity.length,
      withPairingIdentity: athletes.filter(
        (a) => a.pairingIdentityId || a.athleteId || a.id
      ).length,
    },
    ratingCoverage,
    mlpCompositionOk:
      expectedTeamCount >= requestedTeamCount &&
      males.length >= requestedTeamCount * 2 &&
      females.length >= requestedTeamCount * 2,
  };

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    summary,
  };
}

/**
 * Entry CTA visibility for Team Tournament setup.
 */
export function canShowShowcaseEntry(input = {}) {
  if (input.canManage !== true) return false;
  if (input.tournamentEditable === false) return false;
  if (input.setupBlocked === true) return false;
  const athletes = asList(input.athletes || input.players);
  if (!athletes.length || input.athletePoolLoaded === false) return false;
  if (input.athleteRepositoryError) return false;
  const gateOn =
    input.setupMutationGate === true ||
    isSetupMutationFoundationEnabled(input.envSource);
  if (!gateOn) return false;
  return true;
}

/**
 * Replay CTA — persisted teams + groups available.
 */
export function canShowShowcaseReplay(input = {}) {
  if (input.canManage !== true) return false;
  const teams = asList(input.teams || input.teamData?.teams);
  const groups = asList(input.groups || input.teamData?.groups);
  return teams.length >= 2 && groups.length >= 2;
}
