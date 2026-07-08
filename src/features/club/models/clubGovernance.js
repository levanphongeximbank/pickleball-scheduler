/**
 * Club governance — Chủ sở hữu / Chủ tịch / Phó chủ tịch / cụm sân đăng ký.
 * @see docs/v5/CLUB_GOVERNANCE_SPEC.md
 */

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

  const vicePresidentUserId =
    raw.vicePresidentUserId != null && String(raw.vicePresidentUserId).trim()
      ? String(raw.vicePresidentUserId).trim()
      : null;

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
    registeredClusterId,
    registeredCourtIds,
    approvedByUserId: raw.approvedByUserId ? String(raw.approvedByUserId).trim() : null,
    approvedAt: raw.approvedAt || null,
  };
}

export function hasClubPresident(governance) {
  return Boolean(governance?.presidentUserId);
}
