export const COURT_STATUSES = ["active", "locked", "maintenance"];
export const COURT_TYPES = ["indoor", "outdoor", "covered"];

function toCourtNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export function getCourtDisplayName(court, fallbackIndex = 0) {
  if (court?.name && String(court.name).trim() !== "") {
    return String(court.name).trim();
  }

  if (court?.number !== undefined && court?.number !== null && court.number !== "") {
    return `Sân ${court.number}`;
  }

  return `Sân ${fallbackIndex + 1}`;
}

export function normalizeCourt(court, index = 0) {
  const active = court?.active !== false;
  const status = COURT_STATUSES.includes(court?.status)
    ? court.status
    : active
      ? "active"
      : "locked";

  return {
    id: court?.id ?? index + 1,
    name: court?.name ? String(court.name).trim() : "",
    number: toCourtNumber(court?.number),
    active,
    status,
    courtType: COURT_TYPES.includes(court?.courtType) ? court.courtType : "outdoor",
    defaultHourlyRate: toNonNegativeNumber(court?.defaultHourlyRate),
    peakHourlyRate: toNonNegativeNumber(court?.peakHourlyRate),
    note: court?.note ? String(court.note).trim() : "",
  };
}

export function isCourtBookable(court) {
  if (!court || court.active === false) {
    return false;
  }

  return court.status === "active";
}

export function normalizeCourts(courts = []) {
  if (!Array.isArray(courts)) {
    return [];
  }

  return courts.filter(Boolean).map((court, index) => normalizeCourt(court, index));
}
