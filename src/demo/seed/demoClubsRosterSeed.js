import { loadClubs, saveClubs } from "../../data/club.js";
import { loadClubData, saveClubData } from "../../domain/clubStorage.js";
import { createClubRecord } from "../../models/club.js";
import { normalizePlayers } from "../../models/player.js";

export const DEMO_ROSTER_CLUBS = Object.freeze([
  { id: "demo-club-saigon", name: "CLB Sài Gòn Pickleball", slug: "saigon" },
  { id: "demo-club-hanoi", name: "CLB Hà Nội Smash", slug: "hanoi" },
  { id: "demo-club-danang", name: "CLB Đà Nẵng Paddle", slug: "danang" },
  { id: "demo-club-cantho", name: "CLB Cần Thơ Courts", slug: "cantho" },
]);

const LAST_NAMES = [
  "Nguyễn",
  "Trần",
  "Lê",
  "Phạm",
  "Hoàng",
  "Vũ",
  "Đặng",
  "Bùi",
  "Đỗ",
  "Hồ",
  "Ngô",
  "Dương",
];

const MALE_GIVEN = [
  "Anh",
  "Bảo",
  "Cường",
  "Dũng",
  "Hải",
  "Khôi",
  "Long",
  "Minh",
  "Nam",
  "Phong",
  "Quân",
  "Sơn",
  "Thành",
  "Tuấn",
  "Việt",
];

const FEMALE_GIVEN = [
  "An",
  "Chi",
  "Dung",
  "Giang",
  "Hà",
  "Hương",
  "Lan",
  "Linh",
  "Mai",
  "Nga",
  "Oanh",
  "Phương",
  "Quỳnh",
  "Thảo",
  "Vy",
];

export function buildDemoPlayers(count, clubSpec, options = {}) {
  const clubId = clubSpec.id;
  const slug = clubSpec.slug;
  const basePhone = options.phoneBase ?? 900000000;

  return normalizePlayers(
    Array.from({ length: count }, (_, index) => {
      const isMale = index % 2 === 0;
      const lastName = LAST_NAMES[index % LAST_NAMES.length];
      const givenPool = isMale ? MALE_GIVEN : FEMALE_GIVEN;
      const givenName = givenPool[Math.floor(index / LAST_NAMES.length) % givenPool.length];
      const level = 1.0 + (index % 15) * 0.5;

      return {
        id: `${clubId}-vdv-${index + 1}`,
        name: `${lastName} ${givenName} ${index + 1}`,
        gender: isMale ? "Nam" : "Nữ",
        phone: `09${String(basePhone + index).slice(-8)}`,
        level: Math.round(level * 10) / 10,
        rating: Math.round(level * 10) / 10,
        status: "active",
        active: true,
        note: `Demo ${slug}`,
      };
    })
  );
}

/**
 * Tạo 4 CLB demo, mỗi CLB `playersPerClub` VĐV (mặc định 60).
 * Ghi đè danh sách VĐV nếu CLB demo đã tồn tại.
 */
export function seedDemoClubsRoster(options = {}) {
  const playersPerClub = Number(options.playersPerClub) || 60;
  const replaceExisting = options.replaceExisting !== false;

  if (playersPerClub < 1 || playersPerClub > 500) {
    return { ok: false, error: "Số VĐV mỗi CLB phải từ 1 đến 500." };
  }

  const clubs = loadClubs();
  const summary = [];

  for (const spec of DEMO_ROSTER_CLUBS) {
    let club = clubs.find((item) => item.id === spec.id);

    if (!club) {
      club = createClubRecord(spec.name, { id: spec.id });
      clubs.push(club);
    }

    const data = loadClubData(spec.id);
    const hadPlayers = Array.isArray(data.players) ? data.players.length : 0;

    if (!replaceExisting && hadPlayers > 0) {
      summary.push({
        clubId: spec.id,
        name: spec.name,
        players: hadPlayers,
        skipped: true,
      });
      continue;
    }

    data.players = buildDemoPlayers(playersPerClub, spec, {
      phoneBase: 100000000 + summary.length * 100000,
    });
    saveClubData(spec.id, data);

    summary.push({
      clubId: spec.id,
      name: spec.name,
      players: data.players.length,
      skipped: false,
    });
  }

  saveClubs(clubs);

  const totalPlayers = summary.reduce((sum, item) => sum + item.players, 0);

  return {
    ok: true,
    clubs: summary,
    totalPlayers,
    playersPerClub,
  };
}
