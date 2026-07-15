import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ROLES } from "../src/auth/roles.js";
import {
  CLUB_NAV_ITEM_KEYS,
  buildClubNavContext,
  isClubNavItemVisible,
} from "../src/features/club/navigation/clubNavMatrix.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Daily Play preview access + navigation", () => {
  it("registers launcher and setup routes in router", () => {
    const router = readSrc("src/router.jsx");
    assert.match(router, /path="\/daily-play"/);
    assert.match(router, /path="\/tournament\/daily\/:tournamentId"/);
    assert.match(router, /DailyPlayLauncher/);
    assert.match(router, /DailyPlaySetup/);
  });

  it("keeps club menu leaf path /daily-play", () => {
    const menu = readSrc("src/config/v5Menu/clubCoachingMenu.js");
    assert.match(menu, /key:\s*"club-daily-play"/);
    assert.match(menu, /path:\s*"\/daily-play"/);
    assert.match(menu, /Vui chơi mỗi ngày/);
  });

  it("TournamentHome create card includes Daily Play mode", () => {
    const home = readSrc("src/pages/tournament/TournamentHome.jsx");
    assert.match(home, /TOURNAMENT_MODE\.DAILY_PLAY/);
    assert.match(home, /Chơi vui \/ Daily Play/);
    assert.match(home, /\/tournament\/daily\/\$\{result\.tournament\.id\}/);
  });

  it("SUPER_ADMIN without membership can see Daily Play menu item", () => {
    const ctx = buildClubNavContext({
      user: { id: "sa-1", role: ROLES.SUPER_ADMIN, status: "active" },
      membership: {
        hasActiveMembership: false,
        clubId: null,
        club: null,
        phase: "NONE",
      },
      can: () => true,
      tenantId: "tenant-1",
    });
    assert.equal(ctx.isSa, true);
    assert.equal(ctx.saNoMembership, true);
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.DAILY_PLAY, ctx), true);
  });

  it("PLAYER without governance still cannot see Daily Play menu", () => {
    const ctx = buildClubNavContext({
      user: { id: "p1", role: ROLES.PLAYER, status: "active" },
      membership: {
        hasActiveMembership: true,
        clubId: "club-1",
        club: { id: "club-1", name: "Club" },
        phase: "ACTIVE",
      },
      can: () => true,
      tenantId: "tenant-1",
    });
    assert.equal(isClubNavItemVisible(CLUB_NAV_ITEM_KEYS.DAILY_PLAY, ctx), false);
  });

  it("DAILY_PLAY mode constant stays daily_play", () => {
    assert.equal(TOURNAMENT_MODE.DAILY_PLAY, "daily_play");
  });
});
