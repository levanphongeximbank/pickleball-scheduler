/**
 * Semantic club-blob compare for dirty reconciliation.
 * Field-specific empty/default/missing equivalence. Does not write cloud.
 * Does not last-write-wins. Does not treat raw JSON inequality as a pending mutation.
 */
import { DEFAULT_SKILL_LEVEL_RULES } from "../ai/config.js";
import { normalizeCourts } from "../models/court.js";
import { normalizeCustomers } from "../models/customer.js";

const VOLATILE_KEYS = new Set([
  "updatedAt",
  "syncedAt",
  "exportedAt",
  "_cloudMirrorAt",
]);

const RECORD_VOLATILE_KEYS = new Set(["createdAt", ...VOLATILE_KEYS]);

export const SEMANTIC_PATHS = [
  "schemaVersion",
  "clubId",
  "players",
  "courts",
  "bookings",
  "customers",
  "recurringSeries",
  "courtManagement",
  "seasons",
  "leagues",
  "rounds",
  "sessions",
  "tournaments",
  "founderPairingConstraints",
  "seasonStandings",
  "skillLevel",
  "skillLevelProposals",
  "skillLevelChangeRequests",
  "ai",
  "active",
  "director",
];

export const CLUB_BLOB_FIELD_AUTHORITY = Object.freeze({
  courts: {
    businessDomain: "venue-court",
    canonicalAuthority: "club_data_v3.courts",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted",
    shouldBlockCourtLockIfDifferent: "only-if-local-extra-or-renamed",
  },
  courtManagement: {
    businessDomain: "venue-hours",
    canonicalAuthority: "club_data_v3.courtManagement",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted",
    shouldBlockCourtLockIfDifferent: "only-if-non-default-values-differ",
  },
  seasons: {
    businessDomain: "club-season",
    canonicalAuthority: "club_data_v3.seasons",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted-or-read-injected-default",
    shouldBlockCourtLockIfDifferent: "only-if-non-default-records-differ",
  },
  leagues: {
    businessDomain: "club-league",
    canonicalAuthority: "club_data_v3.leagues",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted-or-read-injected-default",
    shouldBlockCourtLockIfDifferent: "only-if-non-default-records-differ",
  },
  founderPairingConstraints: {
    businessDomain: "pairing-constraints",
    canonicalAuthority: "club_data_v3.founderPairingConstraints",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted",
    shouldBlockCourtLockIfDifferent: "only-if-non-empty-content-differs",
  },
  seasonStandings: {
    businessDomain: "season-standings",
    canonicalAuthority: "club_data_v3.seasonStandings",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted",
    shouldBlockCourtLockIfDifferent: "only-if-non-empty-content-differs",
  },
  skillLevel: {
    businessDomain: "skill-level-rules",
    canonicalAuthority: "club_data_v3.skillLevel",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted-with-local-defaults",
    shouldBlockCourtLockIfDifferent: "only-if-non-default-values-differ",
  },
  skillLevelProposals: {
    businessDomain: "skill-level-proposals",
    canonicalAuthority: "club_data_v3.skillLevelProposals",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted",
    shouldBlockCourtLockIfDifferent: "only-if-non-empty-content-differs",
  },
  skillLevelChangeRequests: {
    businessDomain: "skill-level-change-requests",
    canonicalAuthority: "club_data_v3.skillLevelChangeRequests",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted",
    shouldBlockCourtLockIfDifferent: "only-if-non-empty-content-differs",
  },
  ai: {
    businessDomain: "ai-session-history",
    canonicalAuthority: "club_data_v3.ai",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted-with-local-defaults",
    shouldBlockCourtLockIfDifferent: "only-if-non-default-values-differ",
  },
  active: {
    businessDomain: "club-ui-pointers",
    canonicalAuthority: "club_data_v3.active (optional)",
    cloudClubDataV3: true,
    derivedOrPersisted: "derived-local-pointers",
    shouldBlockCourtLockIfDifferent: "only-if-pointer-to-non-default-ids-differs",
  },
  director: {
    businessDomain: "director-locks",
    canonicalAuthority: "club_data_v3.director",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted-runtime",
    shouldBlockCourtLockIfDifferent: "only-if-non-empty-locks-differ",
  },
  bookings: {
    businessDomain: "court-booking",
    canonicalAuthority: "club_data_v3.bookings",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted",
    shouldBlockCourtLockIfDifferent: true,
  },
  players: {
    businessDomain: "player",
    canonicalAuthority: "club_data_v3.players",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted",
    shouldBlockCourtLockIfDifferent: true,
  },
  customers: {
    businessDomain: "customer",
    canonicalAuthority: "club_data_v3.customers",
    cloudClubDataV3: true,
    derivedOrPersisted: "persisted",
    shouldBlockCourtLockIfDifferent: true,
  },
});

export const ARRAY_ORDER_SEMANTIC_MATRIX = Object.freeze({
  courts: "identity-id-insensitive",
  bookings: "identity-id-insensitive",
  players: "identity-id-insensitive",
  customers: "identity-id-insensitive",
  recurringSeries: "identity-id-insensitive",
  seasons: "identity-id-insensitive",
  leagues: "identity-id-insensitive",
  rounds: "identity-id-insensitive",
  sessions: "identity-id-insensitive",
  tournaments: "identity-id-insensitive",
  founderPairingConstraints: "identity-id-else-order-sensitive",
  skillLevelProposals: "identity-id-insensitive",
  skillLevelChangeRequests: "identity-id-insensitive",
  "ai.policies": "order-sensitive",
  "ai.rules": "order-sensitive",
  "director.lockedCourts": "identity-insensitive",
  "director.lockedPlayers": "identity-insensitive",
});

const CLASS = Object.freeze({
  REAL_UNSYNCED_LOCAL_CHANGE: "REAL_UNSYNCED_LOCAL_CHANGE",
  STALE_LEGACY_LOCAL_VALUE: "STALE_LEGACY_LOCAL_VALUE",
  DEFAULT_VS_MISSING: "DEFAULT_VS_MISSING",
  NULL_VS_MISSING: "NULL_VS_MISSING",
  EMPTY_ARRAY_VS_MISSING: "EMPTY_ARRAY_VS_MISSING",
  EMPTY_OBJECT_VS_MISSING: "EMPTY_OBJECT_VS_MISSING",
  ORDERING_ONLY: "ORDERING_ONLY",
  DERIVED_LOCAL_ONLY: "DERIVED_LOCAL_ONLY",
  CANONICAL_CLOUD_ONLY: "CANONICAL_CLOUD_ONLY",
  NORMALIZATION_MISMATCH: "NORMALIZATION_MISMATCH",
  TRUE_DATA_CONFLICT: "TRUE_DATA_CONFLICT",
  EQUAL: "EQUAL",
});

function defaultAi() {
  return {
    history: {},
    waiting: {},
    policies: [],
    rules: [],
    tournament: {
      bracketWinners: {},
      bracketUnlockedRounds: {},
      seedPreview: [],
      updatedAt: null,
    },
  };
}

function defaultDirector() {
  return {
    lockedCourts: [],
    lockedPlayers: [],
  };
}

function semanticCourtManagement(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const peak = raw.peakHourRules && typeof raw.peakHourRules === "object" ? raw.peakHourRules : {};
  const notification =
    raw.notificationSettings && typeof raw.notificationSettings === "object"
      ? raw.notificationSettings
      : {};
  const automation =
    raw.automationSettings && typeof raw.automationSettings === "object"
      ? raw.automationSettings
      : {};
  const weekdays = Array.isArray(peak.weekdays)
    ? peak.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  return {
    openHour: Number.isFinite(Number(raw.openHour)) ? Number(raw.openHour) : 0,
    closeHour: Number.isFinite(Number(raw.closeHour)) ? Number(raw.closeHour) : 24,
    slotMinutes: Number.isFinite(Number(raw.slotMinutes)) ? Number(raw.slotMinutes) : 60,
    peakHourRules: {
      enabled: Boolean(peak.enabled),
      startHour: Number.isFinite(Number(peak.startHour)) ? Number(peak.startHour) : 17,
      endHour: Number.isFinite(Number(peak.endHour)) ? Number(peak.endHour) : 22,
      weekdays: weekdays.length > 0 ? weekdays : [0, 1, 2, 3, 4, 5, 6],
    },
    notificationSettings: {
      enabled: Boolean(notification.enabled),
      minutesBefore: Number.isFinite(Number(notification.minutesBefore))
        ? Number(notification.minutesBefore)
        : 30,
      browserNotify: notification.browserNotify !== false,
      inAppNotify: notification.inAppNotify !== false,
    },
    automationSettings: {
      autoCompleteOnOpen: Boolean(automation.autoCompleteOnOpen),
      autoStartPlaying: Boolean(automation.autoStartPlaying),
    },
  };
}

function defaultActive() {
  return { seasonId: null, leagueId: null, roundSlot: null };
}

function isEmptyArrayEquiv(value) {
  return value == null || (Array.isArray(value) && value.length === 0);
}

function isEmptyObjectEquiv(value) {
  if (value == null) {
    return true;
  }
  return typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

function stripVolatile(value, volatileKeys = VOLATILE_KEYS) {
  if (Array.isArray(value)) {
    return value.map((item) => stripVolatile(item, volatileKeys));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const next = {};
  Object.keys(value)
    .sort()
    .forEach((key) => {
      if (volatileKeys.has(key)) {
        return;
      }
      next[key] = stripVolatile(value[key], volatileKeys);
    });
  return next;
}

function stableStringify(value) {
  return JSON.stringify(stripVolatile(value, RECORD_VOLATILE_KEYS));
}

function identityKey(item, index) {
  if (item && typeof item === "object" && item.id != null && String(item.id) !== "") {
    return `id:${String(item.id)}`;
  }
  return `idx:${index}:${stableStringify(item)}`;
}

function compareIdentityCollection(leftRaw, rightRaw, { orderSensitiveIfNoId = false } = {}) {
  const left = Array.isArray(leftRaw) ? leftRaw : [];
  const right = Array.isArray(rightRaw) ? rightRaw : [];
  const leftHasIds = left.length > 0 && left.every((item) => item && item.id != null && String(item.id) !== "");
  const rightHasIds = right.length > 0 && right.every((item) => item && item.id != null && String(item.id) !== "");
  if (orderSensitiveIfNoId && (!leftHasIds || !rightHasIds)) {
    const equal = stableStringify(left) === stableStringify(right);
    const orderOnly =
      !equal &&
      stableStringify([...left].sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)))) ===
        stableStringify([...right].sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))));
    return { equal, orderOnly: orderOnly === true, leftCount: left.length, rightCount: right.length };
  }
  const leftMap = new Map(left.map((item, index) => [identityKey(item, index), stripVolatile(item, RECORD_VOLATILE_KEYS)]));
  const rightMap = new Map(right.map((item, index) => [identityKey(item, index), stripVolatile(item, RECORD_VOLATILE_KEYS)]));
  if (leftMap.size !== rightMap.size) {
    return { equal: false, orderOnly: false, leftCount: left.length, rightCount: right.length };
  }
  for (const [key, value] of leftMap) {
    if (!rightMap.has(key) || stableStringify(value) !== stableStringify(rightMap.get(key))) {
      const sameIds = [...leftMap.keys()].every((k) => rightMap.has(k));
      return { equal: false, orderOnly: false, sameIds, leftCount: left.length, rightCount: right.length };
    }
  }
  const leftOrder = left.map((item, index) => identityKey(item, index)).join("|");
  const rightOrder = right.map((item, index) => identityKey(item, index)).join("|");
  return {
    equal: true,
    orderOnly: leftOrder !== rightOrder,
    leftCount: left.length,
    rightCount: right.length,
  };
}

function looksLikeDefaultSeason(season) {
  if (!season || typeof season !== "object") {
    return false;
  }
  return String(season.name || "").trim() === "Mua hien tai" && String(season.status || "") === "active";
}

function looksLikeDefaultLeague(league) {
  if (!league || typeof league !== "object") {
    return false;
  }
  return String(league.name || "").trim() === "Giao luu" && String(league.format || "social") === "social";
}

function isDefaultInjectedSeasonSet(localSeasons, remoteSeasons) {
  if (!isEmptyArrayEquiv(remoteSeasons)) {
    return false;
  }
  const local = Array.isArray(localSeasons) ? localSeasons : [];
  return local.length > 0 && local.every(looksLikeDefaultSeason);
}

function isDefaultInjectedLeagueSet(localLeagues, remoteLeagues) {
  if (!isEmptyArrayEquiv(remoteLeagues)) {
    return false;
  }
  const local = Array.isArray(localLeagues) ? localLeagues : [];
  return local.length > 0 && local.every(looksLikeDefaultLeague);
}

function semanticSkillLevel(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_SKILL_LEVEL_RULES };
  }
  return { ...DEFAULT_SKILL_LEVEL_RULES, ...value };
}

function semanticAi(value) {
  const defaults = defaultAi();
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  return {
    ...defaults,
    ...value,
    tournament: {
      ...defaults.tournament,
      ...(value.tournament && typeof value.tournament === "object" ? value.tournament : {}),
    },
  };
}

function semanticDirector(value) {
  const defaults = defaultDirector();
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  return {
    lockedCourts: Array.isArray(value.lockedCourts) ? value.lockedCourts : defaults.lockedCourts,
    lockedPlayers: Array.isArray(value.lockedPlayers) ? value.lockedPlayers : defaults.lockedPlayers,
  };
}

function semanticBookingCore(booking) {
  if (!booking || typeof booking !== "object") {
    return booking;
  }
  return {
    id: String(booking.id || ""),
    courtId: String(booking.courtId || ""),
    date: String(booking.date || "").slice(0, 10),
    startTime: String(booking.startTime || "").slice(0, 5),
    endTime: String(booking.endTime || "").slice(0, 5),
    bookingType: String(booking.bookingType || ""),
    tournamentId: booking.tournamentId != null ? String(booking.tournamentId) : "",
    bookingStatus: String(booking.bookingStatus || ""),
  };
}

function semanticPlayerCore(player) {
  if (!player || typeof player !== "object") {
    return player;
  }
  const rating = player.skillLevel ?? player.level ?? player.rating ?? player.current_rating;
  const ratingNum = Number(rating);
  const ratingKey = !Number.isFinite(ratingNum) || ratingNum === 3.5 ? null : ratingNum;
  return {
    id: String(player.id ?? ""),
    name: String(player.name || "").trim(),
    gender: player.gender || player.genderKey || null,
    playerType:
      !player.playerType || player.playerType === "member" ? null : player.playerType,
    phone: String(player.phone || "").trim(),
    authUserId: player.authUserId || null,
    active: player.active !== false,
    rating: ratingKey,
  };
}

function semanticActive(value) {
  const defaults = defaultActive();
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  return {
    seasonId: value.seasonId ?? null,
    leagueId: value.leagueId ?? null,
    roundSlot: value.roundSlot ?? null,
  };
}

function classifyEmptyVsMissing(localValue, remoteValue, emptyKind) {
  const localMissing = localValue === undefined;
  const remoteMissing = remoteValue === undefined;
  const localNull = localValue === null;
  const remoteNull = remoteValue === null;
  if ((localMissing && remoteNull) || (remoteMissing && localNull)) {
    return CLASS.NULL_VS_MISSING;
  }
  if (emptyKind === "array") {
    return CLASS.EMPTY_ARRAY_VS_MISSING;
  }
  if (emptyKind === "object") {
    return CLASS.EMPTY_OBJECT_VS_MISSING;
  }
  return CLASS.DEFAULT_VS_MISSING;
}

export function summarizeClubBlobField(blob, path) {
  const value = blob && typeof blob === "object" ? blob[path] : undefined;
  if (value === undefined) {
    return { present: false, type: "undefined", summary: "missing" };
  }
  if (value === null) {
    return { present: true, type: "null", summary: "null" };
  }
  if (Array.isArray(value)) {
    const ids = value
      .map((item) => (item && item.id != null ? String(item.id) : null))
      .filter(Boolean)
      .slice(0, 24);
    return { present: true, type: "array", count: value.length, ids };
  }
  if (typeof value === "object") {
    return { present: true, type: "object", keys: Object.keys(value).sort() };
  }
  return { present: true, type: typeof value, summary: String(value) };
}

function inspectPath(path, localBlob, remoteBlob) {
  const localValue = localBlob[path];
  const remoteValue = remoteBlob[path];
  const localPresent = localValue !== undefined;
  const remotePresent = remoteValue !== undefined;
  const rawEqual = JSON.stringify(localValue) === JSON.stringify(remoteValue);

  const base = {
    path,
    localPresent,
    remotePresent,
    rawEqual,
  };

  if (path === "courts") {
    const left = normalizeCourts(Array.isArray(localValue) ? localValue : []);
    const right = normalizeCourts(Array.isArray(remoteValue) ? remoteValue : []);
    const compared = compareIdentityCollection(left, right);
    if (compared.equal) {
      const classification = rawEqual
        ? CLASS.EQUAL
        : compared.orderOnly
          ? CLASS.ORDERING_ONLY
          : CLASS.NORMALIZATION_MISMATCH;
      return {
        ...base,
        classification,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.courts",
      };
    }
    const localIds = new Set(left.map((court) => String(court.id)));
    const remoteIds = new Set(right.map((court) => String(court.id)));
    const localExtra = [...localIds].some((id) => !remoteIds.has(id));
    const classification = localExtra ? CLASS.REAL_UNSYNCED_LOCAL_CHANGE : CLASS.CANONICAL_CLOUD_ONLY;
    return {
      ...base,
      classification,
      normalizedEqual: false,
      shouldBlockCourtLock: localExtra,
      canonicalAuthority: "club_data_v3.courts",
    };
  }

  if (path === "courtManagement") {
    const left = semanticCourtManagement(localValue);
    const right = semanticCourtManagement(remoteValue);
    const normalizedEqual = stableStringify(left) === stableStringify(right);
    if (normalizedEqual) {
      const classification = !localPresent || !remotePresent || isEmptyObjectEquiv(localValue) || isEmptyObjectEquiv(remoteValue)
        ? CLASS.DEFAULT_VS_MISSING
        : rawEqual
          ? CLASS.EQUAL
          : CLASS.NORMALIZATION_MISMATCH;
      return {
        ...base,
        classification: rawEqual ? CLASS.EQUAL : classification,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.courtManagement",
      };
    }
    return {
      ...base,
      classification: CLASS.TRUE_DATA_CONFLICT,
      normalizedEqual: false,
      shouldBlockCourtLock: true,
      canonicalAuthority: "club_data_v3.courtManagement",
    };
  }

  if (path === "seasons") {
    if (isEmptyArrayEquiv(localValue) && isEmptyArrayEquiv(remoteValue)) {
      return {
        ...base,
        classification: rawEqual ? CLASS.EQUAL : CLASS.EMPTY_ARRAY_VS_MISSING,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.seasons",
      };
    }
    if (isDefaultInjectedSeasonSet(localValue, remoteValue)) {
      return {
        ...base,
        classification: CLASS.DEFAULT_VS_MISSING,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.seasons",
      };
    }
    const compared = compareIdentityCollection(localValue, remoteValue);
    if (compared.equal) {
      return {
        ...base,
        classification: compared.orderOnly ? CLASS.ORDERING_ONLY : rawEqual ? CLASS.EQUAL : CLASS.NORMALIZATION_MISMATCH,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.seasons",
      };
    }
    const localOnly = Array.isArray(localValue) && isEmptyArrayEquiv(remoteValue);
    return {
      ...base,
      classification: localOnly ? CLASS.REAL_UNSYNCED_LOCAL_CHANGE : CLASS.TRUE_DATA_CONFLICT,
      normalizedEqual: false,
      shouldBlockCourtLock: true,
      canonicalAuthority: "club_data_v3.seasons",
    };
  }

  if (path === "leagues") {
    if (isEmptyArrayEquiv(localValue) && isEmptyArrayEquiv(remoteValue)) {
      return {
        ...base,
        classification: rawEqual ? CLASS.EQUAL : CLASS.EMPTY_ARRAY_VS_MISSING,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.leagues",
      };
    }
    if (isDefaultInjectedLeagueSet(localValue, remoteValue)) {
      return {
        ...base,
        classification: CLASS.DEFAULT_VS_MISSING,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.leagues",
      };
    }
    const compared = compareIdentityCollection(localValue, remoteValue);
    if (compared.equal) {
      return {
        ...base,
        classification: compared.orderOnly ? CLASS.ORDERING_ONLY : rawEqual ? CLASS.EQUAL : CLASS.NORMALIZATION_MISMATCH,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.leagues",
      };
    }
    const localOnly = Array.isArray(localValue) && isEmptyArrayEquiv(remoteValue);
    return {
      ...base,
      classification: localOnly ? CLASS.REAL_UNSYNCED_LOCAL_CHANGE : CLASS.TRUE_DATA_CONFLICT,
      normalizedEqual: false,
      shouldBlockCourtLock: true,
      canonicalAuthority: "club_data_v3.leagues",
    };
  }

  if (
    path === "players" ||
    path === "bookings" ||
    path === "customers" ||
    path === "recurringSeries" ||
    path === "rounds" ||
    path === "sessions" ||
    path === "tournaments" ||
    path === "skillLevelProposals" ||
    path === "skillLevelChangeRequests"
  ) {
    const normalizers = {
      players: (rows) => (Array.isArray(rows) ? rows : []).map(semanticPlayerCore),
      customers: normalizeCustomers,
      bookings: (rows) => (Array.isArray(rows) ? rows : []).map(semanticBookingCore),
    };
    const normalize = normalizers[path];
    const leftRaw = Array.isArray(localValue) ? localValue : [];
    const rightRaw = Array.isArray(remoteValue) ? remoteValue : [];
    const left = normalize ? normalize(leftRaw) : leftRaw;
    const right = normalize ? normalize(rightRaw) : rightRaw;
    if (isEmptyArrayEquiv(left) && isEmptyArrayEquiv(right)) {
      return {
        ...base,
        classification: rawEqual ? CLASS.EQUAL : CLASS.EMPTY_ARRAY_VS_MISSING,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: `club_data_v3.${path}`,
      };
    }
    const compared = compareIdentityCollection(left, right);
    if (compared.equal) {
      return {
        ...base,
        classification: compared.orderOnly ? CLASS.ORDERING_ONLY : rawEqual ? CLASS.EQUAL : CLASS.NORMALIZATION_MISMATCH,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: `club_data_v3.${path}`,
      };
    }
    return {
      ...base,
      classification: CLASS.REAL_UNSYNCED_LOCAL_CHANGE,
      normalizedEqual: false,
      shouldBlockCourtLock: true,
      canonicalAuthority: `club_data_v3.${path}`,
    };
  }

  if (path === "founderPairingConstraints") {
    if (isEmptyArrayEquiv(localValue) && isEmptyArrayEquiv(remoteValue)) {
      return {
        ...base,
        classification: rawEqual ? CLASS.EQUAL : CLASS.EMPTY_ARRAY_VS_MISSING,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.founderPairingConstraints",
      };
    }
    const compared = compareIdentityCollection(localValue, remoteValue, { orderSensitiveIfNoId: true });
    if (compared.equal) {
      return {
        ...base,
        classification: compared.orderOnly ? CLASS.ORDERING_ONLY : rawEqual ? CLASS.EQUAL : CLASS.NORMALIZATION_MISMATCH,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.founderPairingConstraints",
      };
    }
    if (compared.orderOnly) {
      return {
        ...base,
        classification: CLASS.TRUE_DATA_CONFLICT,
        normalizedEqual: false,
        shouldBlockCourtLock: true,
        canonicalAuthority: "club_data_v3.founderPairingConstraints",
      };
    }
    return {
      ...base,
      classification: CLASS.REAL_UNSYNCED_LOCAL_CHANGE,
      normalizedEqual: false,
      shouldBlockCourtLock: true,
      canonicalAuthority: "club_data_v3.founderPairingConstraints",
    };
  }

  if (path === "seasonStandings") {
    const left = localValue && typeof localValue === "object" && !Array.isArray(localValue) ? localValue : {};
    const right = remoteValue && typeof remoteValue === "object" && !Array.isArray(remoteValue) ? remoteValue : {};
    if (isEmptyObjectEquiv(left) && isEmptyObjectEquiv(right)) {
      return {
        ...base,
        classification: rawEqual ? CLASS.EQUAL : CLASS.EMPTY_OBJECT_VS_MISSING,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.seasonStandings",
      };
    }
    const normalizedEqual = stableStringify(left) === stableStringify(right);
    return {
      ...base,
      classification: normalizedEqual ? CLASS.NORMALIZATION_MISMATCH : CLASS.TRUE_DATA_CONFLICT,
      normalizedEqual,
      shouldBlockCourtLock: !normalizedEqual,
      canonicalAuthority: "club_data_v3.seasonStandings",
    };
  }

  if (path === "skillLevel") {
    const left = semanticSkillLevel(localValue);
    const right = semanticSkillLevel(remoteValue);
    const normalizedEqual = stableStringify(left) === stableStringify(right);
    if (normalizedEqual) {
      return {
        ...base,
        classification: rawEqual ? CLASS.EQUAL : CLASS.DEFAULT_VS_MISSING,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.skillLevel",
      };
    }
    return {
      ...base,
      classification: CLASS.TRUE_DATA_CONFLICT,
      normalizedEqual: false,
      shouldBlockCourtLock: true,
      canonicalAuthority: "club_data_v3.skillLevel",
    };
  }

  if (path === "ai") {
    const left = semanticAi(localValue);
    const right = semanticAi(remoteValue);
    const normalizedEqual = stableStringify(left) === stableStringify(right);
    if (normalizedEqual) {
      return {
        ...base,
        classification: rawEqual ? CLASS.EQUAL : CLASS.DEFAULT_VS_MISSING,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.ai",
      };
    }
    return {
      ...base,
      classification: CLASS.TRUE_DATA_CONFLICT,
      normalizedEqual: false,
      shouldBlockCourtLock: true,
      canonicalAuthority: "club_data_v3.ai",
    };
  }

  if (path === "director") {
    const left = semanticDirector(localValue);
    const right = semanticDirector(remoteValue);
    const normalizedEqual = stableStringify(left) === stableStringify(right);
    if (normalizedEqual) {
      return {
        ...base,
        classification: rawEqual ? CLASS.EQUAL : CLASS.DEFAULT_VS_MISSING,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.director",
      };
    }
    return {
      ...base,
      classification: CLASS.TRUE_DATA_CONFLICT,
      normalizedEqual: false,
      shouldBlockCourtLock: true,
      canonicalAuthority: "club_data_v3.director",
    };
  }

  if (path === "active") {
    const left = semanticActive(localValue);
    const right = semanticActive(remoteValue);
    if (stableStringify(left) === stableStringify(right)) {
      return {
        ...base,
        classification: rawEqual ? CLASS.EQUAL : classifyEmptyVsMissing(localValue, remoteValue, "object"),
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.active",
      };
    }
    const remoteEmpty = semanticActive(remoteValue);
    const remoteIsBlank =
      remoteEmpty.seasonId == null && remoteEmpty.leagueId == null && remoteEmpty.roundSlot == null;
    const localSeasons = localBlob.seasons;
    const remoteSeasons = remoteBlob.seasons;
    const localLeagues = localBlob.leagues;
    const remoteLeagues = remoteBlob.leagues;
    const defaultSeasonSet = isDefaultInjectedSeasonSet(localSeasons, remoteSeasons);
    const defaultLeagueSet = isDefaultInjectedLeagueSet(localLeagues, remoteLeagues) || isEmptyArrayEquiv(remoteLeagues);
    if (remoteIsBlank && defaultSeasonSet && defaultLeagueSet) {
      return {
        ...base,
        classification: CLASS.DERIVED_LOCAL_ONLY,
        normalizedEqual: true,
        shouldBlockCourtLock: false,
        canonicalAuthority: "club_data_v3.active",
      };
    }
    return {
      ...base,
      classification: CLASS.TRUE_DATA_CONFLICT,
      normalizedEqual: false,
      shouldBlockCourtLock: true,
      canonicalAuthority: "club_data_v3.active",
    };
  }

  const normalizedEqual = stableStringify(localValue) === stableStringify(remoteValue);
  return {
    ...base,
    classification: normalizedEqual ? (rawEqual ? CLASS.EQUAL : CLASS.NORMALIZATION_MISMATCH) : CLASS.TRUE_DATA_CONFLICT,
    normalizedEqual,
    shouldBlockCourtLock: !normalizedEqual,
    canonicalAuthority: `club_data_v3.${path}`,
  };
}

export function inspectClubBlobSemanticDiff(localBlob, remoteBlob) {
  const local = localBlob && typeof localBlob === "object" ? localBlob : {};
  const remote = remoteBlob && typeof remoteBlob === "object" ? remoteBlob : {};
  const details = SEMANTIC_PATHS.map((path) => inspectPath(path, local, remote));
  const representationPaths = details
    .filter((row) => row.classification !== CLASS.EQUAL && row.shouldBlockCourtLock !== true)
    .map((row) => row.path);
  const realPendingPaths = details.filter((row) => row.shouldBlockCourtLock === true).map((row) => row.path);
  return {
    details,
    representationPaths,
    realPendingPaths,
    rawUnequalPaths: details.filter((row) => row.rawEqual !== true).map((row) => row.path),
  };
}

export function diffClubBlobSemantic(localBlob, remoteBlob) {
  return inspectClubBlobSemanticDiff(localBlob, remoteBlob).realPendingPaths;
}
