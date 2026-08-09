/**
 * Canonical Team Tournament Format & Venue + Group policy configuration.
 * Settings live in team_tournaments.settings JSONB — read defaults are safe;
 * durable writes go through tournament.update_setup_config (Owner GO / migration).
 */

import {
  DEFAULT_MLP_ROSTER_RULES,
  DEFAULT_TEAM_TOURNAMENT_SETTINGS,
  FORMAT_PRESET,
  GROUP_MODE,
  KNOCKOUT_FORMAT,
} from "../constants.js";

export const FORMAT_VENUE_SETTINGS_KEYS = Object.freeze([
  "formatPreset",
  "rosterRules",
  "dreambreakerEnabled",
  "groupMode",
  "groupCount",
  "qualificationCount",
  "knockoutFormat",
  "selectedCourtIds",
  "teamsPerGroup",
]);

export const NO_COURTS_PUBLISH_CODE = "NO_SELECTED_COURTS";
export const NO_COURTS_PUBLISH_MESSAGE =
  "Chưa chọn sân. Vui lòng chọn ít nhất 1 sân ở bước Format & Venue trước khi công bố lịch.";

export const AI_PAIRING_MLP_ONLY_CODE = "AI_PAIRING_MLP4_ONLY";
export const AI_PAIRING_MLP_ONLY_MESSAGE =
  "Ghép đội AI hiện chỉ hỗ trợ preset MLP 4 người. Chọn MLP 4 hoặc ghép đội thủ công cho định dạng tùy chỉnh.";

export const SETUP_CONFIG_GATE_OFF_MESSAGE =
  "Không thể lưu Format & Venue vì Setup mutation v7 đang tắt (VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7). Không ghi đám mây một phần.";

/**
 * @param {object} [raw]
 * @returns {{ minPlayers: number, maxPlayers: number, requiredMales: number, requiredFemales: number, teamSize: number }}
 */
export function normalizeRosterRules(raw = null) {
  const base = raw && typeof raw === "object" ? raw : {};
  const minPlayers = Math.max(1, Number(base.minPlayers) || 0);
  const maxPlayers = Math.max(minPlayers, Number(base.maxPlayers) || minPlayers);
  const requiredMales = Math.max(0, Number(base.requiredMales) || 0);
  const requiredFemales = Math.max(0, Number(base.requiredFemales) || 0);
  const explicitTeamSize = Number(base.teamSize);
  const teamSize =
    Number.isFinite(explicitTeamSize) && explicitTeamSize > 0
      ? explicitTeamSize
      : Math.max(minPlayers, requiredMales + requiredFemales || minPlayers, 1);

  return {
    teamSize,
    minPlayers: minPlayers || teamSize,
    maxPlayers: Math.max(maxPlayers || teamSize, minPlayers || teamSize),
    requiredMales,
    requiredFemales,
  };
}

/**
 * @param {object} rules
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function validateRosterRules(rules) {
  const normalized = normalizeRosterRules(rules);
  if (normalized.minPlayers > normalized.maxPlayers) {
    return {
      ok: false,
      code: "ROSTER_MIN_GT_MAX",
      error: "Số VĐV tối thiểu không được lớn hơn tối đa.",
    };
  }
  if (normalized.teamSize < normalized.minPlayers || normalized.teamSize > normalized.maxPlayers) {
    return {
      ok: false,
      code: "ROSTER_TEAM_SIZE_OUT_OF_RANGE",
      error: "Sĩ số đội phải nằm trong khoảng min/max VĐV.",
    };
  }
  if (normalized.requiredMales + normalized.requiredFemales > normalized.maxPlayers) {
    return {
      ok: false,
      code: "ROSTER_GENDER_EXCEEDS_MAX",
      error: "Tổng nam + nữ bắt buộc không được vượt quá số VĐV tối đa.",
    };
  }
  if (normalized.requiredMales + normalized.requiredFemales > normalized.teamSize) {
    return {
      ok: false,
      code: "ROSTER_GENDER_EXCEEDS_TEAM_SIZE",
      error: "Tổng nam + nữ bắt buộc không được vượt quá sĩ số đội.",
    };
  }
  return { ok: true, rosterRules: normalized };
}

/**
 * MLP 4 preset values — explicit, visible, never silent after custom selection.
 */
export function applyMlp4Preset(overrides = {}) {
  return {
    formatPreset: FORMAT_PRESET.MLP_4,
    rosterRules: normalizeRosterRules({
      ...DEFAULT_MLP_ROSTER_RULES,
      teamSize: 4,
    }),
    dreambreakerEnabled: true,
    ...overrides,
  };
}

/**
 * Infer legacy-compatible defaults without mutating Production data.
 * @param {object} teamData
 * @param {object} [tournament]
 */
export function resolveFormatVenueDefaults(teamData = {}, tournament = null) {
  const rawSettings = {
    ...(tournament?.settings && typeof tournament.settings === "object"
      ? tournament.settings
      : {}),
    ...(teamData?.settings && typeof teamData.settings === "object"
      ? teamData.settings
      : {}),
  };
  const settings = {
    ...DEFAULT_TEAM_TOURNAMENT_SETTINGS,
    ...rawSettings,
  };

  const hasGroups = Array.isArray(teamData?.groups) && teamData.groups.length > 0;
  // Missing formatPreset on legacy rows → mlp_4. Explicit custom stays custom.
  const rawPreset = rawSettings.formatPreset;
  const formatPreset =
    rawPreset === FORMAT_PRESET.CUSTOM || rawPreset === FORMAT_PRESET.MLP_4
      ? rawPreset
      : FORMAT_PRESET.MLP_4;

  const rosterRules =
    rawSettings.rosterRules && typeof rawSettings.rosterRules === "object"
      ? normalizeRosterRules(rawSettings.rosterRules)
      : normalizeRosterRules({
          ...DEFAULT_MLP_ROSTER_RULES,
          teamSize: 4,
        });

  const hasExplicitGroupMode = Object.prototype.hasOwnProperty.call(
    rawSettings,
    "groupMode"
  );

  const groupMode =
    settings.groupMode === GROUP_MODE.AUTOMATIC ||
    settings.groupMode === GROUP_MODE.MANUAL ||
    settings.groupMode === GROUP_MODE.SINGLE_POOL ||
    settings.groupMode === GROUP_MODE.NONE
      ? settings.groupMode
      : hasGroups
        ? GROUP_MODE.MANUAL
        : GROUP_MODE.SINGLE_POOL;

  const configuredCount = Number(settings.groupCount);
  const groupCount =
    Number.isFinite(configuredCount) && configuredCount >= 1
      ? Math.floor(configuredCount)
      : hasGroups
        ? teamData.groups.length
        : 1;

  const qualificationCount = Math.max(
    1,
    Number(settings.qualificationCount) || Number(settings.qualifiersPerGroup) || 2
  );

  const knockoutFormat =
    settings.knockoutFormat === KNOCKOUT_FORMAT.FINAL_ONLY ||
    settings.knockoutFormat === KNOCKOUT_FORMAT.SEMIFINALS ||
    settings.knockoutFormat === KNOCKOUT_FORMAT.TOP_N
      ? settings.knockoutFormat
      : KNOCKOUT_FORMAT.TOP_N;

  const selectedCourtIds = Array.isArray(settings.selectedCourtIds)
    ? [...new Set(settings.selectedCourtIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];

  const teamsPerGroup =
    settings.teamsPerGroup != null && Number(settings.teamsPerGroup) > 0
      ? Number(settings.teamsPerGroup)
      : null;

  return {
    formatPreset,
    rosterRules,
    dreambreakerEnabled:
      settings.dreambreakerEnabled === true ||
      (rawSettings.dreambreakerEnabled == null && formatPreset === FORMAT_PRESET.MLP_4),
    groupMode: hasExplicitGroupMode ? groupMode : hasGroups ? GROUP_MODE.MANUAL : GROUP_MODE.SINGLE_POOL,
    groupCount,
    qualificationCount,
    knockoutFormat,
    selectedCourtIds,
    teamsPerGroup,
  };
}

/**
 * Merge format/venue config into settings (pure — no I/O).
 */
export function mergeFormatVenueIntoSettings(settings = {}, config = {}) {
  const resolved = {
    ...resolveFormatVenueDefaults({ settings }),
    ...config,
  };
  if (config.rosterRules) {
    resolved.rosterRules = normalizeRosterRules(config.rosterRules);
  }
  if (Array.isArray(config.selectedCourtIds)) {
    resolved.selectedCourtIds = [
      ...new Set(config.selectedCourtIds.map((id) => String(id).trim()).filter(Boolean)),
    ];
  }

  const next = { ...settings };
  for (const key of FORMAT_VENUE_SETTINGS_KEYS) {
    if (resolved[key] !== undefined) {
      next[key] = resolved[key];
    }
  }
  return next;
}

/**
 * Derive balanced group sizes for N teams into groupCount buckets (1..N).
 * @param {number} teamCount
 * @param {number} groupCount
 * @returns {number[]}
 */
export function deriveGroupSizes(teamCount, groupCount) {
  const teams = Math.max(0, Number(teamCount) || 0);
  const groups = Math.max(1, Math.min(Number(groupCount) || 1, Math.max(1, teams)));
  if (teams === 0) {
    return Array.from({ length: groups }, () => 0);
  }
  const base = Math.floor(teams / groups);
  const remainder = teams % groups;
  return Array.from({ length: groups }, (_, index) =>
    index < remainder ? base + 1 : base
  );
}

/**
 * Round-robin matchup count for a single pool of N teams: N*(N-1)/2.
 */
export function countRoundRobinMatchups(teamCount) {
  const n = Math.max(0, Number(teamCount) || 0);
  return (n * (n - 1)) / 2;
}

/**
 * @param {string[]} selectedCourtIds
 * @param {Array<{id: string, name?: string, number?: number, active?: boolean}>} venueCourts
 */
export function resolveSelectedCourts(selectedCourtIds = [], venueCourts = []) {
  const byId = new Map(
    (venueCourts || []).map((court) => [String(court.id), court])
  );
  return (selectedCourtIds || [])
    .map((id) => byId.get(String(id)))
    .filter(Boolean);
}

/**
 * Build court label authority from selected court IDs (display may derive names).
 */
export function buildCourtSlotsFromSelectedIds(selectedCourtIds = [], venueCourts = []) {
  const courts = resolveSelectedCourts(selectedCourtIds, venueCourts);
  return courts.map((court, index) => ({
    courtId: String(court.id),
    courtLabel:
      court.name ||
      (court.number != null ? `Sân ${court.number}` : `Sân ${index + 1}`),
    index,
  }));
}

/**
 * Block schedule publish when no courts selected.
 */
export function assertCourtsReadyForPublish(settingsOrTeamData = {}) {
  const settings = settingsOrTeamData?.settings || settingsOrTeamData || {};
  const selected = Array.isArray(settings.selectedCourtIds)
    ? settings.selectedCourtIds.filter(Boolean)
    : [];
  if (selected.length === 0) {
    return {
      ok: false,
      code: NO_COURTS_PUBLISH_CODE,
      error: NO_COURTS_PUBLISH_MESSAGE,
    };
  }
  return { ok: true, selectedCourtIds: selected.map(String) };
}

/**
 * AI pairing capability gate — explicit, not silent MLP force.
 */
export function assertAiPairingSupported(settingsOrTeamData = {}) {
  const config = resolveFormatVenueDefaults(
    settingsOrTeamData?.settings ? settingsOrTeamData : { settings: settingsOrTeamData }
  );
  if (config.formatPreset !== FORMAT_PRESET.MLP_4) {
    return {
      ok: false,
      code: AI_PAIRING_MLP_ONLY_CODE,
      error: AI_PAIRING_MLP_ONLY_MESSAGE,
    };
  }
  return { ok: true };
}

/**
 * Whether format/venue setup is considered complete for workflow gating.
 */
export function isFormatVenueSetupComplete(teamData = {}, tournament = null) {
  const config = resolveFormatVenueDefaults(teamData, tournament);
  const roster = validateRosterRules(config.rosterRules);
  if (!roster.ok) {
    return false;
  }
  if (!config.formatPreset) {
    return false;
  }
  if (!Number.isFinite(config.groupCount) || config.groupCount < 1) {
    return false;
  }
  return true;
}

/**
 * Validate Format & Venue config before tournament.update_setup_config RPC.
 * Does not force groupCount=2 or silently restore mlp_4 after explicit custom.
 * @param {object} config
 * @returns {{ ok: true, payload: object } | { ok: false, code: string, error: string }}
 */
export function validateFormatVenueConfigForPersist(config = {}) {
  const explicitPreset = config?.formatPreset;
  if (
    explicitPreset != null &&
    explicitPreset !== FORMAT_PRESET.MLP_4 &&
    explicitPreset !== FORMAT_PRESET.CUSTOM
  ) {
    return {
      ok: false,
      code: "INVALID_FORMAT_PRESET",
      error: "formatPreset phải là mlp_4 hoặc custom.",
    };
  }

  const payload = buildSetupConfigPayload(config);
  if (explicitPreset === FORMAT_PRESET.CUSTOM) {
    payload.formatPreset = FORMAT_PRESET.CUSTOM;
  } else if (explicitPreset === FORMAT_PRESET.MLP_4) {
    payload.formatPreset = FORMAT_PRESET.MLP_4;
  }

  if (!payload.formatPreset) {
    return {
      ok: false,
      code: "MISSING_FORMAT_PRESET",
      error: "Thiếu formatPreset — không thể lưu Format & Venue.",
    };
  }

  const roster = validateRosterRules(payload.rosterRules);
  if (!roster.ok) {
    return roster;
  }
  payload.rosterRules = roster.rosterRules;

  const groupCount = Number(payload.groupCount);
  if (!Number.isFinite(groupCount) || groupCount < 1) {
    return {
      ok: false,
      code: "INVALID_GROUP_COUNT",
      error: "groupCount phải >= 1 khi áp dụng chia bảng.",
    };
  }
  payload.groupCount = Math.floor(groupCount);

  const qualificationCount = Number(payload.qualificationCount);
  if (!Number.isFinite(qualificationCount) || qualificationCount < 1) {
    return {
      ok: false,
      code: "INVALID_QUALIFICATION_COUNT",
      error: "qualificationCount phải >= 1.",
    };
  }
  payload.qualificationCount = Math.floor(qualificationCount);

  payload.selectedCourtIds = Array.isArray(payload.selectedCourtIds)
    ? [...new Set(payload.selectedCourtIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];

  return { ok: true, payload };
}

/**
 * Payload whitelist for tournament.update_setup_config RPC.
 */
export function buildSetupConfigPayload(config = {}) {
  const merged = mergeFormatVenueIntoSettings({}, config);
  const payload = {};
  for (const key of FORMAT_VENUE_SETTINGS_KEYS) {
    if (merged[key] !== undefined) {
      payload[key] = merged[key];
    }
  }
  // Preserve explicit custom selection — never silently restore mlp_4.
  if (config?.formatPreset === FORMAT_PRESET.CUSTOM) {
    payload.formatPreset = FORMAT_PRESET.CUSTOM;
  } else if (config?.formatPreset === FORMAT_PRESET.MLP_4) {
    payload.formatPreset = FORMAT_PRESET.MLP_4;
  }
  if (config?.groupCount != null && Number.isFinite(Number(config.groupCount))) {
    payload.groupCount = Math.floor(Number(config.groupCount));
  }
  return payload;
}

/**
 * Recommend groupCount for automatic mode (organizer remains authoritative).
 */
export function recommendAutomaticGroupCount(teamCount) {
  const n = Number(teamCount) || 0;
  if (n <= 0) return 1;
  if (n <= 5) return 1;
  if (n <= 10) return 2;
  return Math.min(4, Math.floor(n / 3));
}
