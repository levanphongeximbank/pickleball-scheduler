import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { savePlayersForClub } from "../src/domain/clubStorage.js";
import { ROLES } from "../src/auth/roles.js";
import { signInAs } from "../src/auth/authService.js";
import { createUserRecord } from "../src/models/user.js";
import {
  buildOrphanProfileAthletes,
  getClubPlayersPlatformWide,
  getPlatformAthletes,
  isPlatformAthleteViewer,
  PLATFORM_ATHLETE_LINK_STATUS,
} from "../src/features/club/services/platformAthleteService.js";
import { ensureMultiTenantSeed } from "../src/features/tenant/seed/multiTenantSeed.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  ensureMultiTenantSeed();
});

afterEach(() => {
  delete globalThis.localStorage;
});

test("isPlatformAthleteViewer — SUPER_ADMIN và SYSTEM_TECHNICIAN", () => {
  assert.equal(isPlatformAthleteViewer(ROLES.SUPER_ADMIN), true);
  assert.equal(isPlatformAthleteViewer(ROLES.SYSTEM_TECHNICIAN), true);
  assert.equal(isPlatformAthleteViewer(ROLES.VENUE_MANAGER), false);
});

test("getClubPlayersPlatformWide — gộp VĐV từ nhiều CLB", () => {
  savePlayersForClub(
    [{ id: "p-club-a", name: "Alpha", gender: "Nam", level: 3.5, rating: 3.5 }],
    "club-future-arena"
  );
  savePlayersForClub(
    [{ id: "p-club-b", name: "Beta", gender: "Nữ", level: 4.0, rating: 4.0 }],
    "club-abc-pickleball"
  );

  const players = getClubPlayersPlatformWide();
  const alpha = players.find((player) => player.id === "p-club-a");
  const beta = players.find((player) => player.id === "p-club-b");

  assert.ok(alpha);
  assert.equal(alpha.sourceClubId, "club-future-arena");
  assert.equal(alpha.linkStatus, PLATFORM_ATHLETE_LINK_STATUS.LINKED);
  assert.ok(beta);
  assert.equal(beta.sourceClubId, "club-abc-pickleball");
});

test("buildOrphanProfileAthletes — tài khoản chưa gắn CLB", () => {
  const rosterPlayers = [
    { id: "player-auth-linked", name: "Linked Athlete", authUserId: "user-linked" },
  ];

  const profiles = [
    createUserRecord({
      id: "user-linked",
      email: "linked@example.com",
      displayName: "Linked Athlete",
      role: ROLES.PLAYER,
    }),
    createUserRecord({
      id: "user-orphan",
      email: "vancuong018@gmail.com",
      displayName: "Nguyễn Văn Cương",
      role: ROLES.PLAYER,
    }),
  ];

  const orphans = buildOrphanProfileAthletes(profiles, rosterPlayers);
  assert.equal(orphans.length, 1);
  assert.equal(orphans[0].id, "profile-user-orphan");
  assert.equal(orphans[0].email, "vancuong018@gmail.com");
  assert.equal(orphans[0].linkStatus, PLATFORM_ATHLETE_LINK_STATUS.ACCOUNT_ONLY);
});

test("getPlatformAthletes — dedupe profile khi đã có trong roster", async () => {
  const authUserId = "athlete-linked-1";
  savePlayersForClub(
    [
      {
        id: `player-auth-${authUserId}`,
        name: "Roster Athlete",
        authUserId,
        gender: "Nam",
        level: 3.5,
        rating: 3.5,
      },
    ],
    "club-future-arena"
  );

  const registryKey = "pickleball-dev-user-registry-v1";
  globalThis.localStorage.setItem(
    registryKey,
    JSON.stringify([
      createUserRecord({
        id: authUserId,
        email: "roster@example.com",
        displayName: "Roster Athlete",
        role: ROLES.PLAYER,
      }),
      createUserRecord({
        id: "orphan-athlete-2",
        email: "orphan@example.com",
        displayName: "Orphan Athlete",
        role: ROLES.PLAYER,
      }),
    ])
  );

  signInAs(
    createUserRecord({
      id: "admin-1",
      email: "admin@example.com",
      role: ROLES.SUPER_ADMIN,
    })
  );

  const result = await getPlatformAthletes();
  assert.equal(result.ok, true);
  assert.ok(result.players.some((player) => player.id === `player-auth-${authUserId}`));
  assert.ok(result.players.some((player) => player.id === "profile-orphan-athlete-2"));
  assert.equal(
    result.players.filter((player) => player.authUserId === authUserId).length,
    1
  );
  assert.ok(result.stats.accountOnlyCount >= 1);
});
