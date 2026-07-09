import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { loadClubs, saveClubs } from "../src/data/club.js";
import { createClubRecord } from "../src/models/club.js";
import { ROLES } from "../src/auth/roles.js";
import { CLUB_STATUSES } from "../src/features/club/constants/clubStatus.js";
import {
  setClubVicePresidents,
  getVicePresidentUserIds,
  isClubVicePresident,
  MAX_VICE_PRESIDENTS,
} from "../src/features/club/index.js";
import { saveAuthSession } from "../src/auth/authStorage.js";
import { saveClubData } from "../src/domain/clubStorage.js";
import { normalizePlayers } from "../src/models/player.js";
import { addMemberToClub } from "../src/features/club/services/clubMemberService.js";
import { saveAthleteClubLink } from "../src/features/club/storage/athleteClubLinkStore.js";

const TENANT = "tenant-vice-test";
const CLUB_ID = "club-vice-test";
const PRESIDENT_ID = "user-president";
const VICE_ONE = "user-vice-1";
const VICE_TWO = "user-vice-2";
const MEMBER_ID = "user-member";

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

function makeClub(overrides = {}) {
  return createClubRecord("CLB Vice Test", {
    id: CLUB_ID,
    tenantId: TENANT,
    venueId: TENANT,
    status: CLUB_STATUSES.ACTIVE,
    governance: {
      presidentUserId: PRESIDENT_ID,
      ownerUserId: PRESIDENT_ID,
      vicePresidentUserIds: [],
      registeredCourtIds: [],
    },
    ...overrides,
  });
}

function seedPlayers() {
  const players = normalizePlayers([
    { id: "player-vice-1", name: "VP 1", authUserId: VICE_ONE, status: "active", active: true },
    { id: "player-vice-2", name: "VP 2", authUserId: VICE_TWO, status: "active", active: true },
    { id: "player-member", name: "Member", authUserId: MEMBER_ID, status: "active", active: true },
  ]);
  saveClubData(CLUB_ID, { players, tenantId: TENANT });
  for (const player of players) {
    addMemberToClub(CLUB_ID, player.id, TENANT, { skipPermissionGuard: true });
    if (player.authUserId) {
      saveAthleteClubLink(player.authUserId, { clubId: CLUB_ID, playerId: player.id });
    }
  }
}

describe("club governance — 2 vice presidents", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    saveClubs([makeClub()]);
    seedPlayers();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("assigns up to two vice presidents", async () => {
    saveAuthSession({
      id: PRESIDENT_ID,
      role: ROLES.CLUB_MANAGER,
      clubId: CLUB_ID,
      tenantId: TENANT,
    });

    const result = await setClubVicePresidents(CLUB_ID, [VICE_ONE, VICE_TWO], TENANT);
    assert.equal(result.ok, true);

    const club = loadClubs().find((item) => item.id === CLUB_ID);
    const viceIds = getVicePresidentUserIds(club.governance);
    assert.equal(viceIds.length, 2);
    assert.ok(viceIds.includes(VICE_ONE));
    assert.ok(viceIds.includes(VICE_TWO));
    assert.equal(isClubVicePresident({ id: VICE_ONE }, club), true);
  });

  it("blocks more than max vice presidents", async () => {
    saveAuthSession({
      id: PRESIDENT_ID,
      role: ROLES.CLUB_MANAGER,
      clubId: CLUB_ID,
      tenantId: TENANT,
    });

    const result = await setClubVicePresidents(
      CLUB_ID,
      [VICE_ONE, VICE_TWO, MEMBER_ID],
      TENANT
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /Tối đa/);
    assert.equal(MAX_VICE_PRESIDENTS, 2);
  });

  it("blocks vice president same as president", async () => {
    saveAuthSession({
      id: PRESIDENT_ID,
      role: ROLES.CLUB_MANAGER,
      clubId: CLUB_ID,
      tenantId: TENANT,
    });

    const result = await setClubVicePresidents(CLUB_ID, [PRESIDENT_ID], TENANT);
    assert.equal(result.ok, false);
    assert.match(result.error, /trùng Chủ tịch/);
  });

  it("migrates legacy single vicePresidentUserId field", () => {
    const club = makeClub({
      governance: {
        presidentUserId: PRESIDENT_ID,
        vicePresidentUserId: VICE_ONE,
      },
    });
    const ids = getVicePresidentUserIds(club.governance);
    assert.deepEqual(ids, [VICE_ONE]);
  });
});
