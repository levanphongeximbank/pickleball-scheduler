/**
 * Public Clubs/Courts data-source adapters (EC-03 + PUBLIC-PORTAL-01C + Wave A3).
 *
 * HC OFF / default local: local club blob + honest MIXED mock fallback (EC-03), labeled.
 * HC ON: canonical public-catalog remote only — no localStorage SoT, no mock-on-empty,
 * no demo-club fallback. Fail closed with typed EMPTY / UNAVAILABLE / ERROR.
 *
 * Staging opt-in without HC: VITE_PUBLIC_CLUBS_COURTS_SOURCE=remote → RPC with LIVE
 * provenance, no mock fallback, productionReady forced false.
 *
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
  createUnavailableResult,
  resolvePublicListDataResult,
} from "../../experience-channels/public-portal/data-source/index.js";
import {
  listPublicClubsRemote,
  listPublicCourtsRemote,
} from "../../public-catalog/remote/index.js";
import { isOk } from "../../../core/platform/contracts/result.js";
import { HARD_CUTOVER_FLAG } from "../../platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  assertPublicPortalLocalAuthorityAllowed,
  assertPublicPortalMockFallbackAllowed,
} from "../../platform-hard-cutover/legacyAuthorityPolicy.js";
import {
  PUBLIC_PORTAL_ERROR_USER_MESSAGE,
  PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
} from "../runtime/constants.js";
import { resolvePublicPortalRuntime } from "../runtime/resolvePublicPortalRuntime.js";

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

function readEnvBag(options = {}) {
  if (options.env && typeof options.env === "object") return options.env;
  const vite =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const node =
    typeof globalThis.process !== "undefined" ? globalThis.process.env || {} : {};
  return { ...node, ...vite };
}

/**
 * Explicit source selection. Default is local (Production unchanged) when HC OFF.
 * HC ON always resolves remote (canonical). Staging may set remote via env.
 * @param {{ source?: string, env?: Record<string, unknown>, hardCutover?: boolean }} [options]
 * @returns {"local"|"remote"}
 */
export function resolvePublicClubsCourtsSource(options = {}) {
  const env = readEnvBag(options);
  const runtime = resolvePublicPortalRuntime({
    env,
    hardCutover: options.hardCutover,
    sourceMode: options.source,
  });
  if (runtime.requiresCanonicalRemote) {
    return PUBLIC_CLUBS_COURTS_SOURCE.REMOTE;
  }

  const explicit = readClubsCourtsSource(options.source);
  if (explicit) return explicit;

  const fromEnv = readClubsCourtsSource(env.VITE_PUBLIC_CLUBS_COURTS_SOURCE);
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
      // Unknown != true: do not invent amenities without authoritative backing.
      amenities: [],
      image: club.coverImage || null,
    });
  }

  return items;
}

/**
 * Map PUBLIC-CATALOG-01 club DTO → portal ClubCard model.
 * Does not invent private membership / booking fields or fake counts.
 * @param {Record<string, unknown>} dto
 */
export function mapCatalogClubDtoToPortalCard(dto) {
  const row = dto && typeof dto === "object" ? dto : {};
  return Object.freeze({
    id: String(row.id || ""),
    name: String(row.displayName || row.name || "").trim() || "CLB công khai",
    city: String(row.locationSummary || "").trim() || "Việt Nam",
    members: null,
    tournaments: null,
    logo: row.logoUrl == null ? null : String(row.logoUrl),
    image: row.imageUrl == null ? null : String(row.imageUrl),
  });
}

/**
 * Map PUBLIC-CATALOG-01 court DTO → portal CourtCard model.
 * Omits pricing / private ops notes (not on public DTO).
 * Does not invent courtCount when DTO lacks a trusted count.
 * @param {Record<string, unknown>} dto
 */
export function mapCatalogCourtDtoToPortalCard(dto) {
  const row = dto && typeof dto === "object" ? dto : {};
  const parts = [row.courtType, row.surface, row.availabilityDescriptor]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  const rawCount = row.courtCount;
  const courtCount =
    typeof rawCount === "number" && Number.isFinite(rawCount) && rawCount > 0
      ? rawCount
      : null;
  return Object.freeze({
    id: String(row.id || ""),
    name: String(row.displayName || row.name || "").trim() || "Sân công khai",
    address: parts.length ? parts.join(" · ") : "—",
    courtCount,
    openHours:
      row.availabilityDescriptor == null ? null : String(row.availabilityDescriptor),
    amenities: Object.freeze([]),
    image: null,
  });
}

function hardCutoverBlockedResult(ownerSurface, env) {
  // Assert gates for testability / fail-closed documentation (sync cannot claim remote).
  assertPublicPortalLocalAuthorityAllowed(env);
  assertPublicPortalMockFallbackAllowed(env);
  return createUnavailableResult({
    ownerSurface,
    source: PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN,
    data: [],
    message: PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
  });
}

/**
 * Honest Clubs list result (EC-03). Local path keeps mock fallback when HC OFF.
 * Under HC ON sync path cannot claim canonical remote — fail closed UNAVAILABLE.
 */
export function getPublicClubsResult(options = {}) {
  const env = readEnvBag(options);
  const runtime = resolvePublicPortalRuntime({
    env,
    hardCutover: options.hardCutover,
    sourceMode: "local",
  });
  if (runtime.isHardCutover) {
    return hardCutoverBlockedResult(PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS, env);
  }

  return resolvePublicListDataResult({
    ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    loadLive: mapLiveClubs,
    mockData: MOCK_CLUBS,
    minLength: 3,
    // HC OFF only — HC ON returns earlier. Literal true keeps EC-03 honesty lock.
    allowMockFallback: true,
  });
}

export function getPublicClubs(options = {}) {
  const result = getPublicClubsResult(options);
  return Array.isArray(result.data) ? result.data : [];
}

export function getFeaturedClubs(limit = 4, options = {}) {
  return getPublicClubs(options).slice(0, limit);
}

/**
 * Honest Courts list result (EC-03). Local path keeps mock fallback when HC OFF.
 */
export function getPublicCourtsResult(options = {}) {
  const env = readEnvBag(options);
  const runtime = resolvePublicPortalRuntime({
    env,
    hardCutover: options.hardCutover,
    sourceMode: "local",
  });
  if (runtime.isHardCutover) {
    return hardCutoverBlockedResult(PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS, env);
  }

  return resolvePublicListDataResult({
    ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS,
    loadLive: mapLiveCourts,
    mockData: MOCK_COURTS,
    minLength: 2,
    // HC OFF only — HC ON returns earlier. Literal true keeps EC-03 honesty lock.
    allowMockFallback: true,
  });
}

export function getPublicCourts(options = {}) {
  const result = getPublicCourtsResult(options);
  return Array.isArray(result.data) ? result.data : [];
}

export function getFeaturedCourts(limit = 3, options = {}) {
  return getPublicCourts(options).slice(0, limit);
}

/**
 * @param {unknown} error
 * @param {string} ownerSurface
 */
function remoteFailToErrorResult(error, ownerSurface) {
  const payload =
    error && typeof error === "object"
      ? error
      : {
          code: "PUBLIC_CATALOG_REMOTE_FAILED",
          message: PUBLIC_PORTAL_ERROR_USER_MESSAGE,
        };
  const code = String(payload.code || "PUBLIC_CATALOG_REMOTE_FAILED");
  const isUnavailable =
    /UNAVAILABLE|CLIENT_UNAVAILABLE|AUTHORITY/i.test(code) ||
    /unavailable|client unavailable/i.test(String(payload.message || ""));

  if (isUnavailable) {
    return createUnavailableResult({
      ownerSurface,
      source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
      data: [],
      message: PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
    });
  }

  return createErrorResult({
    ownerSurface,
    source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
    error: {
      code,
      message: PUBLIC_PORTAL_ERROR_USER_MESSAGE,
    },
    data: [],
  });
}

/**
 * Staging / HC remote Clubs loader — RPC only, no mock fallback.
 * LIVE provenance on success (including empty []). productionReady always false.
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
 * Staging / HC remote Courts loader — RPC only, no mock fallback.
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
 * Clubs page loader. HC ON / source=remote → canonical RPC only.
 * Caller-controlled retry only — no adapter loops.
 */
export async function loadPublicClubsPageResult(options = {}) {
  const source = resolvePublicClubsCourtsSource(options);
  if (source === PUBLIC_CLUBS_COURTS_SOURCE.REMOTE) {
    return loadPublicClubsFromRemote(options);
  }
  return getPublicClubsResult(options);
}

/**
 * Courts page loader. HC ON / source=remote → canonical RPC only.
 */
export async function loadPublicCourtsPageResult(options = {}) {
  const source = resolvePublicClubsCourtsSource(options);
  if (source === PUBLIC_CLUBS_COURTS_SOURCE.REMOTE) {
    return loadPublicCourtsFromRemote(options);
  }
  return getPublicCourtsResult(options);
}

export { HARD_CUTOVER_FLAG };
