import {
  DEFAULT_CLUB,
  getActiveClubId,
  loadClubs,
  saveClubs,
  setActiveClubId,
} from "../data/club.js";
import { loadActiveTenantId } from "../data/tenantSession.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { guardClubAction, guardClubAccess, guardPermission } from "../auth/guardAction.js";
import { getCurrentUser, isRbacEnabled } from "../auth/authService.js";
import { ROLES, isGlobalRole, isVenueScopedRole } from "../auth/roles.js";
import { canDeleteClub } from "../features/club/services/clubGovernanceService.js";
import { resolveEffectiveTenantId } from "../features/tenant/services/tenantService.js";
import { guardMaxClubs } from "../auth/subscriptionGuard.js";
import { createClubRecord, normalizeClub } from "../models/club.js";
import { loadClubData, purgeClubData, saveClubData } from "./clubStorage.js";

export function listClubs() {
  return loadClubs();
}

export function getClubById(clubId) {
  return loadClubs().find((club) => club.id === clubId) || null;
}

export function createClub(name) {
  const trimmed = String(name || "").trim();

  if (trimmed === "") {
    return { ok: false, error: "Ten CLB khong duoc de trong." };
  }

  let venueId = null;

  if (isRbacEnabled()) {
    const currentUser = getCurrentUser();
    if (currentUser) {
      if (isGlobalRole(currentUser.role)) {
        venueId = loadActiveTenantId() || resolveEffectiveTenantId(currentUser);
      } else if (
        currentUser.venueId ||
        currentUser.tenantId ||
        isVenueScopedRole(currentUser.role) ||
        currentUser.role === ROLES.SUPER_ADMIN
      ) {
        venueId = resolveEffectiveTenantId(currentUser);
      }

      if (venueId) {
        const limitCheck = guardMaxClubs(venueId);
        if (!limitCheck.ok) {
          return limitCheck;
        }
      }
    }
  }

  const check = guardPermission(
    PERMISSIONS.CLUB_CREATE,
    venueId ? { venueId } : {}
  );
  if (!check.ok) {
    return check;
  }

  const clubs = loadClubs();
  const club = createClubRecord(trimmed, venueId ? { venueId } : {});
  const next = [...clubs, club];
  saveClubs(next);

  loadClubData(club.id);

  return { ok: true, club };
}

export function renameClub(clubId, name) {
  const trimmed = String(name || "").trim();

  if (trimmed === "") {
    return { ok: false, error: "Ten CLB khong duoc de trong." };
  }

  const check = guardClubAction(clubId, PERMISSIONS.CLUB_UPDATE);
  if (!check.ok) {
    return check;
  }

  const clubs = loadClubs();
  const index = clubs.findIndex((club) => club.id === clubId);

  if (index < 0) {
    return { ok: false, error: "Khong tim thay CLB." };
  }

  const next = clubs.map((club) =>
    club.id === clubId
      ? normalizeClub({
          ...club,
          name: trimmed,
          updatedAt: new Date().toISOString(),
        })
      : club
  );

  saveClubs(next);
  return { ok: true, club: next[index] };
}

export function bindClubVenueRegistry(clubId, venueId, options = {}) {
  const { skipGuard = false } = options;

  if (!clubId || !venueId) {
    return { ok: false, error: "Thieu clubId hoac venueId." };
  }

  if (!skipGuard) {
    const check = guardClubAction(clubId, PERMISSIONS.CLUB_UPDATE);
    if (!check.ok) {
      return check;
    }
  }

  const clubs = loadClubs();
  const index = clubs.findIndex((club) => club.id === clubId);

  if (index < 0) {
    return { ok: false, error: "Khong tim thay CLB." };
  }

  const next = clubs.map((club) =>
    club.id === clubId
      ? normalizeClub({
          ...club,
          venueId,
          tenantId: venueId,
          updatedAt: new Date().toISOString(),
        })
      : club
  );

  saveClubs(next);
  return { ok: true, club: next.find((club) => club.id === clubId) };
}

export function updateClubMeta(clubId, patch = {}) {
  const check = guardClubAction(clubId, PERMISSIONS.CLUB_UPDATE);
  if (!check.ok) {
    return check;
  }

  const clubs = loadClubs();
  const index = clubs.findIndex((club) => club.id === clubId);

  if (index < 0) {
    return { ok: false, error: "Khong tim thay CLB." };
  }

  const next = clubs.map((club) =>
    club.id === clubId
      ? normalizeClub({
          ...club,
          ...patch,
          id: club.id,
          isDefault: club.isDefault,
          updatedAt: new Date().toISOString(),
        })
      : club
  );

  saveClubs(next);
  return { ok: true, club: next.find((club) => club.id === clubId) };
}

export function deleteClub(clubId) {
  if (clubId === DEFAULT_CLUB.id) {
    return { ok: false, error: "Khong the xoa CLB mac dinh." };
  }

  const club = getClubById(clubId);
  const user = getCurrentUser();
  const check = guardClubAction(clubId, PERMISSIONS.CLUB_DELETE);
  if (!check.ok) {
    if (!canDeleteClub(user, club)) {
      return check;
    }

    const access = guardClubAccess(clubId);
    if (!access.ok) {
      return access;
    }
  }

  const clubs = loadClubs();
  const next = clubs.filter((club) => club.id !== clubId);

  if (next.length === clubs.length) {
    return { ok: false, error: "Khong tim thay CLB can xoa." };
  }

  saveClubs(next);
  purgeClubData(clubId);

  if (getActiveClubId() === clubId) {
    setActiveClubId(DEFAULT_CLUB.id);
  }

  return { ok: true };
}

export function switchActiveClub(clubId) {
  const access = guardClubAccess(clubId);
  if (!access.ok) {
    return access;
  }

  const viewCheck = guardClubAction(clubId, PERMISSIONS.CLUB_VIEW);
  if (!viewCheck.ok) {
    return viewCheck;
  }

  const ok = setActiveClubId(clubId);

  if (!ok) {
    return { ok: false, error: "Khong the chuyen CLB." };
  }

  loadClubData(clubId);
  return { ok: true, clubId };
}

export function getClubSummary(clubId = getActiveClubId()) {
  const data = loadClubData(clubId);
  const club = getClubById(clubId);

  return {
    club,
    totals: {
      players: data.players.length,
      courts: data.courts.length,
      activeCourts: data.courts.filter((court) => court.active !== false).length,
      seasons: data.seasons.length,
      leagues: data.leagues.length,
      sessions: data.sessions.length,
      rounds: data.rounds.length,
    },
    active: data.active,
    seasons: data.seasons,
    leagues: data.leagues,
  };
}

export function importFullClubData(clubId, payload) {
  const check = guardClubAction(clubId, PERMISSIONS.SYSTEM_SETTING);
  if (!check.ok) {
    return check;
  }

  const source = payload?.data || payload;

  if (!source || typeof source !== "object") {
    return { ok: false, error: "Du lieu import khong hop le." };
  }

  saveClubData(clubId, {
    ...source,
    clubId,
  });

  return { ok: true };
}
