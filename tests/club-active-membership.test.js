import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  canShowCreateClub,
  canShowLeaveClub,
  hasClubFromProfileFields,
  stripLegacyProfileClubFields,
} from "../src/features/club/services/clubActiveMembershipService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("orphan profile.club_id must not imply hasClub SoT helper", () => {
  const orphan = {
    id: "4cf24ed0-99f8-4997-b803-3c7ff8e32014",
    role: "PLAYER",
    clubId: "clb-accc-1783635462598",
    club_id: "clb-accc-1783635462598",
  };
  // Legacy helper still sees field — but V2 UI must not use this for hasClub
  assert.equal(hasClubFromProfileFields(orphan), true);
  const stripped = stripLegacyProfileClubFields(orphan);
  assert.equal(hasClubFromProfileFields(stripped), false);
  assert.equal(stripped.clubId, null);
});

test("V2 strip clears club scope but keeps athlete player_id", () => {
  const captain = {
    id: "user-1",
    role: "PLAYER",
    clubId: "club-old",
    playerId: "player-staging-a-1",
  };
  const stripped = stripLegacyProfileClubFields(captain);
  assert.equal(stripped.clubId, null);
  assert.equal(stripped.playerId, "player-staging-a-1");
});

test("PLAYER with club.create and no active membership → show create club", () => {
  assert.equal(
    canShowCreateClub({
      user: { role: "PLAYER" },
      hasActiveMembership: false,
      hasClubCreatePermission: true,
    }),
    true
  );
  assert.equal(
    canShowCreateClub({
      user: { role: "PLAYER" },
      hasActiveMembership: true,
      hasClubCreatePermission: true,
    }),
    false
  );
});

test("no active membership → hide leave club", () => {
  assert.equal(canShowLeaveClub(false), false);
  assert.equal(canShowLeaveClub(true), true);
});

test("MyClubPage uses membership resolver not profiles.club_id", () => {
  const page = readSrc("src/pages/player/MyClubPage.jsx");
  assert.match(page, /resolveMyActiveClubMembership/);
  assert.match(page, /hasActiveMembership/);
  assert.doesNotMatch(page, /const clubId = user\?\.clubId \|\| user\?\.club_id/);
});

test("authStorage V2 strips legacy club link fields", () => {
  const src = readSrc("src/auth/authStorage.js");
  assert.match(src, /isClubStorageV2Enabled/);
  assert.match(src, /stripLegacyProfileClubFields/);
  assert.match(src, /clearAthleteClubLink/);
});

test("Phase 42H SQL clears profile links on leave", () => {
  const sql = readSrc("docs/v5/PHASE_42H_ORPHAN_PROFILE_LINKS.sql");
  assert.match(sql, /phase42_clear_profile_club_links/);
  assert.match(sql, /club_get_my_active_membership/);
  assert.match(sql, /club_leave_membership/);
  assert.match(sql, /cleared_profile_club_links/);
});

test("Phase 42E reset clears profile club_id", () => {
  const sql = readSrc("docs/v5/PHASE_42E_RESET.sql");
  assert.match(sql, /club_id = null/);
  assert.match(sql, /player_id = null/);
});
