/**
 * PUBLIC WAVE 1 — Slice 1A integrity foundation tests.
 * Nav/footer rewires, TournamentCard ID-safe CTA, LIVE amenities truth, #23 guest gate.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveCanonicalPublicTournamentId,
  resolvePublicTournamentCardHref,
  PUBLIC_TOURNAMENT_DISCOVERY_PATH,
} from "../src/components/public/cards/resolvePublicTournamentCardHref.js";
import { individualPublicTournamentPath } from "../src/config/tournamentRoutes.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

test("Slice 1A: PublicHeader desktop/mobile Giải đấu → /public/tournaments", () => {
  const header = readSrc("src/components/public/PublicHeader.jsx");
  assert.ok(header.includes('path: "/public/tournaments"'));
  assert.equal(header.includes('path: "/tournaments"'), false);
  assert.ok(header.includes("NAV_ITEMS.map"));
  assert.ok(header.includes("Drawer"));
});

test("Slice 1A: PublicHeader does not leak alignItems / PaperProps to DOM (MUI v9)", () => {
  const header = readSrc("src/components/public/PublicHeader.jsx");
  // Stack no longer accepts alignItems as a top-level prop — must live in sx.
  assert.equal(/\balignItems=/.test(header), false);
  assert.ok(header.includes('alignItems: "center"'));
  // Drawer PaperProps removed in MUI v9 — use sx .MuiDrawer-paper (repo pattern).
  assert.equal(header.includes("PaperProps"), false);
  assert.ok(header.includes('"& .MuiDrawer-paper"') || header.includes("'& .MuiDrawer-paper'"));
  // Register CTA guest target unchanged.
  assert.ok(header.includes('to={isAuthenticated ? "/tournament/create" : "/login"}'));
  assert.ok(header.includes("Đăng ký miễn phí"));
});

test("Slice 1A: PublicFooter Ban tổ chức giải → /login", () => {
  const footer = readSrc("src/components/public/PublicFooter.jsx");
  assert.ok(footer.includes('label: "Ban tổ chức giải", path: "/login"'));
  assert.equal(footer.includes('label: "Ban tổ chức giải", path: "/tournaments"'), false);
});

test("Slice 1A: TournamentCard uses ID-safe public href helper", () => {
  const card = readSrc("src/components/public/cards/TournamentCard.jsx");
  assert.ok(card.includes("resolvePublicTournamentCardHref"));
  assert.equal(card.includes("`/tournaments/${"), false);
  assert.equal(card.includes('"/tournaments"'), false);
});

test("Slice 1A: proven canonical ID → /tournament/:id/public", () => {
  const id = "952a6c15-a3c1-4cd4-9dee-6720bcf5e073";
  assert.equal(
    resolvePublicTournamentCardHref({ canonicalTournamentId: id }),
    individualPublicTournamentPath(id)
  );
  assert.equal(
    resolvePublicTournamentCardHref({ tournamentId: id }),
    individualPublicTournamentPath(id)
  );
  assert.equal(resolveCanonicalPublicTournamentId({ id: "t1" }), null);
});

test("Slice 1A: opaque portal card id does not fabricate detail URL", () => {
  assert.equal(
    resolvePublicTournamentCardHref({ id: "t1", name: "Mock" }),
    PUBLIC_TOURNAMENT_DISCOVERY_PATH
  );
  assert.equal(
    resolvePublicTournamentCardHref({ id: "pc02-synthetic-1" }),
    PUBLIC_TOURNAMENT_DISCOVERY_PATH
  );
  assert.equal(resolvePublicTournamentCardHref(null), PUBLIC_TOURNAMENT_DISCOVERY_PATH);
  assert.equal(resolvePublicTournamentCardHref({}), PUBLIC_TOURNAMENT_DISCOVERY_PATH);
});

test("Slice 1A: catalog mapper does not claim canonicalTournamentId", () => {
  const source = readSrc(
    "src/features/public-portal/services/publicTournamentsRankingsDataSource.js"
  );
  assert.ok(source.includes("canonicalTournamentId: null"));
  assert.ok(source.includes("canonicalTournamentId: realId || null"));
  assert.ok(source.includes("opaque projection PK"));
});

test("Slice 1A: mapLiveCourts does not invent amenities", () => {
  const source = readSrc("src/features/public-portal/services/publicClubsCourtsDataSource.js");
  assert.equal(source.includes('"Đèn LED"'), false);
  assert.equal(source.includes('"Sân chuẩn"'), false);
  assert.ok(source.includes("amenities: []"));
});

test("Slice 1A: #23 guest gate fail-closed (no infinite activeClub wait)", () => {
  const page = readSrc(
    "src/features/tournament/experience-a1/pages/IndividualPublicExperiencePage.jsx"
  );
  assert.ok(page.includes("clubScopeStatus"));
  assert.ok(page.includes("Thông tin giải đấu hiện chưa khả dụng công khai."));
  assert.ok(page.includes('clubScopeStatus === "loading"'));
  assert.ok(page.includes("if (!clubScopeReady)"));
  // Former hang: waiting on !clubScopeReady || tournamentLoading together.
  assert.equal(page.includes("!clubScopeReady || tournamentLoading"), false);
});

test("Slice 1A: legacy public page kept; #23 header freeze marker preserved", () => {
  const legacy = readSrc("src/pages/tournament/IndividualTournamentPublicPage.jsx");
  assert.ok(legacy.length > 0);
  const page = readSrc(
    "src/features/tournament/experience-a1/pages/IndividualPublicExperiencePage.jsx"
  );
  assert.ok(page.includes('data-testid="public-site-header"'));
});
