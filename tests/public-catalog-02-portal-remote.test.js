/**
 * PUBLIC-CATALOG-02 — Portal remote adapter LIVE/EMPTY/ERROR + no mock fallback.
 * Run: node --test tests/public-catalog-02-portal-remote.test.js
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ok, fail } from "../src/core/platform/contracts/result.js";
import { PUBLIC_PORTAL_DATA_SOURCE } from "../src/features/experience-channels/public-portal/constants/dataSources.js";
import { PUBLIC_DATA_RESULT_STATUS } from "../src/features/experience-channels/public-portal/data-source/index.js";
import {
  PUBLIC_TOURNAMENTS_RANKINGS_SOURCE,
  resolvePublicTournamentsRankingsSource,
  loadPublicTournamentsPageResult,
  loadPublicRankingsPageResult,
  loadPublicTournamentsFromRemote,
  loadPublicRankingsFromRemote,
  mapCatalogTournamentDtoToPortalCard,
  mapCatalogRankingDtoToPortalCard,
  getPublicTournamentsResult,
  getPublicRankingsResult,
} from "../src/features/public-portal/services/publicTournamentsRankingsDataSource.js";
import {
  PUBLIC_CLUBS_COURTS_SOURCE,
  resolvePublicClubsCourtsSource,
} from "../src/features/public-portal/services/publicClubsCourtsDataSource.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function createFacade(tournamentsResult, rankingsResult) {
  return {
    listPublicTournaments: async () => tournamentsResult,
    listPublicRankings: async () => rankingsResult,
  };
}

test("PC-02 portal: default source is local; Clubs/Courts selector unchanged", () => {
  const prevTr = process.env.VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE;
  const prevCc = process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
  delete process.env.VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE;
  delete process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
  try {
    assert.equal(
      resolvePublicTournamentsRankingsSource(),
      PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.LOCAL
    );
    assert.equal(
      resolvePublicClubsCourtsSource(),
      PUBLIC_CLUBS_COURTS_SOURCE.LOCAL
    );
    assert.equal(
      resolvePublicTournamentsRankingsSource({ source: "remote" }),
      "remote"
    );
  } finally {
    if (prevTr == null) delete process.env.VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE;
    else process.env.VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE = prevTr;
    if (prevCc == null) delete process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
    else process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE = prevCc;
  }
});

test("PC-02 portal: remote empty is LIVE EMPTY without mock", async () => {
  const emptyFacade = createFacade(
    ok({
      items: [],
      pagination: { limit: 20, offset: 0, total: 0, sort: "name_asc" },
      provenance: "LIVE",
    }),
    ok({
      items: [],
      pagination: {
        limit: 20,
        offset: 0,
        total: 0,
        sort: "rank_asc",
        category: null,
      },
      provenance: "LIVE",
    })
  );

  const tournaments = await loadPublicTournamentsFromRemote({
    facade: emptyFacade,
  });
  const rankings = await loadPublicRankingsFromRemote({ facade: emptyFacade });

  assert.equal(tournaments.source, PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.equal(tournaments.status, PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.deepEqual(tournaments.data, []);
  assert.equal(tournaments.fallbackUsed, false);
  assert.equal(tournaments.productionReady, false);

  assert.equal(rankings.source, PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.equal(rankings.status, PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.deepEqual(rankings.data, []);
  assert.equal(rankings.fallbackUsed, false);
});

test("PC-02 portal: remote error is ERROR without mock fallback", async () => {
  const errFacade = createFacade(
    fail({ code: "PUBLIC_CATALOG_RPC_FAILED", message: "rpc boom", details: {} }),
    fail({ code: "PUBLIC_CATALOG_RPC_FAILED", message: "rpc boom", details: {} })
  );

  const tournaments = await loadPublicTournamentsFromRemote({
    facade: errFacade,
  });
  const rankings = await loadPublicRankingsFromRemote({ facade: errFacade });

  assert.equal(tournaments.status, PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.equal(tournaments.source, PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.equal(tournaments.fallbackUsed, false);
  assert.deepEqual(tournaments.data, []);
  assert.equal(tournaments.error?.code, "PUBLIC_CATALOG_RPC_FAILED");

  assert.equal(rankings.status, PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.equal(rankings.fallbackUsed, false);
  assert.deepEqual(rankings.data, []);
});

test("PC-02 portal: remote positive path maps DTO to portal cards", async () => {
  const facade = createFacade(
    ok({
      items: [
        {
          id: "t-1",
          displayName: "Public Cup",
          slug: "public-cup",
          sport: "pickleball",
          publicationState: "published",
          operationalStatus: "live",
          startDate: "2026-07-20",
          endDate: null,
          locationSummary: "HCM",
          formatSummary: "Open",
          categorySummary: "MD",
          imageUrl: null,
          updatedAt: null,
        },
      ],
      pagination: { limit: 20, offset: 0, total: 1, sort: "name_asc" },
      provenance: "LIVE",
    }),
    ok({
      items: [
        {
          id: "r-1",
          displayName: "Athlete One",
          clubName: "Club A",
          region: "HCM",
          category: "men_single",
          gender: "male",
          rank: 1,
          totalPoints: 1000,
          tournamentsCount: 3,
          bestPlacement: "Champion",
          publicationState: "published",
          updatedAt: null,
        },
      ],
      pagination: {
        limit: 20,
        offset: 0,
        total: 1,
        sort: "rank_asc",
        category: null,
      },
      provenance: "LIVE",
    })
  );

  const tournaments = await loadPublicTournamentsPageResult({
    source: "remote",
    facade,
  });
  const rankings = await loadPublicRankingsPageResult({
    source: "remote",
    facade,
  });

  assert.equal(tournaments.status, PUBLIC_DATA_RESULT_STATUS.SUCCESS);
  assert.equal(tournaments.data[0].name, "Public Cup");
  assert.equal(tournaments.data[0].status, "live");
  assert.equal(tournaments.fallbackUsed, false);

  assert.equal(rankings.status, PUBLIC_DATA_RESULT_STATUS.SUCCESS);
  assert.equal(rankings.data[0].name, "Athlete One");
  assert.equal(rankings.data[0].rank, 1);
  assert.equal(rankings.data[0].points, 1000);
  assert.equal(rankings.fallbackUsed, false);
});

test("PC-02 portal: mappers do not invent private fields", () => {
  const t = mapCatalogTournamentDtoToPortalCard({
    id: "t1",
    displayName: "Cup",
    operationalStatus: "upcoming",
    locationSummary: "HN",
    startDate: "2026-08-01",
    formatSummary: "RR",
    note: "secret",
  });
  assert.equal(t.note, undefined);
  assert.equal(t.name, "Cup");

  const r = mapCatalogRankingDtoToPortalCard({
    id: "r1",
    displayName: "Name",
    rank: 3,
    totalPoints: 10,
    phone: "x",
  });
  assert.equal(r.phone, undefined);
  assert.equal(r.vprAthleteId, null);
  assert.equal(r.change, 0);
});

test("PC-02 portal: local path retained; remote path has no mock fallback", () => {
  const adapter = readFileSync(
    path.join(
      ROOT,
      "src/features/public-portal/services/publicTournamentsRankingsDataSource.js"
    ),
    "utf8"
  );
  assert.match(adapter, /VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE/);
  assert.match(adapter, /listPublicTournamentsRemote/);
  assert.match(adapter, /listPublicRankingsRemote/);
  assert.match(adapter, /allowMockFallback:\s*true/);
  assert.match(adapter, /PUBLIC_TOURNAMENTS_RANKINGS_SOURCE\.LOCAL/);
  assert.doesNotMatch(
    adapter,
    /loadPublicTournamentsFromRemote[\s\S]{0,400}allowMockFallback:\s*true/
  );
  assert.doesNotMatch(adapter, /service_role|eyJ[A-Za-z0-9_-]{20,}/);

  const localT = getPublicTournamentsResult();
  assert.ok(localT);
  const localR = getPublicRankingsResult();
  assert.ok(localR);
});
