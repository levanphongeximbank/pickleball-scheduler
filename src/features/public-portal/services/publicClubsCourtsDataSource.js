/**
 * Public Clubs/Courts data-source adapters (EC-03).
 * Public-portal only — no Competition Engine and no News service imports.
 */
import { loadClubs } from "../../../data/club.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import { MOCK_CLUBS, MOCK_COURTS } from "../../../data/public/mockPublicData.js";
import { PUBLIC_PORTAL_SURFACE_ID } from "../../experience-channels/public-portal/constants/surfaceIds.js";
import { resolvePublicListDataResult } from "../../experience-channels/public-portal/data-source/index.js";

function safeLoadClubData(clubId) {
  try {
    return loadClubData(clubId);
  } catch {
    return null;
  }
}

function mapLiveClubs() {
  const clubs = loadClubs().filter((c) => !c.isDefault && c.status !== "inactive");
  if (!clubs.length) return [];

  return clubs.map((club) => {
    const data = safeLoadClubData(club.id);
    const memberCount = data?.players?.length || 0;
    const tournamentCount = data?.tournaments?.length || 0;

    return {
      id: club.id,
      name: club.name,
      city: club.city || club.location || "Việt Nam",
      members: memberCount,
      tournaments: tournamentCount,
      logo: club.logo || null,
      image: club.coverImage || null,
    };
  });
}

function mapLiveCourts() {
  const clubs = loadClubs().filter((c) => !c.isDefault);
  const items = [];

  for (const club of clubs) {
    const data = safeLoadClubData(club.id);
    const courts = data?.courts || [];
    if (!courts.length) continue;

    const cm = data?.courtManagement || {};
    const openHour = cm.openHour ?? 6;
    const closeHour = cm.closeHour ?? 22;
    const openHours = `${String(openHour).padStart(2, "0")}:00 – ${String(closeHour).padStart(2, "0")}:00`;

    items.push({
      id: `venue-${club.id}`,
      name: club.name,
      address: club.address || club.city || club.location || "—",
      courtCount: courts.filter((c) => c.active !== false).length,
      openHours,
      amenities: ["Đèn LED", "Sân chuẩn"],
      image: club.coverImage || null,
    });
  }

  return items;
}

/**
 * Honest Clubs list result (EC-03). Keeps mock fallback but never presents it as LIVE.
 */
export function getPublicClubsResult() {
  return resolvePublicListDataResult({
    ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    loadLive: mapLiveClubs,
    mockData: MOCK_CLUBS,
    minLength: 3,
    allowMockFallback: true,
  });
}

export function getPublicClubs() {
  const result = getPublicClubsResult();
  return Array.isArray(result.data) ? result.data : [];
}

export function getFeaturedClubs(limit = 4) {
  return getPublicClubs().slice(0, limit);
}

/**
 * Honest Courts list result (EC-03). Keeps mock fallback but never presents it as LIVE.
 */
export function getPublicCourtsResult() {
  return resolvePublicListDataResult({
    ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS,
    loadLive: mapLiveCourts,
    mockData: MOCK_COURTS,
    minLength: 2,
    allowMockFallback: true,
  });
}

export function getPublicCourts() {
  const result = getPublicCourtsResult();
  return Array.isArray(result.data) ? result.data : [];
}

export function getFeaturedCourts(limit = 3) {
  return getPublicCourts().slice(0, limit);
}
