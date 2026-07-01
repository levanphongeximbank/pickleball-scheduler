import { loadClubs, saveClubs } from "../../../data/club.js";
import { createClubRecord } from "../../../models/club.js";
import { createTenantRecord, DEFAULT_TENANT_ID, TENANT_STATUS } from "../../../models/tenant.js";
import { loadVenues, saveVenues } from "../../../data/venue.js";
import { saveClubData, getDefaultClubData } from "../../../domain/clubStorage.js";
import { normalizePlayers } from "../../../models/player.js";
import { normalizeCourts } from "../../../models/court.js";
import { normalizeTournaments } from "../../../models/tournament/index.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";

export const SEED_TENANTS = Object.freeze([
  {
    id: "tenant-future-arena",
    name: "Future Arena",
    slug: "future-arena",
    status: TENANT_STATUS.ACTIVE,
    plan: "pro",
    clubId: "club-future-arena",
    clubName: "Future Arena CLB",
    players: 20,
    courts: 4,
    tournaments: 2,
  },
  {
    id: "tenant-abc-pickleball",
    name: "ABC Pickleball",
    slug: "abc-pickleball",
    status: TENANT_STATUS.TRIAL,
    plan: "trial",
    clubId: "club-abc-pickleball",
    clubName: "ABC Pickleball CLB",
    players: 15,
    courts: 3,
    tournaments: 1,
  },
  {
    id: "tenant-elite-club",
    name: "Elite Club",
    slug: "elite-club",
    status: TENANT_STATUS.ACTIVE,
    plan: "basic",
    clubId: "club-elite-club",
    clubName: "Elite Club CLB",
    players: 25,
    courts: 6,
    tournaments: 2,
  },
]);

const SEED_MARKER = "pickleball-multi-tenant-seed-v1";

function buildPlayers(count, tenantId, prefix) {
  const genders = ["Nam", "Nữ"];
  return normalizePlayers(
    Array.from({ length: count }, (_, index) => ({
      id: `${prefix}-player-${index + 1}`,
      tenantId,
      name: `${prefix} VĐV ${index + 1}`,
      gender: genders[index % 2],
      level: 2.5 + (index % 8) * 0.25,
      status: "active",
      active: true,
    }))
  );
}

function buildCourts(count, tenantId, prefix) {
  return normalizeCourts(
    Array.from({ length: count }, (_, index) => ({
      id: `${prefix}-court-${index + 1}`,
      tenantId,
      name: `${prefix} Sân ${index + 1}`,
      number: index + 1,
      active: true,
      status: "active",
    }))
  );
}

function buildTournaments(count, tenantId, clubId, prefix) {
  return normalizeTournaments(
    Array.from({ length: count }, (_, index) => ({
      id: `${prefix}-tournament-${index + 1}`,
      tenantId,
      clubId,
      name: `${prefix} Giải ${index + 1}`,
      mode: index % 2 === 0 ? TOURNAMENT_MODE.DAILY_PLAY : TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      status: TOURNAMENT_STATUS.DRAFT,
      events: [],
    }))
  );
}

function upsertTenantVenue(config) {
  const venues = loadVenues();
  const existing = venues.find((venue) => venue.id === config.id);

  if (existing) {
    return existing;
  }

  const tenant = createTenantRecord(config.name, {
    id: config.id,
    status: config.status,
    plan: config.plan,
  });

  saveVenues([...venues, tenant]);
  return tenant;
}

function upsertTenantClub(config) {
  const clubs = loadClubs();
  const existing = clubs.find((club) => club.id === config.clubId);

  if (existing) {
    return existing;
  }

  const club = createClubRecord(config.clubName, {
    id: config.clubId,
    venueId: config.id,
  });

  saveClubs([...clubs, club]);
  return club;
}

function seedClubBlob(config) {
  const data = getDefaultClubData(config.clubId);
  const prefix = config.slug.replace(/-/g, "_");

  data.players = buildPlayers(config.players, config.id, prefix);
  data.courts = buildCourts(config.courts, config.id, prefix);
  data.tournaments = buildTournaments(config.tournaments, config.id, config.clubId, prefix);
  data.tenantId = config.id;

  saveClubData(config.clubId, data);
}

export function isMultiTenantSeedApplied() {
  return localStorage.getItem(SEED_MARKER) === "1";
}

export function ensureMultiTenantSeed() {
  if (isMultiTenantSeedApplied()) {
    return { ok: true, skipped: true };
  }

  for (const config of SEED_TENANTS) {
    upsertTenantVenue(config);
    upsertTenantClub(config);
    seedClubBlob(config);
  }

  localStorage.setItem(SEED_MARKER, "1");
  return { ok: true, tenants: SEED_TENANTS.map((item) => item.id) };
}

export function ensureDefaultTenantMigration() {
  const clubs = loadClubs();
  const venues = loadVenues();
  let changedClubs = false;
  let changedVenues = false;

  if (!venues.some((venue) => venue.id === DEFAULT_TENANT_ID)) {
    const defaultTenant = createTenantRecord("Default Tenant", {
      id: DEFAULT_TENANT_ID,
      status: TENANT_STATUS.ACTIVE,
      plan: "basic",
    });
    saveVenues([...venues, defaultTenant]);
    changedVenues = true;
  }

  const nextClubs = clubs.map((club) => {
    if (club.venueId) {
      return club;
    }

    changedClubs = true;
    return {
      ...club,
      venueId: DEFAULT_TENANT_ID,
      updatedAt: new Date().toISOString(),
    };
  });

  if (changedClubs) {
    saveClubs(nextClubs);
  }

  return {
    ok: true,
    migratedClubs: changedClubs,
    createdDefaultTenant: changedVenues,
  };
}
