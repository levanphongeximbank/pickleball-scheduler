import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MY_CLUB_VIEWS,
  resolveInitialView,
  resolveMemberGovernanceRole,
  resolveOwnerStatContent,
  resolvePresidentDisplayLabel,
  getTodayActivityDayOfWeek,
} from "../src/pages/player/myClub/myClubViewLogic.js";
import { getVicePresidentUserIds } from "../src/features/club/models/clubGovernance.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function makeSearchParams(view) {
  return {
    get: (key) => (key === "view" ? view : null),
  };
}

test("my club view logic — supports members tab", () => {
  assert.ok(MY_CLUB_VIEWS.includes("members"));
  assert.equal(resolveInitialView(true, makeSearchParams("members")), "members");
  assert.equal(resolveInitialView(true, makeSearchParams(null)), "home");
  assert.ok(!MY_CLUB_VIEWS.includes("discover"));
});

test("my club view logic — president display label handles combined owner", () => {
  assert.equal(
    resolvePresidentDisplayLabel({
      presidentLabel: null,
      combinedOwnerPresident: true,
      ownerLabel: "Huỳnh Văn Anh (Chủ sở hữu & Chủ tịch)",
    }),
    "Huỳnh Văn Anh"
  );
  assert.equal(
    resolvePresidentDisplayLabel({ presidentLabel: "Nguyễn Văn A", combinedOwnerPresident: false }),
    "Nguyễn Văn A"
  );
});

test("my club view logic — owner stat content modes", () => {
  const clubWithOwner = { governance: { ownerUserId: "user-1" } };
  const clubWithoutOwner = { governance: { ownerUserId: null } };

  assert.deepEqual(
    resolveOwnerStatContent({
      club: clubWithOwner,
      governanceLabels: { ownerLabel: "Nguyễn Văn A" },
      canAssign: false,
    }),
    { mode: "assigned", label: "Nguyễn Văn A" }
  );

  assert.deepEqual(
    resolveOwnerStatContent({
      club: clubWithoutOwner,
      governanceLabels: { ownerLabel: "Chưa gán" },
      canAssign: true,
    }),
    { mode: "assign" }
  );

  assert.deepEqual(
    resolveOwnerStatContent({
      club: clubWithoutOwner,
      governanceLabels: { ownerLabel: "Chưa gán" },
      canAssign: false,
    }),
    { mode: "unassigned" }
  );
});

test("my club view logic — member governance role badges", () => {
  const governance = {
    ownerUserId: "owner-1",
    presidentUserId: "pres-1",
    vicePresidentUserIds: ["vice-1"],
  };

  assert.equal(
    resolveMemberGovernanceRole("pres-1", governance, getVicePresidentUserIds),
    "Chủ tịch"
  );
  assert.equal(
    resolveMemberGovernanceRole("vice-1", governance, getVicePresidentUserIds),
    "Phó chủ tịch"
  );
  assert.equal(
    resolveMemberGovernanceRole("owner-1", governance, getVicePresidentUserIds),
    "Chủ sở hữu"
  );
});

test("my club view logic — today maps Sunday to day 7", () => {
  assert.equal(getTodayActivityDayOfWeek(new Date("2026-07-12T10:00:00")), 7);
  assert.equal(getTodayActivityDayOfWeek(new Date("2026-07-13T10:00:00")), 1);
});

test("my club ui shell — action bar and members panel exist", () => {
  const actionBar = readSrc("src/pages/player/myClub/MyClubActionBar.jsx");
  const membersPanel = readSrc("src/pages/player/myClub/MyClubMembersPanel.jsx");
  const page = readSrc("src/pages/player/MyClubPage.jsx");

  assert.ok(actionBar.includes("Thành viên"));
  assert.ok(actionBar.includes("Trang chủ"));
  assert.ok(membersPanel.includes("Thành viên CLB"));
  assert.ok(page.includes("MyClubMembersPanel"));
  assert.ok(page.includes('view === "members"'));
});

test("my club ui shell — summary card supports assign owner", () => {
  const summary = readSrc("src/pages/player/myClub/MyClubSummaryCard.jsx");

  assert.ok(summary.includes("Gắn chủ sở hữu"));
  assert.ok(summary.includes("AssignClubOwnerDialog"));
  assert.ok(summary.includes("heroGradientSx"));
});
