/**
 * Public Clubs/Courts data-source adapters (EC-03 + PUBLIC-PORTAL-01C).
 *
 * Production / default: local club blob + honest MIXED mock fallback (EC-03).
 * Staging opt-in: VITE_PUBLIC_CLUBS_COURTS_SOURCE=remote → PUBLIC-CATALOG-01 RPC
 * with LIVE provenance, no mock fallback, productionReady forced false.
 *
 * Home / featured helpers keep the local sync path (no Home cutover in 01C).
 * Public-portal only — no Competition Engine and no News service imports.
 */
import { loadClubs } from "../../../data/club.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import { MOCK_CLUBS, MOCK_COURTS } from "../../../data/public/mockPublicData.js";
import { PUBLIC_PORTAL_SURFACE_ID } from "../../experience-channels/public-portal/constants/surfaceIds.js";
import { PUBLIC_PORTAL_DATA_SOURCE } from "../../experience-channels/public-portal/constants/dataSources.js";
import {
  createErrorResult,
  createLiveResult,
  resolvePublicListDataResult,
} from "../../experience-channels/public-portal/data-source/index.js";
import {
  listPublicClubsRemote,
  listPublicCourtsRemote,
} from "../../public-catalog/remote/index.js";
import { isOk } from "../../../core/platform/contracts/result.js";

/** Staging-only Clubs/Courts source selector (News-style narrow env). */
export const PUBLIC_CLUBS_COURTS_SOURCE = Object.freeze({
  LOCAL: "local",
  REMOTE: "remote",
});

/**
 * @param {unknown} value
 * @returns {"local"|"remote"|null}
 */
function readClubsCourtsSource(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === PUBLIC_CLUBS_COURTS_SOURCE.REMOTE) {
    return PUBLIC_CLUBS_COURTS_SOURCE.REMOTE;
  }
  if (normalized === PUBLIC_CLUBS_COURTS_SOURCE.LOCAL) {
    return PUBLIC_CLUBS_COURTS_SOURCE.LOCAL;
  }
  return null;
}

/**
 * Explicit source selection. Default is local (Production unchanged).
 * Staging enables remote via VITE_PUBLIC_CLUBS_COURTS_SOURCE=remote.
 * @param {{ source?: string }} [options]
 * @returns {"local"|"remote"}
 */
export function resolvePublicClubsCourtsSource(options = {}) {
  const explicit = readClubsCourtsSource(options.source);
  if (explicit) return explicit;

  const env =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE
      : undefined;
  const nodeEnv =
    typeof globalThis.process !== "undefined"
      ? globalThis.process.env?.VITE_PUBLIC_CLUBS_COURTS_SOURCE
      : undefined;
  const fromEnv = readClubsCourtsSource(env || nodeEnv);
  if (fromEnv) return fromEnv;

  return PUBLIC_CLUBS_COURTS_SOURCE.LOCAL;
}

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
 * Map PUBLIC-CATALOG-01 club DTO → portal ClubCard model.
 * Does not invent private membership / booking fields.
 * @param {Record<string, unknown>} dto
 */
export function mapCatalogClubDtoToPortalCard(dto) {
  const row = dto && typeof dto === "object" ? dto : {};
  return Object.freeze({
    id: String(row.id || ""),
    name: String(row.displayName || row.name || "").trim() || "CLB công khai",
    city: String(row.locationSummary || "").trim() || "Việt Nam",
    members: 0,
    tournaments: 0,
    logo: row.logoUrl == null ? null : String(row.logoUrl),
    image: row.imageUrl == null ? null : String(row.imageUrl),
  });
}

/**
 * Map PUBLIC-CATALOG-01 court DTO → portal CourtCard model.
 * Omits pricing / private ops notes (not on public DTO).
 * @param {Record<string, unknown>} dto
 */
export function mapCatalogCourtDtoToPortalCard(dto) {
  const row = dto && typeof dto === "object" ? dto : {};
  const parts = [row.courtType, row.surface, row.availabilityDescriptor]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return Object.freeze({
    id: String(row.id || ""),
    name: String(row.displayName || row.name || "").trim() || "Sân công khai",
    address: parts.length ? parts.join(" · ") : "—",
    courtCount: 1,
    openHours: row.availabilityDescriptor == null ? null : String(row.availabilityDescriptor),
    amenities: Object.freeze([]),
    image: null,
  });
}

/**
 * Honest Clubs list result (EC-03). Local path keeps mock fallback; never presents mock as LIVE.
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
 * Honest Courts list result (EC-03). Local path keeps mock fallback; never presents mock as LIVE.
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

/**
 * @param {unknown} error
 * @param {string} ownerSurface
 */
function remoteFailToErrorResult(error, ownerSurface) {
  const payload =
    error && typeof error === "object"
      ? error
      : { code: "PUBLIC_CATALOG_REMOTE_FAILED", message: "Public catalog remote read failed" };
  return createErrorResult({
    ownerSurface,
    source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
    error: {
      code: String(payload.code || "PUBLIC_CATALOG_REMOTE_FAILED"),
      message: String(payload.message || "Public catalog remote read failed"),
    },
    data: [],
  });
}

/**
 * Staging remote Clubs loader — RPC only, no mock fallback.
 * LIVE provenance on success (including empty []). productionReady always false.
 * @param {{
 *   source?: string,
 *   query?: Record<string, unknown>,
 *   client?: object,
 *   repository?: object,
 *   facade?: object,
 * }} [options]
 */
export async function loadPublicClubsFromRemote(options = {}) {
  const remote = await listPublicClubsRemote(options.query || {}, {
    client: options.client,
    repository: options.repository,
    facade: options.facade,
  });

  if (!isOk(remote)) {
    return remoteFailToErrorResult(remote.error, PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS);
  }

  const items = Array.isArray(remote.value?.items) ? remote.value.items : null;
  if (!items) {
    return remoteFailToErrorResult(
      {
        code: "PUBLIC_CATALOG_MALFORMED_RESPONSE",
        message: "Remote club list response is malformed",
      },
      PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS
    );
  }

  const data = items.map((row) => mapCatalogClubDtoToPortalCard(row));
  return createLiveResult({
    data,
    ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    productionReady: false,
  });
}

/**
 * Staging remote Courts loader — RPC only, no mock fallback.
 * @param {{
 *   source?: string,
 *   query?: Record<string, unknown>,
 *   client?: object,
 *   repository?: object,
 *   facade?: object,
 * }} [options]
 */
export async function loadPublicCourtsFromRemote(options = {}) {
  const remote = await listPublicCourtsRemote(options.query || {}, {
    client: options.client,
    repository: options.repository,
    facade: options.facade,
  });

  if (!isOk(remote)) {
    return remoteFailToErrorResult(remote.error, PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS);
  }

  const items = Array.isArray(remote.value?.items) ? remote.value.items : null;
  if (!items) {
    return remoteFailToErrorResult(
      {
        code: "PUBLIC_CATALOG_MALFORMED_RESPONSE",
        message: "Remote court list response is malformed",
      },
      PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS
    );
  }

  const data = items.map((row) => mapCatalogCourtDtoToPortalCard(row));
  return createLiveResult({
    data,
    ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS,
    productionReady: false,
  });
}

/**
 * Clubs page loader. Staging remote when source=remote; else local EC-03 path.
 * Caller-controlled retry only — no adapter loops.
 * @param {{ source?: string, query?: Record<string, unknown>, client?: object, repository?: object, facade?: object }} [options]
 */
export async function loadPublicClubsPageResult(options = {}) {
  const source = resolvePublicClubsCourtsSource(options);
  if (source === PUBLIC_CLUBS_COURTS_SOURCE.REMOTE) {
    return loadPublicClubsFromRemote(options);
  }
  return getPublicClubsResult();
}

/**
 * Courts page loader. Staging remote when source=remote; else local EC-03 path.
 * @param {{ source?: string, query?: Record<string, unknown>, client?: object, repository?: object, facade?: object }} [options]
 */
export async function loadPublicCourtsPageResult(options = {}) {
  const source = resolvePublicClubsCourtsSource(options);
  if (source === PUBLIC_CLUBS_COURTS_SOURCE.REMOTE) {
    return loadPublicCourtsFromRemote(options);
  }
  return getPublicCourtsResult();
}
