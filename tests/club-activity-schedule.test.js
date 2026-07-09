import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { loadClubs, saveClubs } from "../src/data/club.js";
import { createClubRecord } from "../src/models/club.js";
import { ROLES } from "../src/auth/roles.js";
import { CLUB_STATUSES } from "../src/features/club/constants/clubStatus.js";
import { saveAuthSession } from "../src/auth/authStorage.js";
import {
  createClubActivitySession,
  deleteClubActivitySession,
  listClubActivitySessions,
  canManageClubActivitySchedule,
} from "../src/features/club/index.js";
import { loadClubExtension } from "../src/features/club/storage/clubExtensionStorage.js";
import { saveClubData } from "../src/domain/clubStorage.js";
import { normalizePlayers } from "../src/models/player.js";
import { addMemberToClub } from "../src/features/club/services/clubMemberService.js";

const TENANT = "tenant-schedule-test";
const CLUB_ID = "club-schedule-test";
const PRESIDENT_ID = "user-president";
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

function makeClub() {
  return createClubRecord("CLB Schedule Test", {
    id: CLUB_ID,
    tenantId: TENANT,
    venueId: TENANT,
    status: CLUB_STATUSES.ACTIVE,
    governance: {
      presidentUserId: PRESIDENT_ID,
      ownerUserId: PRESIDENT_ID,
      vicePresidentUserIds: [],
    },
  });
}

function seedClub() {
  saveClubs([makeClub()]);
  const players = normalizePlayers([
    { id: "player-president", name: "President", authUserId: PRESIDENT_ID, status: "active", active: true },
    { id: "player-member", name: "Member", authUserId: MEMBER_ID, status: "active", active: true },
  ]);
  saveClubData(CLUB_ID, { players, tenantId: TENANT });
  for (const player of players) {
    addMemberToClub(CLUB_ID, player.id, TENANT, { skipPermissionGuard: true });
  }
}

describe("club activity schedule", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    seedClub();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("president can create weekly session", async () => {
    const president = {
      id: PRESIDENT_ID,
      role: ROLES.CLUB_MANAGER,
      clubId: CLUB_ID,
      tenantId: TENANT,
    };
    saveAuthSession(president);

    const club = makeClub();
    assert.equal(canManageClubActivitySchedule(president, club), true);

    const created = await createClubActivitySession(
      CLUB_ID,
      TENANT,
      { dayOfWeek: 3, startTime: "18:00", endTime: "21:00", note: "Sinh hoạt" },
      { user: president }
    );
    assert.equal(created.ok, true);

    const sessions = listClubActivitySessions(CLUB_ID, TENANT);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].dayOfWeek, 3);

    const ext = loadClubExtension(CLUB_ID);
    assert.equal(ext.activitySessions.length, 1);
  });

  it("member cannot create session", async () => {
    const member = {
      id: MEMBER_ID,
      role: ROLES.PLAYER,
      clubId: CLUB_ID,
      tenantId: TENANT,
    };
    saveAuthSession(member);

    const club = makeClub();
    assert.equal(canManageClubActivitySchedule(member, club), false);

    const created = await createClubActivitySession(
      CLUB_ID,
      TENANT,
      { dayOfWeek: 5, startTime: "18:00", endTime: "21:00" },
      { user: member }
    );
    assert.equal(created.ok, false);
  });

  it("president can delete session", async () => {
    const president = {
      id: PRESIDENT_ID,
      role: ROLES.CLUB_MANAGER,
      clubId: CLUB_ID,
      tenantId: TENANT,
    };
    saveAuthSession(president);

    const created = await createClubActivitySession(
      CLUB_ID,
      TENANT,
      { dayOfWeek: 6, startTime: "18:00", endTime: "21:00" },
      { user: president }
    );
    assert.equal(created.ok, true);

    const deleted = await deleteClubActivitySession(
      CLUB_ID,
      created.session.id,
      TENANT,
      { user: president }
    );
    assert.equal(deleted.ok, true);
    assert.equal(listClubActivitySessions(CLUB_ID, TENANT).length, 0);
  });
});
