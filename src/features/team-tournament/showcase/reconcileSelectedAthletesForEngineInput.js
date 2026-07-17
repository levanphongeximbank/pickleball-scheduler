/**
 * Selected-athlete reconciliation before Showcase / AI team generation.
 * Never silently drop athletes — every exclusion must carry an explicit reason.
 */

import {
  athleteGenderDisplayLabel,
  normalizeAthleteGender,
} from "../../../models/player.js";

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeId(value) {
  return String(value ?? "").trim();
}

function athleteEligible(athlete) {
  if (!athlete || typeof athlete !== "object") return false;
  if (athlete.eligible === false) return false;
  if (athlete.ineligible === true) return false;
  const status = String(athlete.eligibilityStatus || athlete.status || "").toLowerCase();
  if (["inactive", "withdrawn", "banned", "ineligible"].includes(status)) return false;
  return true;
}

function resolveAthlete(poolById, selectedId) {
  const id = normalizeId(selectedId);
  if (!id) return null;
  return poolById.get(id) || null;
}

/**
 * @param {object} input
 * @returns {{
 *   ok: boolean,
 *   selectedCount: number,
 *   canonicalIdentityCount: number,
 *   genderNormalizedCount: number,
 *   eligibleCount: number,
 *   finalEngineInputCount: number,
 *   finalAthletes: object[],
 *   removals: object[],
 *   blockers: string[],
 *   message: string|null,
 * }}
 */
export function reconcileSelectedAthletesForEngineInput({
  athletes = [],
  selectedAthleteIds = [],
  requestedTeamCount = 8,
  athletesPerTeam = 4,
  requireMlpBalance = true,
  allowUnknownGender = false,
} = {}) {
  const selectedIds = asList(selectedAthleteIds).map(normalizeId).filter(Boolean);
  const selectedCount = selectedIds.length;
  const uniqueSelected = [...new Set(selectedIds)];

  const poolById = new Map();
  for (const athlete of asList(athletes)) {
    const id = normalizeId(athlete?.athleteId || athlete?.id);
    if (id && !poolById.has(id)) poolById.set(id, athlete);
  }

  const removals = [];
  const kept = [];
  let canonicalIdentityCount = 0;
  let genderNormalizedCount = 0;
  let eligibleCount = 0;

  for (const selectedId of uniqueSelected) {
    const athlete = resolveAthlete(poolById, selectedId);
    if (!athlete) {
      removals.push({
        athleteName: selectedId,
        athleteId: selectedId,
        rawGender: null,
        normalizedGender: "unknown",
        club: null,
        eligibilityStatus: "missing_from_pool",
        removalReason: "MISSING_FROM_POOL",
      });
      continue;
    }

    const athleteId = normalizeId(athlete.athleteId || athlete.id);
    const rawGender = athlete.gender ?? athlete.sex ?? athlete.gioiTinh ?? null;
    const normalizedGender = normalizeAthleteGender(athlete);
    const club =
      athlete.clubName ||
      athlete.clubId ||
      athlete.sourceClubId ||
      athlete.membershipClubId ||
      null;
    const eligible = athleteEligible(athlete);

    if (!athleteId) {
      removals.push({
        athleteName: athlete.name || athlete.displayName || selectedId,
        athleteId: selectedId,
        rawGender,
        normalizedGender,
        club,
        eligibilityStatus: "missing_identity",
        removalReason: "MISSING_CANONICAL_IDENTITY",
      });
      continue;
    }
    canonicalIdentityCount += 1;

    if (normalizedGender === "unknown" && !allowUnknownGender) {
      removals.push({
        athleteName: athlete.name || athlete.displayName || athleteId,
        athleteId,
        rawGender,
        normalizedGender,
        club,
        eligibilityStatus: eligible ? "eligible" : "ineligible",
        removalReason: "UNKNOWN_GENDER",
      });
      continue;
    }
    genderNormalizedCount += 1;

    if (!eligible) {
      removals.push({
        athleteName: athlete.name || athlete.displayName || athleteId,
        athleteId,
        rawGender,
        normalizedGender,
        club,
        eligibilityStatus: String(athlete.eligibilityStatus || athlete.status || "ineligible"),
        removalReason: "INELIGIBLE",
      });
      continue;
    }
    eligibleCount += 1;
    kept.push({
      ...athlete,
      id: athleteId,
      athleteId,
      gender: normalizedGender,
      genderLabel: athleteGenderDisplayLabel(normalizedGender),
    });
  }

  const finalAthletes = kept;
  const finalEngineInputCount = finalAthletes.length;
  const blockers = [];

  if (selectedCount !== finalEngineInputCount) {
    blockers.push(
      `Bạn đã chọn ${selectedCount} VĐV nhưng hệ thống chỉ xác nhận ${finalEngineInputCount} VĐV hợp lệ.`
    );
  }

  if (uniqueSelected.length !== selectedCount) {
    blockers.push("Danh sách chọn có ID trùng lặp — đã loại bỏ bản trùng.");
  }

  if (requireMlpBalance) {
    const males = finalAthletes.filter((a) => normalizeAthleteGender(a) === "male");
    const females = finalAthletes.filter((a) => normalizeAthleteGender(a) === "female");
    const needed = Number(requestedTeamCount) * Number(athletesPerTeam);
    const neededMale = Number(requestedTeamCount) * 2;
    const neededFemale = Number(requestedTeamCount) * 2;

    if (finalEngineInputCount !== needed) {
      blockers.push(
        `MLP ${requestedTeamCount} đội cần đúng ${needed} VĐV hợp lệ (hiện ${finalEngineInputCount}).`
      );
    }
    if (males.length !== neededMale || females.length !== neededFemale) {
      blockers.push(
        `MLP yêu cầu ${neededMale} nam + ${neededFemale} nữ (hiện ${males.length} nam / ${females.length} nữ).`
      );
    }
    if (finalAthletes.some((a) => normalizeAthleteGender(a) === "unknown")) {
      blockers.push("Không được bắt đầu lễ khi còn VĐV giới tính unknown.");
    }
  }

  return {
    ok: blockers.length === 0 && removals.length === 0,
    selectedCount,
    canonicalIdentityCount,
    genderNormalizedCount,
    eligibleCount,
    finalEngineInputCount,
    finalAthletes,
    removals,
    blockers,
    message: blockers[0] || null,
  };
}
