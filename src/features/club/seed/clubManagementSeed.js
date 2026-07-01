import { loadClubs, saveClubs } from "../../../data/club.js";
import { saveClubData, getDefaultClubData } from "../../../domain/clubStorage.js";
import { createClubRecord } from "../../../models/club.js";
import { normalizePlayers } from "../../../models/player.js";
import { CLUB_STATUSES } from "../constants/clubStatus.js";
import { createClubMemberRecord } from "../models/clubMember.js";
import { createDefaultClubRating } from "../models/clubPlayerRating.js";
import { saveClubExtension } from "../storage/clubExtensionStorage.js";
import { SEED_TENANTS } from "../../tenant/seed/multiTenantSeed.js";

const SEED_MARKER = "pickleball-club-management-seed-v1";

const FUTURE_ARENA_CLUBS = [
  { id: "club-future-a", name: "CLB A", code: "FA-A" },
  { id: "club-future-b", name: "CLB B", code: "FA-B" },
  { id: "club-future-c", name: "CLB C", code: "FA-C" },
];

function buildDemoPlayers(tenantId, prefix, count) {
  const genders = ["Nam", "Nữ"];
  return normalizePlayers(
    Array.from({ length: count }, (_, index) => ({
      id: `${prefix}-cm-player-${index + 1}`,
      tenantId,
      name: `${prefix} VĐV ${index + 1}`,
      gender: genders[index % 2],
      level: 2.5 + (index % 8) * 0.25,
      status: "active",
      active: true,
      phone: `09${String(10000000 + index).slice(0, 8)}`,
    }))
  );
}

function isSeeded() {
  return localStorage.getItem(SEED_MARKER) === "done";
}

function markSeeded() {
  localStorage.setItem(SEED_MARKER, "done");
}

/**
 * Seed idempotent — chỉ thêm CLB demo nếu chưa có, không xóa dữ liệu thật.
 */
export function ensureClubManagementSeed() {
  if (isSeeded()) {
    return { ok: true, skipped: true };
  }

  const futureTenant = SEED_TENANTS.find((t) => t.id === "tenant-future-arena");
  if (!futureTenant) {
    return { ok: true, skipped: true, reason: "No future arena tenant" };
  }

  const tenantId = futureTenant.id;
  const clubs = loadClubs();
  let changed = false;

  for (const spec of FUTURE_ARENA_CLUBS) {
    const exists = clubs.some((c) => c.id === spec.id);
    if (exists) {
      continue;
    }

    const club = createClubRecord(spec.name, {
      id: spec.id,
      code: spec.code,
      description: `CLB demo ${spec.name} — Future Arena`,
      status: CLUB_STATUSES.ACTIVE,
      tenantId,
      venueId: tenantId,
    });

    clubs.push(club);
    changed = true;

    const playerCount = 12 + Math.floor(Math.random() * 9);
    const players = buildDemoPlayers(tenantId, spec.code, playerCount);
    saveClubData(spec.id, {
      ...getDefaultClubData(spec.id),
      clubId: spec.id,
      tenantId,
      players,
    });

    const members = players.map((player) =>
      createClubMemberRecord({ tenantId, clubId: spec.id, playerId: player.id })
    );
    const ratings = players.map((player) =>
      createDefaultClubRating({
        tenantId,
        clubId: spec.id,
        playerId: player.id,
        level: player.level,
      })
    );

    saveClubExtension(spec.id, {
      members,
      ratings,
      ratingHistory: [],
      matches: [],
    });
  }

  if (changed) {
    saveClubs(clubs);
  }

  markSeeded();
  return { ok: true, seeded: changed, clubCount: FUTURE_ARENA_CLUBS.length };
}
