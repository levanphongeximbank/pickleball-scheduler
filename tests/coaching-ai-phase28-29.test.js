import test from "node:test";
import assert from "node:assert/strict";

import { CLUB_COACHING_MENU_ROOT } from "../src/config/v5Menu/clubCoachingMenu.js";
import { ADMIN_MENU_ROOT } from "../src/config/v5Menu/adminMenu.js";
import { AI_IN_PAGE_NAV } from "../src/config/v5Menu/aiInPageNav.js";
import { SUPPORT_IN_PAGE_NAV } from "../src/config/v5Menu/supportInPageNav.js";
import { FEATURE_STATUS } from "../src/config/v5Menu/menuBuilders.js";
import {
  deleteCoach,
  getCoachingSummary,
  listCoaches,
  listSchedule,
  loadCoachingStore,
  saveCoach,
  saveScheduleEntry,
} from "../src/features/coaching/index.js";
import { detectScheduleConflicts } from "../src/features/ai-assistant/engines/scheduleConflictDetector.js";
import { detectCourtOverload } from "../src/features/ai-assistant/engines/courtOverloadDetector.js";
import {
  getCourtEngineStoreMode,
  loadCourtEngineStore,
  resolveCourtEngineStore,
} from "../src/features/court-engine/storage/courtEngineStorage.js";
import { createSupabaseCourtEngineStore } from "../src/features/court-engine/storage/SupabaseCourtEngineStore.js";

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

test("Phase 28 — coaching service persists per club", () => {
  global.localStorage = memoryStorage();
  saveCoach("club-a", { name: "HLV A", specialty: "Kỹ thuật" });
  saveCoach("club-b", { name: "HLV B" });

  assert.equal(listCoaches("club-a").length, 1);
  assert.equal(listCoaches("club-b").length, 1);
  assert.equal(listCoaches("club-a")[0].name, "HLV A");

  deleteCoach("club-a", listCoaches("club-a")[0].id);
  assert.equal(listCoaches("club-a").length, 0);

  const summary = getCoachingSummary("club-b");
  assert.equal(summary.coachCount, 1);
});

test("Phase 28 — coaching menu routes are LIVE", () => {
  const coachingPaths = CLUB_COACHING_MENU_ROOT.children
    .filter((item) => item.key.startsWith("coach"))
    .map((item) => item.path);

  assert.deepEqual(coachingPaths, [
    "/coaching/coach-list",
    "/coaching/register",
    "/coaching/coaches",
    "/coaching/students",
    "/coaching/classes",
    "/coaching/schedule",
    "/coaching/packages",
    "/coaching/attendance",
    "/coaching/evaluations",
  ]);

  for (const item of CLUB_COACHING_MENU_ROOT.children.filter((row) => row.key.startsWith("coach"))) {
    assert.equal(item.featureStatus, FEATURE_STATUS.LIVE);
  }
});

test("Phase 29 — schedule conflict detector finds court overlap", () => {
  const result = detectScheduleConflicts({
    date: "2026-07-05",
    bookings: [
      { id: "b1", date: "2026-07-05", courtName: "Sân 1", startTime: "08:00", endTime: "09:00" },
      { id: "b2", date: "2026-07-05", courtName: "Sân 1", startTime: "08:30", endTime: "09:30" },
    ],
  });

  assert.ok(result.data.issues.length >= 1);
  assert.equal(result.data.issues[0].type, "schedule_conflict");
});

test("Phase 29 — court overload detector flags peak utilization", () => {
  const result = detectCourtOverload({
    date: "2026-07-05",
    courtCount: 2,
    bookings: [
      { date: "2026-07-05", startTime: "08:00", endTime: "10:00" },
      { date: "2026-07-05", startTime: "08:00", endTime: "10:00" },
      { date: "2026-07-05", startTime: "08:30", endTime: "09:30" },
    ],
  });

  assert.ok(result.data.peakConcurrent >= 3);
  assert.ok(result.data.issues.some((issue) => issue.type === "court_overload"));
});

test("Phase 29 — admin and support nav items LIVE", () => {
  const adminHours = ADMIN_MENU_ROOT.children.find((item) => item.key === "admin-hours");
  const adminStaff = ADMIN_MENU_ROOT.children.find((item) => item.key === "admin-staff");
  assert.equal(adminHours.path, "/admin/hours");
  assert.equal(adminStaff.path, "/admin/staff");
  assert.equal(adminHours.featureStatus, FEATURE_STATUS.LIVE);
  assert.equal(adminStaff.featureStatus, FEATURE_STATUS.LIVE);

  const guide = SUPPORT_IN_PAGE_NAV.sections[0].items.find((item) => item.key === "support-guide");
  const faq = SUPPORT_IN_PAGE_NAV.sections[0].items.find((item) => item.key === "support-faq");
  assert.equal(guide.featureStatus, FEATURE_STATUS.LIVE);
  assert.equal(faq.featureStatus, FEATURE_STATUS.LIVE);
  assert.equal(guide.path, "/support?tab=guide");
  assert.equal(faq.path, "/support?tab=faq");

  const scheduleAlert = AI_IN_PAGE_NAV.sections[1].items.find((item) => item.key === "ai-schedule-conflict");
  const overloadAlert = AI_IN_PAGE_NAV.sections[1].items.find((item) => item.key === "ai-court-overload");
  assert.equal(scheduleAlert.featureStatus, FEATURE_STATUS.LIVE);
  assert.equal(overloadAlert.featureStatus, FEATURE_STATUS.LIVE);
});

test("Phase 29 — coaching schedule feeds conflict detector", () => {
  global.localStorage = memoryStorage();
  saveScheduleEntry("club-x", {
    date: "2026-07-06",
    startTime: "07:00",
    endTime: "08:00",
    courtName: "Sân A",
    coachName: "Coach 1",
  });
  const schedule = listSchedule("club-x");
  const result = detectScheduleConflicts({
    date: "2026-07-06",
    coachingSchedule: schedule,
    bookings: [
      { id: "bk1", date: "2026-07-06", courtName: "Sân A", startTime: "07:30", endTime: "08:30" },
    ],
  });
  assert.ok(result.data.issues.length >= 1);
});

test("Phase 30 — court engine store factory defaults to local", () => {
  global.localStorage = memoryStorage();
  const store = resolveCourtEngineStore(null, { tenantId: "venue-1" });
  assert.equal(store.mode, "local");
  assert.equal(getCourtEngineStoreMode(), "local");

  store.saveCourtEngineStore("club-ce", { sessions: [] });
  const loaded = loadCourtEngineStore("club-ce", { tenantId: "venue-1" });
  assert.equal(loaded.sessions.length, 0);
});

test("Phase 30 — supabase court engine store exposes cloud interface", () => {
  global.localStorage = memoryStorage();
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_COURT_ENGINE_STORE = "local";
    import.meta.env.VITE_SUPABASE_URL = "";
  }
  const stub = createSupabaseCourtEngineStore(null, { tenantId: "venue-2" });
  assert.equal(stub.mode, "supabase");
  assert.equal(typeof stub.loadCourtEngineStore, "function");
  assert.equal(typeof stub.saveCourtEngineStore, "function");
  assert.equal(typeof stub.syncToCloud, "function");
  assert.equal(typeof stub.hydrate, "function");

  stub.saveCourtEngineStore("club-stub", { sessions: [] });
  const loaded = stub.loadCourtEngineStore("club-stub");
  assert.equal(loaded.clubId, "club-stub");
});
