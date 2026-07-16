/**
 * P1.5A Unified Showcase Control Center — pure setup model.
 * No engines, no persistence, no React.
 */

import { getPlayerGenderKey } from "../../../models/player.js";
import { resolveCanonicalAthleteRating } from "../../pairing-candidates/canonicalAthleteRating.js";
import { FORMAT_PRESET } from "../constants.js";
import { listGroupDivisionOptions } from "../engines/teamGroupDivisionPolicy.js";
import { SHOWCASE_DEFAULT_TEAM_COUNT } from "./showcaseConstants.js";

export const SHOWCASE_CLUB_SCOPE = Object.freeze({
  TENANT: "tenant",
  CLUB: "club",
  HOST: "host",
});

export const SHOWCASE_ATHLETES_PER_TEAM_MLP = 4;
export const SHOWCASE_MLP_MALE_PER_TEAM = 2;
export const SHOWCASE_MLP_FEMALE_PER_TEAM = 2;

function normalizeId(value) {
  return String(value || "").trim();
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * @param {object} input
 * @returns {boolean}
 */
export function tournamentAllowsTenantAthleteScope(input = {}) {
  const tournament = input.tournament || null;
  if (!tournament) return true;
  if (tournament.settings?.allowTenantAthleteScope === true) return true;
  if (tournament.settings?.athleteScopeMode === "tenant") return true;
  return !normalizeId(tournament.clubId);
}

/**
 * @param {object} input
 * @returns {boolean}
 */
export function isShowcaseHostClubRestricted(input = {}) {
  const hostClubId = normalizeId(input.hostClubId || input.tournament?.clubId);
  if (!hostClubId) return false;
  return !tournamentAllowsTenantAthleteScope(input);
}

/**
 * Filter clubs the Owner may pick in showcase setup.
 *
 * @param {{ clubs?: object[], user?: object|null, canSelectTenantScope?: boolean, canManageClub?: Function }} input
 */
export function resolveShowcasePermittedClubs(input = {}) {
  const clubs = asList(input.clubs);
  const canManageClub =
    typeof input.canManageClub === "function"
      ? input.canManageClub
      : () => true;

  if (input.canSelectTenantScope === true) {
    return clubs;
  }

  return clubs.filter((club) => canManageClub(input.user, club));
}

/**
 * Resolve club scope UI + lock reason.
 */
export function resolveShowcaseClubScopeConfig(input = {}) {
  const hostClubId = normalizeId(input.hostClubId || input.tournament?.clubId);
  const hostRestricted = isShowcaseHostClubRestricted({
    tournament: input.tournament,
    hostClubId,
  });
  const permittedClubs = resolveShowcasePermittedClubs(input);
  const canSelectTenantScope =
    input.canSelectTenantScope === true && !hostRestricted;

  const requestedScope = normalizeId(input.scopeMode) || SHOWCASE_CLUB_SCOPE.CLUB;
  let scopeMode = requestedScope;
  let locked = false;
  let lockReason = "";

  if (hostRestricted && hostClubId) {
    scopeMode = SHOWCASE_CLUB_SCOPE.HOST;
    locked = true;
    lockReason = "Giải này chỉ sử dụng VĐV thuộc CLB chủ quản.";
  } else if (scopeMode === SHOWCASE_CLUB_SCOPE.TENANT && !canSelectTenantScope) {
    scopeMode = hostClubId ? SHOWCASE_CLUB_SCOPE.HOST : SHOWCASE_CLUB_SCOPE.CLUB;
    locked = Boolean(hostClubId);
    lockReason = locked ? lockReason : "";
  }

  const selectedClubId =
    scopeMode === SHOWCASE_CLUB_SCOPE.TENANT
      ? ""
      : normalizeId(input.selectedClubId) ||
        hostClubId ||
        normalizeId(permittedClubs[0]?.id) ||
        "";

  return {
    scopeMode,
    selectedClubId,
    hostClubId,
    permittedClubs,
    canSelectTenantScope,
    locked,
    lockReason,
    scopeOptions: [
      ...(canSelectTenantScope
        ? [{ value: SHOWCASE_CLUB_SCOPE.TENANT, label: "Tất cả CLB được phép quản lý" }]
        : []),
      ...permittedClubs.map((club) => ({
        value: SHOWCASE_CLUB_SCOPE.CLUB,
        clubId: normalizeId(club.id),
        label: club.name || club.id,
      })),
      ...(hostClubId
        ? [
            {
              value: SHOWCASE_CLUB_SCOPE.HOST,
              clubId: hostClubId,
              label: "CLB chủ quản giải",
            },
          ]
        : []),
    ],
  };
}

/**
 * Merge + dedupe athletes by athletes.id for showcase pool.
 */
export function mergeShowcaseAthletePool({
  scopeMode = SHOWCASE_CLUB_SCOPE.CLUB,
  clubAthletes = [],
  tenantAthletes = [],
  clubs = [],
  selectedClubId = "",
  hostClubId = "",
} = {}) {
  const source =
    scopeMode === SHOWCASE_CLUB_SCOPE.TENANT
      ? [...asList(tenantAthletes), ...asList(clubAthletes)]
      : asList(clubAthletes);

  const effectiveClubId =
    scopeMode === SHOWCASE_CLUB_SCOPE.HOST
      ? normalizeId(hostClubId)
      : scopeMode === SHOWCASE_CLUB_SCOPE.CLUB
        ? normalizeId(selectedClubId)
        : "";

  const clubNamesById = new Map(
    asList(clubs)
      .map((club) => [normalizeId(club?.id), String(club?.name || "").trim()])
      .filter(([clubId, clubName]) => clubId && clubName)
  );
  const byId = new Map();
  for (const athlete of source) {
    const id = normalizeId(athlete?.athleteId || athlete?.id);
    if (!id) continue;

    const existing = byId.get(id);
    const athleteClubId = normalizeId(athlete.clubId || athlete.membershipClubId);
    const clubLabel =
      athlete.clubName ||
      athlete.club?.name ||
      athlete.membershipClubName ||
      athlete.hostClubName ||
      clubNamesById.get(athleteClubId) ||
      "";
    const next = {
      ...athlete,
      id,
      athleteId: id,
      clubName: clubLabel || existing?.clubName || "",
      membershipStatus:
        athlete.membershipStatus || athlete.status || existing?.membershipStatus || "active",
    };

    if (!existing) {
      byId.set(id, next);
      continue;
    }

    if (effectiveClubId && normalizeId(athlete.clubId) === effectiveClubId) {
      byId.set(id, { ...existing, ...next, clubName: next.clubName || existing.clubName });
    }
  }

  return [...byId.values()];
}

function athleteEligible(athlete) {
  const id = normalizeId(athlete?.athleteId || athlete?.id);
  if (!id) return false;
  const status = String(athlete.membershipStatus || athlete.status || "active").toLowerCase();
  if (status === "inactive" || status === "removed" || status === "rejected") {
    return false;
  }
  return true;
}

/**
 * Live athlete counters for setup UI.
 */
export function buildShowcaseAthleteCounters(athletes = [], selectedAthleteIds = []) {
  const selected = new Set(asList(selectedAthleteIds).map(normalizeId).filter(Boolean));
  const pool = asList(athletes);

  let availableEligible = 0;
  let male = 0;
  let female = 0;
  let unknownGender = 0;
  let withRating = 0;
  let withoutRating = 0;
  let missingIdentity = 0;
  let ineligible = 0;

  for (const athlete of pool) {
    const id = normalizeId(athlete?.athleteId || athlete?.id);
    if (!id) {
      missingIdentity += 1;
      continue;
    }
    if (!athleteEligible(athlete)) {
      ineligible += 1;
      continue;
    }
    availableEligible += 1;

    const gender = getPlayerGenderKey(athlete.gender);
    if (gender === "male") male += 1;
    else if (gender === "female") female += 1;
    else unknownGender += 1;

    const rating = resolveCanonicalAthleteRating(athlete);
    if (Number.isFinite(rating?.ratingValue) && rating.ratingValue > 0) {
      withRating += 1;
    } else {
      withoutRating += 1;
    }
  }

  let selectedMale = 0;
  let selectedFemale = 0;
  let selectedUnknown = 0;
  let selectedMissingIdentity = 0;
  let selectedIneligible = 0;
  let selectedWithRating = 0;
  let selectedWithoutRating = 0;

  for (const athlete of pool) {
    const id = normalizeId(athlete?.athleteId || athlete?.id);
    if (!selected.has(id)) continue;
    if (!id) {
      selectedMissingIdentity += 1;
      continue;
    }
    if (!athleteEligible(athlete)) {
      selectedIneligible += 1;
      continue;
    }
    const gender = getPlayerGenderKey(athlete.gender);
    if (gender === "male") selectedMale += 1;
    else if (gender === "female") selectedFemale += 1;
    else selectedUnknown += 1;

    const rating = resolveCanonicalAthleteRating(athlete);
    if (Number.isFinite(rating?.ratingValue) && rating.ratingValue > 0) {
      selectedWithRating += 1;
    } else {
      selectedWithoutRating += 1;
    }
  }

  return {
    totalAvailable: pool.length,
    availableEligible,
    selectedCount: selected.size,
    male,
    female,
    unknownGender,
    withRating,
    withoutRating,
    missingIdentity,
    ineligible,
    selectedMale,
    selectedFemale,
    selectedUnknown,
    selectedMissingIdentity,
    selectedIneligible,
    selectedWithRating,
    selectedWithoutRating,
  };
}

/**
 * Filter athletes for list display. Selected athletes stay visible even when filtered out.
 */
export function filterShowcaseAthletesForDisplay(
  athletes = [],
  {
    search = "",
    genderFilter = "all",
    clubFilter = "all",
    showSelectedOnly = false,
    selectedAthleteIds = [],
  } = {}
) {
  const selected = new Set(asList(selectedAthleteIds).map(normalizeId).filter(Boolean));
  const query = String(search || "").trim().toLowerCase();

  return asList(athletes).filter((athlete) => {
    const id = normalizeId(athlete?.athleteId || athlete?.id);
    const isSelected = selected.has(id);

    if (showSelectedOnly && !isSelected) return false;

    if (genderFilter === "male" || genderFilter === "female") {
      const gender = getPlayerGenderKey(athlete.gender);
      if (!isSelected && gender !== genderFilter) return false;
    }

    if (clubFilter !== "all") {
      const clubId = normalizeId(athlete.clubId || athlete.membershipClubId);
      if (!isSelected && clubId !== normalizeId(clubFilter)) return false;
    }

    if (query) {
      const haystack = [
        athlete.name,
        athlete.displayName,
        athlete.clubName,
        id,
      ]
        .map((part) => String(part || "").toLowerCase())
        .join(" ");
      if (!isSelected && !haystack.includes(query)) return false;
    }

    return true;
  });
}

export function selectAllEligibleShowcaseAthletes(athletes = []) {
  const eligibleIds = asList(athletes)
    .filter(athleteEligible)
    .map((athlete) => normalizeId(athlete?.athleteId || athlete?.id))
    .filter(Boolean);
  return [...new Set(eligibleIds)];
}

export function clearShowcaseAthleteSelection() {
  return [];
}

export function toggleShowcaseAthleteSelection(selectedAthleteIds = [], athleteId, checked) {
  const next = new Set(asList(selectedAthleteIds).map(normalizeId).filter(Boolean));
  const id = normalizeId(athleteId);
  if (!id) return [...next];
  if (checked) next.add(id);
  else next.delete(id);
  return [...next];
}

export function selectShowcaseAthletesByClub(athletes = [], selectedAthleteIds = [], clubId) {
  const next = new Set(asList(selectedAthleteIds).map(normalizeId).filter(Boolean));
  const targetClub = normalizeId(clubId);
  for (const athlete of asList(athletes)) {
    if (!athleteEligible(athlete)) continue;
    const athleteClubId = normalizeId(athlete.clubId || athlete.membershipClubId);
    const id = normalizeId(athlete?.athleteId || athlete?.id);
    if (id && athleteClubId === targetClub) next.add(id);
  }
  return [...next];
}

export function selectShowcaseAthletesByGender(athletes = [], selectedAthleteIds = [], gender) {
  const next = new Set(asList(selectedAthleteIds).map(normalizeId).filter(Boolean));
  const target = String(gender || "").toLowerCase();
  for (const athlete of asList(athletes)) {
    if (!athleteEligible(athlete)) continue;
    const id = normalizeId(athlete?.athleteId || athlete?.id);
    if (!id) continue;
    if (getPlayerGenderKey(athlete.gender) === target) next.add(id);
  }
  return [...next];
}

/**
 * MLP team configuration summary + blocking reasons.
 */
export function buildShowcaseTeamConfiguration({
  athletes = [],
  selectedAthleteIds = [],
  requestedTeamCount = SHOWCASE_DEFAULT_TEAM_COUNT,
  athletesPerTeam = SHOWCASE_ATHLETES_PER_TEAM_MLP,
  formatPreset = FORMAT_PRESET.MLP_4,
} = {}) {
  const selected = asList(athletes).filter((athlete) =>
    asList(selectedAthleteIds)
      .map(normalizeId)
      .includes(normalizeId(athlete?.athleteId || athlete?.id))
  );

  const eligibleSelected = selected.filter(athleteEligible);
  const males = eligibleSelected.filter((a) => getPlayerGenderKey(a.gender) === "male");
  const females = eligibleSelected.filter((a) => getPlayerGenderKey(a.gender) === "female");
  const unknownGender = eligibleSelected.filter((a) => !getPlayerGenderKey(a.gender));

  const malePerTeam =
    formatPreset === FORMAT_PRESET.MLP_4 ? SHOWCASE_MLP_MALE_PER_TEAM : Math.ceil(athletesPerTeam / 2);
  const femalePerTeam =
    formatPreset === FORMAT_PRESET.MLP_4 ? SHOWCASE_MLP_FEMALE_PER_TEAM : Math.floor(athletesPerTeam / 2);

  const maxByGender = Math.min(
    Math.floor(males.length / malePerTeam),
    Math.floor(females.length / femalePerTeam)
  );
  const expectedTeamCount = Math.min(
    Math.max(0, Number(requestedTeamCount) || 0),
    maxByGender
  );
  const usedAthletes = expectedTeamCount * athletesPerTeam;
  const expectedWaitingListCount = Math.max(0, eligibleSelected.length - usedAthletes);
  const surplusMale = Math.max(0, males.length - expectedTeamCount * malePerTeam);
  const surplusFemale = Math.max(0, females.length - expectedTeamCount * femalePerTeam);

  const blockers = [];
  const guidance = [];

  if (eligibleSelected.length === 0) {
    blockers.push("Chưa chọn VĐV hợp lệ cho ghép đội.");
  } else if (eligibleSelected.length < requestedTeamCount * athletesPerTeam) {
    guidance.push(
      `Chỉ có ${eligibleSelected.length} VĐV hợp lệ; cần tối thiểu ${requestedTeamCount * athletesPerTeam} VĐV để tạo ${requestedTeamCount} đội MLP.`
    );
  }

  if (unknownGender.length > 0) {
    guidance.push(`Có ${unknownGender.length} VĐV chưa có giới tính.`);
  }

  const missingIdentity = selected.filter(
    (athlete) => !normalizeId(athlete?.athleteId || athlete?.id)
  );
  if (missingIdentity.length > 0) {
    blockers.push(`Có ${missingIdentity.length} VĐV thiếu identity canonical.`);
  }

  const withoutRating = eligibleSelected.filter((athlete) => {
    const rating = resolveCanonicalAthleteRating(athlete);
    return !(Number.isFinite(rating?.ratingValue) && rating.ratingValue > 0);
  });
  if (withoutRating.length > 0) {
    guidance.push(
      `Có ${withoutRating.length} VĐV chưa có rating; vẫn được phép tiếp tục nếu không bị chặn bởi policy.`
    );
  }

  if (expectedTeamCount < requestedTeamCount) {
    blockers.push(
      `Đã chọn ${males.length} nam và ${females.length} nữ; chỉ có thể tạo tối đa ${expectedTeamCount} đội.`
    );
  }

  return {
    requestedTeamCount: Number(requestedTeamCount) || 0,
    athletesPerTeam,
    formatPreset,
    expectedTeamCount,
    expectedWaitingListCount,
    surplusMale,
    surplusFemale,
    maleCount: males.length,
    femaleCount: females.length,
    unknownGenderCount: unknownGender.length,
    blockers,
    guidance,
    canGenerateTeams: blockers.length === 0 && expectedTeamCount >= 2,
    groupOptions: listGroupDivisionOptions(expectedTeamCount || requestedTeamCount),
  };
}

/**
 * Owner-only team preview diagnostics from frozen session.
 */
export function buildShowcaseTeamPreviewDiagnostics(session) {
  const teamCards = asList(session?.teamCards);
  const allAthleteIds = teamCards.flatMap((team) =>
    asList(team.athletes).map((athlete) => normalizeId(athlete.id))
  );
  const duplicateAthletes = allAthleteIds.filter(
    (id, index) => allAthleteIds.indexOf(id) !== index
  );

  const ratings = teamCards.map((team) => Number(team.avgLevel || 0)).filter((v) => v > 0);
  const minRating = ratings.length ? Math.min(...ratings) : 0;
  const maxRating = ratings.length ? Math.max(...ratings) : 0;

  return {
    teamCount: teamCards.length,
    waitingListCount: asList(session?.waitingPlayerIds).length,
    allTeamsValid: teamCards.every(
      (team) =>
        asList(team.athletes).length === SHOWCASE_ATHLETES_PER_TEAM_MLP && team.genderOk === true
    ),
    duplicateAthleteIds: [...new Set(duplicateAthletes)],
    averageRating:
      ratings.length > 0
        ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 100) /
          100
        : 0,
    balanceSpread: Math.round((maxRating - minRating) * 100) / 100,
    engineVersion: session?.engineVersion || "",
    rulesVersion: session?.rulesVersion || "",
    engineInputHash: session?.engineInputHash || "",
    engineOutputHash: session?.engineOutputHash || "",
  };
}

export function buildShowcaseGroupPreviewDiagnostics(session) {
  const groupCards = asList(session?.groupSession?.groupCards);
  const teamIds = new Set(
    asList(session?.teamCards).map((team) => normalizeId(team.id)).filter(Boolean)
  );
  const assigned = new Set();
  const duplicateTeamIds = [];

  for (const group of groupCards) {
    for (const team of asList(group.teams)) {
      const teamId = normalizeId(team.id);
      if (!teamId) continue;
      if (assigned.has(teamId)) duplicateTeamIds.push(teamId);
      assigned.add(teamId);
    }
  }

  const missingTeamIds = [...teamIds].filter((id) => !assigned.has(id));

  return {
    groupCount: groupCards.length,
    groups: groupCards,
    balancingMethod: session?.groupSession?.seedingMode || "",
    duplicateTeamIds: [...new Set(duplicateTeamIds)],
    missingTeamIds,
    engineVersion: session?.engineVersion || "",
    rulesVersion: session?.rulesVersion || "",
    diagnostics: session?.groupSession?.diagnostics || null,
  };
}

/**
 * Assign / change captain in frozen preview only.
 */
export function assignShowcaseCaptain(session, { teamId, captainPlayerId }) {
  if (!session?.teamData?.teams?.length) {
    return { ok: false, error: "Chưa có kết quả đội." };
  }

  const normalizedTeamId = normalizeId(teamId);
  const normalizedCaptainId = normalizeId(captainPlayerId);
  const team = asList(session.teamCards).find((item) => normalizeId(item.id) === normalizedTeamId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  const rosterIds = new Set(asList(team.athletes).map((athlete) => normalizeId(athlete.id)));
  if (!rosterIds.has(normalizedCaptainId)) {
    return { ok: false, error: "Đội trưởng phải thuộc roster đội." };
  }

  const nextTeamData = {
    ...session.teamData,
    teams: asList(session.teamData.teams).map((item) =>
      normalizeId(item.id) === normalizedTeamId
        ? { ...item, captainPlayerId: normalizedCaptainId }
        : item
    ),
  };

  const nextTeamCards = asList(session.teamCards).map((item) => {
    if (normalizeId(item.id) !== normalizedTeamId) return item;
    return {
      ...item,
      captainPlayerId: normalizedCaptainId,
      athletes: asList(item.athletes).map((athlete) => ({
        ...athlete,
        isCaptain: normalizeId(athlete.id) === normalizedCaptainId,
      })),
    };
  });

  return {
    ok: true,
    session: {
      ...session,
      teamData: nextTeamData,
      teamCards: nextTeamCards,
    },
  };
}

/**
 * Disabled-button reasons for unified setup actions.
 */
export function buildShowcaseActionGates({
  counters = {},
  teamConfig = {},
  preflight = {},
  hasTeamPreview = false,
  hasGroupPreview = false,
  matchupPreview = null,
  mode = "live",
  saving = false,
} = {}) {
  const isReplay = mode === "replay";

  return {
    selectAll: {
      disabled: counters.availableEligible === 0,
      reason:
        counters.availableEligible === 0
          ? "Không có VĐV hợp lệ trong phạm vi hiện tại."
          : "",
    },
    clearAll: {
      disabled: counters.selectedCount === 0,
      reason: counters.selectedCount === 0 ? "Chưa chọn VĐV nào." : "",
    },
    generateTeams: {
      disabled: isReplay || !teamConfig.canGenerateTeams || !preflight?.ok,
      reason:
        teamConfig.blockers?.[0] ||
        preflight?.blockers?.[0] ||
        (!teamConfig.canGenerateTeams ? "Chưa đủ điều kiện ghép đội." : ""),
    },
    regenerateTeams: {
      disabled: isReplay || !hasTeamPreview,
      reason: !hasTeamPreview ? "Chưa có preview đội để ghép lại." : "",
    },
    startTeamReveal: {
      disabled: isReplay || !hasTeamPreview,
      reason: !hasTeamPreview ? "Cần AI ghép đội trước khi công bố." : "",
    },
    generateGroups: {
      disabled: isReplay || !hasTeamPreview,
      reason: !hasTeamPreview ? "Cần có đội trước khi chia bảng." : "",
    },
    startGroupReveal: {
      disabled: isReplay || !hasGroupPreview,
      reason: !hasGroupPreview ? "Cần tạo preview bảng trước khi công bố." : "",
    },
    confirmSave: {
      disabled: isReplay || saving || !hasTeamPreview || !hasGroupPreview || !preflight?.ok,
      reason: saving
        ? "Đang lưu..."
        : !hasTeamPreview || !hasGroupPreview
          ? "Cần có đội và bảng hợp lệ trước khi lưu."
          : preflight?.blockers?.[0] || "",
    },
    generateMatchups: {
      disabled: isReplay || !hasGroupPreview,
      reason: !hasGroupPreview ? "Cần có bảng trước khi tạo cặp đấu." : "",
    },
    confirmMatchups: {
      disabled: isReplay || saving || !matchupPreview?.matchups?.length,
      reason: !matchupPreview?.matchups?.length
        ? "Chưa có preview cặp đấu."
        : "",
    },
  };
}
