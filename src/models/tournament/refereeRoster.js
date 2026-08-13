export const REFEREE_ROSTER_SOURCE = Object.freeze({
  MANUAL: "manual",
  CANONICAL_ACCOUNT: "canonical_account",
});

export function createRefereeRosterId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `ref-roster-${crypto.randomUUID().slice(0, 8)}`;
  }

  return `ref-roster-${Date.now()}`;
}

export function normalizeRefereeRosterEntry(entry, index = 0) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const name = String(entry.name || "").trim();
  if (!name) {
    return null;
  }

  const canonicalUserId = String(
    entry.canonicalUserId || entry.refereeUserId || ""
  ).trim();
  const source =
    entry.source === REFEREE_ROSTER_SOURCE.CANONICAL_ACCOUNT || canonicalUserId
      ? REFEREE_ROSTER_SOURCE.CANONICAL_ACCOUNT
      : REFEREE_ROSTER_SOURCE.MANUAL;

  const normalized = {
    id: entry.id ? String(entry.id) : createRefereeRosterId(),
    name,
    phone: entry.phone ? String(entry.phone).trim() : "",
    active: entry.active !== false,
    sortOrder: Number.isFinite(Number(entry.sortOrder)) ? Number(entry.sortOrder) : index,
    source,
  };

  // Optional safe display cache — never identity authority.
  if (entry.email) {
    normalized.email = String(entry.email).trim();
  }
  if (canonicalUserId) {
    normalized.canonicalUserId = canonicalUserId;
  }
  if (entry.eligibility) {
    normalized.eligibility = String(entry.eligibility);
  }

  return normalized;
}

export function normalizeRefereeRoster(entries = []) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry, index) => normalizeRefereeRosterEntry(entry, index))
    .filter(Boolean)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "vi"));
}

export function normalizeCourtReferees(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [courtId, rosterId]) => {
    if (courtId && rosterId) {
      accumulator[String(courtId)] = String(rosterId);
    }
    return accumulator;
  }, {});
}

export function getRefereeSettings(tournament) {
  const settings = tournament?.settings || {};
  return {
    roster: normalizeRefereeRoster(settings.refereeRoster),
    courtReferees: normalizeCourtReferees(settings.courtReferees),
  };
}

export function buildRefereeSettingsPatch(tournament, partial = {}) {
  const current = getRefereeSettings(tournament);
  return {
    settings: {
      ...(tournament?.settings || {}),
      refereeRoster: partial.roster ?? current.roster,
      courtReferees: partial.courtReferees ?? current.courtReferees,
    },
  };
}

export function createRefereeRosterEntry(options = {}) {
  return normalizeRefereeRosterEntry({
    id: createRefereeRosterId(),
    name: options.name || "",
    phone: options.phone || "",
    email: options.email || "",
    active: true,
    source: options.source || REFEREE_ROSTER_SOURCE.MANUAL,
    canonicalUserId: options.canonicalUserId || options.refereeUserId || "",
    eligibility: options.eligibility,
  });
}

/**
 * Create a roster entry from a canonical REFEREE account candidate.
 */
export function createCanonicalRefereeRosterEntry(candidate = {}) {
  const userId = String(candidate.userId || candidate.profileId || "").trim();
  const name =
    String(candidate.displayName || candidate.name || "").trim() ||
    String(candidate.email || "").trim();
  if (!userId || !name) {
    return null;
  }

  return createRefereeRosterEntry({
    id: `ref-canon-${userId.slice(0, 8)}`,
    name,
    phone: candidate.phone || "",
    email: candidate.email || "",
    source: REFEREE_ROSTER_SOURCE.CANONICAL_ACCOUNT,
    canonicalUserId: userId,
    eligibility: "eligible",
  });
}

export function findRosterEntryByCanonicalUserId(roster = [], canonicalUserId) {
  const wanted = String(canonicalUserId || "").trim();
  if (!wanted) {
    return null;
  }
  return (
    (roster || []).find(
      (item) => String(item.canonicalUserId || item.refereeUserId || "") === wanted
    ) || null
  );
}

export function upsertRefereeRosterEntry(roster = [], entry) {
  const normalized = normalizeRefereeRosterEntry(entry);
  if (!normalized) {
    return roster;
  }

  // Prevent duplicate canonical account selections.
  if (normalized.canonicalUserId) {
    const existingCanonical = findRosterEntryByCanonicalUserId(
      roster,
      normalized.canonicalUserId
    );
    if (existingCanonical && String(existingCanonical.id) !== String(normalized.id)) {
      return roster;
    }
  }

  const index = roster.findIndex((item) => String(item.id) === String(normalized.id));
  if (index < 0) {
    return [...roster, normalized];
  }

  return roster.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...normalized } : item
  );
}

export function addCanonicalRefereeToRoster(roster = [], candidate) {
  const entry = createCanonicalRefereeRosterEntry(candidate);
  if (!entry) {
    return { ok: false, roster, error: "Thiếu thông tin tài khoản trọng tài." };
  }
  if (findRosterEntryByCanonicalUserId(roster, entry.canonicalUserId)) {
    return { ok: false, roster, error: "Trọng tài này đã có trong danh sách.", code: "DUPLICATE" };
  }
  return { ok: true, roster: upsertRefereeRosterEntry(roster, entry), entry };
}

export function removeRefereeRosterEntry(roster = [], entryId) {
  return roster.filter((item) => String(item.id) !== String(entryId));
}

export function findRefereeRosterEntry(roster = [], entryId) {
  return roster.find((item) => String(item.id) === String(entryId)) || null;
}

export function setCourtRefereeAssignment(courtReferees = {}, courtId, rosterId) {
  const key = String(courtId);
  if (!rosterId) {
    const next = { ...courtReferees };
    delete next[key];
    return next;
  }

  return {
    ...courtReferees,
    [key]: String(rosterId),
  };
}

export function resolveCourtRefereeName(courtReferees = {}, roster = [], courtId) {
  const rosterId = courtReferees[String(courtId)];
  if (!rosterId) {
    return null;
  }

  return findRefereeRosterEntry(roster, rosterId)?.name || null;
}
