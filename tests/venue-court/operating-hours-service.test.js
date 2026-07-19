import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../../src/data/club.js";
import { getDefaultClubData, saveClubData } from "../../src/domain/clubStorage.js";
import {
  loadCourtManagementSettings,
  saveCourtManagementSettings,
} from "../../src/domain/courtManagementSettings.js";
import {
  getVenueOperatingHours,
  updateVenueOperatingHours,
  shouldWarnLegacyImport,
  LEGACY_VENUE_HOURS_STORAGE_KEY,
  LEGACY_IMPORT_REASON,
  LEGACY_REQUIRED_DAY_IDS,
  __resetVenueOperatingHoursDepsForTests,
  __setVenueOperatingHoursDepsForTests,
} from "../../src/features/venue-court/services/venueOperatingHoursService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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

function buildSevenDayLegacy(openTime, closeTime) {
  return LEGACY_REQUIRED_DAY_IDS.map((dayOfWeek) => ({
    id: `hours-${dayOfWeek}`,
    dayOfWeek,
    openTime,
    closeTime,
    label: `Day ${dayOfWeek}`,
  }));
}

function resetClubDefaults() {
  saveClubData("club-a", {
    ...getDefaultClubData("club-a"),
    courtManagement: {
      openHour: 0,
      closeHour: 24,
      slotMinutes: 60,
      peakHourRules: { enabled: true, startHour: 17, endHour: 21, weekdays: [1, 2, 3, 4, 5] },
    },
  });
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  __resetVenueOperatingHoursDepsForTests();
  saveClubs([
    { id: "club-a", name: "CLB A", venueId: "venue-a" },
    { id: "club-b", name: "CLB B", venueId: "venue-b" },
  ]);
  saveClubData("club-a", {
    ...getDefaultClubData("club-a"),
    courtManagement: {
      openHour: 6,
      closeHour: 22,
      slotMinutes: 60,
      peakHourRules: { enabled: true, startHour: 17, endHour: 21, weekdays: [1, 2, 3, 4, 5] },
    },
  });
});

afterEach(() => {
  __resetVenueOperatingHoursDepsForTests();
  delete globalThis.localStorage;
});

test("reads hours from Court Management settings", () => {
  const hours = getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(hours.openHour, "06:00");
  assert.equal(hours.closeHour, "22:00");
  assert.equal(hours.legacyImport.reason, LEGACY_IMPORT_REASON.COURT_MANAGEMENT_ALREADY_CONFIGURED);
});

test("explicit save writes Court Management and preserves unrelated settings", () => {
  const before = loadCourtManagementSettings("club-a");
  const result = updateVenueOperatingHours(
    { openHour: "08:00", closeHour: "20:00" },
    { clubId: "club-a", tenantId: "venue-a" }
  );
  assert.equal(result.ok, true);
  const after = loadCourtManagementSettings("club-a");
  assert.equal(after.openHour, 8);
  assert.equal(after.closeHour, 20);
  assert.equal(after.slotMinutes, before.slotMinutes);
  assert.deepEqual(after.peakHourRules, before.peakHourRules);
  assert.equal(localStorage.getItem(`${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`), null);
});

test("rejects invalid HH:mm and non-zero minutes and overnight", () => {
  assert.equal(
    updateVenueOperatingHours(
      { openHour: "6:00", closeHour: "22:00" },
      { clubId: "club-a", tenantId: "venue-a" }
    ).ok,
    false
  );
  assert.equal(
    updateVenueOperatingHours(
      { openHour: "06:30", closeHour: "22:00" },
      { clubId: "club-a", tenantId: "venue-a" }
    ).ok,
    false
  );
  assert.equal(
    updateVenueOperatingHours(
      { openHour: "22:00", closeHour: "06:00" },
      { clubId: "club-a", tenantId: "venue-a" }
    ).ok,
    false
  );
});

test("identical seven-day legacy hours with minute 00 imports once", () => {
  resetClubDefaults();
  localStorage.setItem(
    `${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`,
    JSON.stringify(buildSevenDayLegacy("05:00", "23:00"))
  );

  const first = getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(first.openHour, "05:00");
  assert.equal(first.closeHour, "23:00");
  assert.equal(first.source, "legacy-import");
  assert.equal(first.legacyImport.status, "imported");

  const settings = loadCourtManagementSettings("club-a");
  assert.equal(settings.openHour, 5);
  assert.equal(settings.closeHour, 23);
  assert.ok(settings.legacyVenueHoursImportedAt);
  assert.deepEqual(settings.peakHourRules.weekdays, [1, 2, 3, 4, 5]);

  const legacyRaw = localStorage.getItem(`${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`);
  assert.match(legacyRaw, /05:00/);

  const second = getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(second.legacyImport.reason, LEGACY_IMPORT_REASON.LEGACY_ALREADY_IMPORTED);
  assert.equal(second.openHour, "05:00");
});

test("different weekday hours do not import", () => {
  resetClubDefaults();
  const rows = buildSevenDayLegacy("06:00", "22:00");
  rows[3].openTime = "07:00";
  localStorage.setItem(`${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`, JSON.stringify(rows));

  const hours = getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(hours.openHour, "00:00");
  assert.equal(hours.closeHour, "24:00");
  assert.equal(hours.legacyImport.status, "not_imported");
  assert.equal(hours.legacyImport.reason, LEGACY_IMPORT_REASON.LEGACY_DAILY_HOURS_DIFFER);
  assert.equal(shouldWarnLegacyImport(hours.legacyImport), true);

  const settings = loadCourtManagementSettings("club-a");
  assert.equal(settings.openHour, 0);
  assert.equal(settings.closeHour, 24);
  assert.equal(settings.legacyVenueHoursImportedAt, undefined);
});

test("legacy minute 30 does not import", () => {
  resetClubDefaults();
  localStorage.setItem(
    `${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`,
    JSON.stringify(buildSevenDayLegacy("06:30", "22:00"))
  );

  const hours = getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(hours.legacyImport.reason, LEGACY_IMPORT_REASON.LEGACY_MINUTE_PRECISION_UNSUPPORTED);
  assert.equal(loadCourtManagementSettings("club-a").openHour, 0);
  assert.equal(loadCourtManagementSettings("club-a").legacyVenueHoursImportedAt, undefined);
});

test("closed weekday does not import", () => {
  resetClubDefaults();
  const rows = buildSevenDayLegacy("06:00", "22:00").filter((row) => row.dayOfWeek !== "0");
  localStorage.setItem(`${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`, JSON.stringify(rows));

  const hours = getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(hours.legacyImport.reason, LEGACY_IMPORT_REASON.LEGACY_CLOSED_DAY_UNSUPPORTED);
  assert.equal(loadCourtManagementSettings("club-a").legacyVenueHoursImportedAt, undefined);
});

test("malformed legacy JSON does not import", () => {
  resetClubDefaults();
  localStorage.setItem(`${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`, "{not-json");

  const hours = getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(hours.legacyImport.reason, LEGACY_IMPORT_REASON.LEGACY_DATA_INVALID);
  assert.equal(loadCourtManagementSettings("club-a").openHour, 0);
  assert.equal(loadCourtManagementSettings("club-a").legacyVenueHoursImportedAt, undefined);
});

test("missing venueId does not import", () => {
  resetClubDefaults();
  localStorage.setItem(
    `${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`,
    JSON.stringify(buildSevenDayLegacy("06:00", "22:00"))
  );

  const hours = getVenueOperatingHours({ clubId: "club-a" });
  assert.equal(hours.legacyImport.reason, LEGACY_IMPORT_REASON.VENUE_SCOPE_MISSING);
  assert.equal(loadCourtManagementSettings("club-a").openHour, 0);
});

test("missing active clubId does not import", () => {
  resetClubDefaults();
  localStorage.setItem(
    `${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`,
    JSON.stringify(buildSevenDayLegacy("06:00", "22:00"))
  );

  const hours = getVenueOperatingHours({ tenantId: "venue-a" });
  assert.equal(hours.legacyImport.reason, LEGACY_IMPORT_REASON.CLUB_SCOPE_MISSING);
});

test("club/venue mismatch does not import", () => {
  resetClubDefaults();
  localStorage.setItem(
    `${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`,
    JSON.stringify(buildSevenDayLegacy("06:00", "22:00"))
  );

  const hours = getVenueOperatingHours({ clubId: "club-b", tenantId: "venue-a" });
  assert.equal(hours.legacyImport.reason, LEGACY_IMPORT_REASON.CLUB_VENUE_MISMATCH);
  assert.equal(loadCourtManagementSettings("club-a").openHour, 0);
});

test("existing non-default Court Management settings take precedence", () => {
  localStorage.setItem(
    `${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`,
    JSON.stringify(buildSevenDayLegacy("05:00", "23:00"))
  );

  const hours = getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(hours.openHour, "06:00");
  assert.equal(hours.closeHour, "22:00");
  assert.equal(hours.legacyImport.reason, LEGACY_IMPORT_REASON.COURT_MANAGEMENT_ALREADY_CONFIGURED);
});

test("import marker prevents repeated import after reset to defaults", () => {
  resetClubDefaults();
  localStorage.setItem(
    `${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`,
    JSON.stringify(buildSevenDayLegacy("05:00", "23:00"))
  );
  getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });

  saveCourtManagementSettings("club-a", {
    openHour: 0,
    closeHour: 24,
    legacyVenueHoursImportedAt: loadCourtManagementSettings("club-a").legacyVenueHoursImportedAt,
  });

  const hours = getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(hours.openHour, "00:00");
  assert.equal(hours.closeHour, "24:00");
  assert.equal(hours.legacyImport.reason, LEGACY_IMPORT_REASON.LEGACY_ALREADY_IMPORTED);
});

test("failed eligibility does not set marker or change CM", () => {
  resetClubDefaults();
  const rows = buildSevenDayLegacy("06:00", "22:00");
  rows[1].closeTime = "21:00";
  localStorage.setItem(`${LEGACY_VENUE_HOURS_STORAGE_KEY}::venue-a`, JSON.stringify(rows));

  getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  const settings = loadCourtManagementSettings("club-a");
  assert.equal(settings.openHour, 0);
  assert.equal(settings.closeHour, 24);
  assert.equal(settings.legacyVenueHoursImportedAt, undefined);
});

test("surfaces load and save errors", () => {
  __setVenueOperatingHoursDepsForTests({
    loadCourtManagementSettings() {
      throw new Error("blob unavailable");
    },
  });
  assert.throws(() => getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" }), /Failed to load/);

  __resetVenueOperatingHoursDepsForTests();
  __setVenueOperatingHoursDepsForTests({
    saveCourtManagementSettings() {
      throw new Error("write denied");
    },
  });
  assert.throws(
    () =>
      updateVenueOperatingHours(
        { openHour: "09:00", closeHour: "18:00" },
        { clubId: "club-a", tenantId: "venue-a" }
      ),
    /Failed to save/
  );
});

test("returned hours object cannot mutate source settings", () => {
  const hours = getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  hours.openHour = "99:00";
  const again = getVenueOperatingHours({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(again.openHour, "06:00");
});

test("VenueHoursPage surfaces compatibility warning and has no direct storage access", () => {
  const pagePath = path.join(root, "src/pages/admin/VenueHoursPage.jsx");
  const source = readFileSync(pagePath, "utf8");
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /sessionStorage/);
  assert.doesNotMatch(source, /pickleball-venue-hours-v1/);
  assert.match(source, /shouldWarnLegacyImport/);
  assert.match(source, /compatWarning/);
  assert.match(source, /severity/);
  assert.match(source, /getVenueOperatingHours/);
  assert.doesNotMatch(source, /import successful|Đã nhập legacy|tự chuyển thành công/i);
});
