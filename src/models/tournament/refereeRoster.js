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

  return {
    id: entry.id ? String(entry.id) : createRefereeRosterId(),
    name,
    phone: entry.phone ? String(entry.phone).trim() : "",
    active: entry.active !== false,
    sortOrder: Number.isFinite(Number(entry.sortOrder)) ? Number(entry.sortOrder) : index,
  };
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
    active: true,
  });
}

export function upsertRefereeRosterEntry(roster = [], entry) {
  const normalized = normalizeRefereeRosterEntry(entry);
  if (!normalized) {
    return roster;
  }

  const index = roster.findIndex((item) => String(item.id) === String(normalized.id));
  if (index < 0) {
    return [...roster, normalized];
  }

  return roster.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...normalized } : item
  );
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
