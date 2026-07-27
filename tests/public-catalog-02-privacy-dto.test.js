/**
 * PUBLIC-CATALOG-02 — Privacy / DTO allowlist locks.
 * Run: node --test tests/public-catalog-02-privacy-dto.test.js
 */
import assert from "node:assert/strict";
import test from "node:test";

import * as catalog from "../src/features/public-catalog/index.js";

test("DTO: tournament allowlist is exact and frozen", () => {
  assert.deepEqual([...catalog.PUBLIC_TOURNAMENT_DTO_KEYS], [
    "id",
    "displayName",
    "slug",
    "sport",
    "publicationState",
    "operationalStatus",
    "startDate",
    "endDate",
    "locationSummary",
    "formatSummary",
    "categorySummary",
    "imageUrl",
    "updatedAt",
  ]);
  assert.throws(() => catalog.PUBLIC_TOURNAMENT_DTO_KEYS.push("note"));
});

test("DTO: ranking allowlist is exact and frozen", () => {
  assert.deepEqual([...catalog.PUBLIC_RANKING_DTO_KEYS], [
    "id",
    "displayName",
    "clubName",
    "region",
    "category",
    "gender",
    "rank",
    "totalPoints",
    "tournamentsCount",
    "bestPlacement",
    "publicationState",
    "updatedAt",
  ]);
  assert.throws(() => catalog.PUBLIC_RANKING_DTO_KEYS.push("phone"));
});

test("DTO: projector strips extra keys even if present on source row", () => {
  const tournament = catalog.projectPublicTournament({
    id: "t1",
    display_name: "Public Cup",
    publication_state: "published",
    operational_status: "upcoming",
    note: "internal",
    seeding: { secret: true },
    financial: { fee: 100 },
  });
  assert.equal(tournament.note, undefined);
  assert.equal(tournament.seeding, undefined);
  assert.equal(tournament.financial, undefined);

  const ranking = catalog.projectPublicRanking({
    id: "r1",
    display_name: "Public Name",
    category: "men_single",
    rank: 1,
    publication_state: "published",
    phone: "x",
    email: "y",
    tenantId: "tenant-1",
    writer: "engine",
  });
  assert.equal(ranking.phone, undefined);
  assert.equal(ranking.email, undefined);
  assert.equal(ranking.tenantId, undefined);
  assert.equal(ranking.writer, undefined);
});

test("DTO: Clubs/Courts allowlists unchanged by PC-02", () => {
  assert.ok(catalog.PUBLIC_CLUB_DTO_KEYS.includes("displayName"));
  assert.ok(catalog.PUBLIC_COURT_DTO_KEYS.includes("displayName"));
  assert.equal(catalog.PUBLIC_CLUB_DTO_KEYS.includes("phone"), false);
  assert.equal(catalog.PUBLIC_COURT_DTO_KEYS.includes("defaultHourlyRate"), false);
});
