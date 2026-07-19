import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../../src/data/club.js";
import { saveCourtsForClub } from "../../src/domain/clubStorage.js";
import { normalizeCourt } from "../../src/models/court.js";
import { listCourts } from "../../src/features/venue-court/index.js";
import { API_ERROR_CODES } from "../../src/features/api/constants/apiErrors.js";
import {
  handleCourtsList,
  resolveCourtsHandlerClubId,
  __resetCourtsHandlerDepsForTests,
  __setCourtsHandlerDepsForTests,
} from "../../src/features/api/router/handlers/courtsHandler.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const handlerPath = path.join(root, "src/features/api/router/handlers/courtsHandler.js");

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
  setActiveClubId(DEFAULT_CLUB.id);
  __resetCourtsHandlerDepsForTests();

  saveClubs([
    { id: "club-a", name: "CLB A", venueId: "venue-a" },
    { id: "club-b", name: "CLB B", venueId: "venue-b" },
  ]);

  saveCourtsForClub(
    [
      normalizeCourt({
        id: "c1",
        name: "Sân A1",
        number: 1,
        active: true,
        status: "active",
        tenantId: "venue-a",
        defaultHourlyRate: 100,
      }),
      normalizeCourt({
        id: "c-inactive",
        name: "Sân A2",
        number: 2,
        active: false,
        status: "locked",
        tenantId: "venue-a",
      }),
    ],
    "club-a"
  );

  saveCourtsForClub(
    [
      normalizeCourt({
        id: "c2",
        name: "Sân B1",
        number: 1,
        active: true,
        tenantId: "venue-a",
      }),
    ],
    "club-b"
  );
});

afterEach(() => {
  __resetCourtsHandlerDepsForTests();
  delete globalThis.localStorage;
});

test("handler source has no AI/storage and does not import resolveScopedClubId", () => {
  const source = readFileSync(handlerPath, "utf8");
  assert.doesNotMatch(source, /loadAIData/);
  assert.doesNotMatch(source, /from ["'].*ai\//);
  assert.doesNotMatch(source, /court-engine|competition-core|tournament-engine/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|pickleball-/);
  assert.doesNotMatch(source, /clubStorage/);
  assert.doesNotMatch(source, /import\s*\{[^}]*resolveScopedClubId/);
  assert.doesNotMatch(source, /deps\.resolveScopedClubId|resolveScopedClubId\s*\(/);
  assert.match(source, /venue-court/);
  assert.match(source, /listCourts/);
  assert.match(source, /resolveCourtsHandlerClubId/);
});

test("explicit authorized clubId returns that club's courts", async () => {
  let calledWith = null;
  __setCourtsHandlerDepsForTests({
    async hydrateApiClubScope() {},
    assertClubInScope(clubId) {
      return clubId;
    },
    resolveAllowedClubIds() {
      return new Set(["club-a", "club-b"]);
    },
    listCourts(options) {
      calledWith = options;
      return listCourts(options);
    },
  });

  const result = await handleCourtsList({
    auth: { tenantId: "venue-a" },
    query: { clubId: "club-a" },
  });

  assert.deepEqual(calledWith, {
    clubId: "club-a",
    tenantId: "venue-a",
    includeInactive: true,
  });
  assert.equal(result.clubId, "club-a");
  assert.ok(result.items.every((item) => item.id === "c1" || item.id === "c-inactive"));
  assert.equal(result.items.some((item) => item.id === "c2"), false);
  assert.deepEqual(Object.keys(result.items[0]).sort(), ["active", "id", "name", "number"]);
});

test("explicit unauthorized clubId returns 403", async () => {
  __setCourtsHandlerDepsForTests({
    async hydrateApiClubScope() {},
    assertClubInScope() {
      throw Object.assign(new Error("CLB ngoài phạm vi cho phép."), {
        statusCode: 403,
        code: API_ERROR_CODES.CLUB_OUT_OF_SCOPE,
      });
    },
  });

  await assert.rejects(
    () => handleCourtsList({ auth: { tenantId: "venue-a" }, query: { clubId: "foreign" } }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, API_ERROR_CODES.CLUB_OUT_OF_SCOPE);
      return true;
    }
  );
});

test("missing clubId with exactly one allowed club uses that club", async () => {
  let calledWith = null;
  __setCourtsHandlerDepsForTests({
    async hydrateApiClubScope() {},
    resolveAllowedClubIds() {
      return new Set(["club-a"]);
    },
    listCourts(options) {
      calledWith = options;
      return [{ id: "c1", name: "Sân A1", number: 1, active: true }];
    },
  });

  const result = await handleCourtsList({
    auth: { tenantId: "venue-a" },
    query: {},
  });

  assert.equal(calledWith.clubId, "club-a");
  assert.equal(result.clubId, "club-a");
  assert.equal(result.total, 1);
});

test("missing clubId with multiple allowed clubs does not select the first", () => {
  const order = [];
  __setCourtsHandlerDepsForTests({
    resolveAllowedClubIds() {
      const set = new Set();
      set.add("club-first");
      set.add("club-second");
      return set;
    },
    assertClubInScope() {
      throw new Error("should not assert without query clubId");
    },
  });

  assert.throws(
    () => resolveCourtsHandlerClubId({ auth: { tenantId: "venue-a" }, query: {} }),
    (error) => {
      order.push("threw");
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, API_ERROR_CODES.CLUB_REQUIRED);
      assert.match(error.message, /clubId/i);
      return true;
    }
  );
  assert.deepEqual(order, ["threw"]);
});

test("missing clubId with multiple allowed clubs returns 400 CLUB_REQUIRED", async () => {
  __setCourtsHandlerDepsForTests({
    async hydrateApiClubScope() {},
    resolveAllowedClubIds() {
      return new Set(["club-a", "club-b"]);
    },
    listCourts() {
      throw new Error("listCourts must not run");
    },
  });

  await assert.rejects(
    () => handleCourtsList({ auth: { tenantId: "venue-a" }, query: {} }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, API_ERROR_CODES.CLUB_REQUIRED);
      return true;
    }
  );
});

test("zero allowed clubs returns secure empty list", async () => {
  let listCalled = false;
  __setCourtsHandlerDepsForTests({
    async hydrateApiClubScope() {},
    resolveAllowedClubIds() {
      return new Set();
    },
    listCourts() {
      listCalled = true;
      return [];
    },
  });

  const result = await handleCourtsList({ auth: { tenantId: "venue-a" }, query: {} });
  assert.deepEqual(result, { items: [], total: 0 });
  assert.equal(listCalled, false);
});

test("courts from another allowed club are not mixed into the response", async () => {
  __setCourtsHandlerDepsForTests({
    async hydrateApiClubScope() {},
    assertClubInScope(clubId) {
      return clubId;
    },
    resolveAllowedClubIds() {
      return new Set(["club-a", "club-b"]);
    },
    listCourts,
  });

  // Re-stamp club-b courts under same tenant for inventory gate
  saveClubs([
    { id: "club-a", name: "CLB A", venueId: "venue-a" },
    { id: "club-b", name: "CLB B", venueId: "venue-a" },
  ]);
  saveCourtsForClub(
    [normalizeCourt({ id: "c2", name: "Sân B1", number: 1, active: true, tenantId: "venue-a" })],
    "club-b"
  );

  const result = await handleCourtsList({
    auth: { tenantId: "venue-a" },
    query: { clubId: "club-a" },
  });

  assert.equal(result.clubId, "club-a");
  assert.ok(result.items.every((item) => item.id.startsWith("c1") || item.id === "c-inactive"));
  assert.equal(result.items.some((item) => item.id === "c2"), false);
});

test("empty valid scoped inventory returns successful empty list", async () => {
  saveCourtsForClub([], "club-a");
  __setCourtsHandlerDepsForTests({
    async hydrateApiClubScope() {},
    resolveAllowedClubIds() {
      return new Set(["club-a"]);
    },
    listCourts,
  });

  const result = await handleCourtsList({
    auth: { tenantId: "venue-a" },
    query: {},
  });

  assert.deepEqual(result, { items: [], total: 0, clubId: "club-a" });
});

test("data loading failure remains a server error", async () => {
  __setCourtsHandlerDepsForTests({
    async hydrateApiClubScope() {},
    resolveAllowedClubIds() {
      return new Set(["club-a"]);
    },
    listCourts() {
      throw new Error("Failed to load court inventory");
    },
  });

  await assert.rejects(
    () => handleCourtsList({ auth: { tenantId: "venue-a" }, query: {} }),
    (error) => {
      assert.match(error.message, /Failed to load/);
      assert.equal(error.statusCode, 500);
      return true;
    }
  );
});

test("successful response shape is unchanged", async () => {
  __setCourtsHandlerDepsForTests({
    async hydrateApiClubScope() {},
    resolveAllowedClubIds() {
      return new Set(["club-a"]);
    },
    listCourts() {
      return [
        {
          id: "c1",
          name: "Sân A1",
          number: 1,
          active: true,
          status: "active",
          defaultHourlyRate: 100,
        },
      ];
    },
  });

  const result = await handleCourtsList({ auth: { tenantId: "venue-a" }, query: {} });
  assert.deepEqual(result, {
    items: [{ id: "c1", name: "Sân A1", number: 1, active: true }],
    total: 1,
    clubId: "club-a",
  });
});
