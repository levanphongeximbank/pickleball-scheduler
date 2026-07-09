/**
 * Club governance — Chủ sở hữu / Chủ tịch / Phó chủ tịch / cụm sân đăng ký.
 * @see docs/v5/CLUB_GOVERNANCE_SPEC.md
 */

export const MAX_VICE_PRESIDENTS = 2;

export function normalizeVicePresidentUserIds(raw = {}) {
  if (Array.isArray(raw.vicePresidentUserIds)) {
    const ids = raw.vicePresidentUserIds
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    return [...new Set(ids)].slice(0, MAX_VICE_PRESIDENTS);
  }

  if (raw.vicePresidentUserId != null && String(raw.vicePresidentUserId).trim()) {
    return [String(raw.vicePresidentUserId).trim()];
  }

  return [];
}

export function normalizeClubGovernance(input = {}, club = {}) {
  const raw = input.governance || input;

  const presidentUserId =
    raw.presidentUserId != null && String(raw.presidentUserId).trim()
      ? String(raw.presidentUserId).trim()
      : club.presidentUserId != null && String(club.presidentUserId).trim()
        ? String(club.presidentUserId).trim()
        : club.createdByUserId
          ? String(club.createdByUserId).trim()
          : null;

  const ownerUserId =
    raw.ownerUserId != null && String(raw.ownerUserId).trim()
      ? String(raw.ownerUserId).trim()
      : null;

  const vicePresidentUserIds = normalizeVicePresidentUserIds(raw);
  const vicePresidentUserId = vicePresidentUserIds[0] || null;

  const registeredCourtIds = Array.isArray(raw.registeredCourtIds)
    ? raw.registeredCourtIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  const registeredClusterId =
    raw.registeredClusterId != null && String(raw.registeredClusterId).trim()
      ? String(raw.registeredClusterId).trim()
      : null;

  return {
    ownerUserId,
    presidentUserId,
    vicePresidentUserId,
    vicePresidentUserIds,
    registeredClusterId,
    registeredCourtIds,
    approvedByUserId: raw.approvedByUserId ? String(raw.approvedByUserId).trim() : null,
    approvedAt: raw.approvedAt || null,
  };
}

export function hasClubPresident(governance) {
  return Boolean(governance?.presidentUserId);
}

export function getVicePresidentUserIds(governance) {
  if (!governance) {
    return [];
  }
  if (Array.isArray(governance.vicePresidentUserIds) && governance.vicePresidentUserIds.length) {
    return governance.vicePresidentUserIds.map((id) => String(id).trim()).filter(Boolean);
  }
  if (governance.vicePresidentUserId) {
    return [String(governance.vicePresidentUserId).trim()];
  }
  return [];
}
