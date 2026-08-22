import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  EVENT_TYPE,
} from "../src/models/tournament/constants.js";
import {
  resolveA1OpenPath,
  individualOverviewPath,
} from "../src/features/tournament/experience-a1/routes.js";
import {
  resolveTournamentExperienceMode,
  resolveTournamentExperienceAdapter,
  isOfficialTournamentExperience,
  TOURNAMENT_EXPERIENCE_MODE,
} from "../src/features/tournament/experience-a1/experienceModeResolver.js";
import { resolveSelectedEvent } from "../src/features/tournament/experience-a1/deriveOverview.js";
import {
  resolveOfficialCanonicalOpenPath,
  officialLegacySetupPath,
  isOfficialLegacyExperienceRequested,
  mapOfficialLegacyBracketToCanonical,
  mapOfficialLegacyDirectorToCanonical,
  OFFICIAL_LEGACY_ROUTE_ACTIVATION,
  ENGINE_ROUTE_CLASSIFICATION,
  OFFICIAL_EXPERIENCE_AUTHORITY,
  projectOfficialTournamentExperience,
} from "../src/features/tournament/official-tournament-experience/index.js";
import {
  ratingMayInfluenceOpenPairingOrDraw,
  ratingMayInfluencePairing,
  isOpenMode,
  isAiBalanceMode,
} from "../src/features/tournament/official-open-adapter-b/activation.js";
import { getTournamentSetupPath } from "../src/utils/tournamentNavigation.js";
import { tournamentSetupPath } from "../src/config/tournamentRoutes.js";
import { resolveTournamentCreateNavigatePath } from "../src/features/tournament/pages/canonicalTournamentCreateStart.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function officialTournament(overrides = {}) {
  return {
    id: "off-1",
    name: "Official Open Test",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.DRAFT,
    tenantId: "tenant-a",
    clubId: "club-a",
    events: [
      {
        id: "ev-a",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [{ id: "e1", playerIds: ["p1", "p2"] }],
        matches: [{ id: "m1", status: "completed", scoreA: 11, scoreB: 5 }],
        groups: [{ id: "g1" }],
      },
      {
        id: "ev-b",
        name: "Đôi nữ",
        eventType: EVENT_TYPE.WOMEN_DOUBLE,
        entries: [{ id: "e2", playerIds: ["p3", "p4"] }],
        matches: [],
      },
    ],
    courtSchedule: { physicalCourtIds: ["c1", "c2"] },
    settings: {
      registration: { opensAt: "2026-01-01" },
      draw: { status: "ready" },
      schedule: { status: "draft" },
      refereeAssignments: { m1: { canonicalUserId: "ref-1" } },
    },
    ...overrides,
  };
}

describe("wave-o1-official-canonical-experience-adoption", () => {
  it("1-5 Official open helper resolves canonical Overview for all lifecycle statuses", () => {
    for (const status of [
      TOURNAMENT_STATUS.DRAFT,
      TOURNAMENT_STATUS.REGISTRATION,
      TOURNAMENT_STATUS.READY,
      TOURNAMENT_STATUS.ACTIVE,
      TOURNAMENT_STATUS.COMPLETED,
    ]) {
      const tournament = officialTournament({ status });
      const open = resolveOfficialCanonicalOpenPath(tournament);
      assert.equal(open, "/tournament/off-1/overview");
      assert.equal(resolveA1OpenPath(tournament), "/tournament/off-1/overview");
      assert.equal(getTournamentSetupPath(tournament), "/tournament/off-1/overview");
      assert.equal(tournamentSetupPath(tournament), "/tournament/off-1/overview");
      assert.equal(open.includes("/tournament/official/"), false);
    }
  });

  it("6-10 canonical Overview resolves Official mode + real adapter projection + event semantics", () => {
    const tournament = officialTournament();
    assert.equal(resolveTournamentExperienceMode(tournament), TOURNAMENT_EXPERIENCE_MODE.OFFICIAL);
    assert.equal(isOfficialTournamentExperience(tournament), true);
    const adapter = resolveTournamentExperienceAdapter(tournament);
    assert.ok(adapter);
    assert.equal(adapter.kind, "official-tournament-experience-adapter");
    const projection = adapter.projection;
    assert.equal(projection.identity.tournamentId, "off-1");
    assert.equal(projection.identity.mode, TOURNAMENT_MODE.OFFICIAL_TOURNAMENT);
    assert.equal(projection.identity.tenantId, "tenant-a");
    assert.equal(projection.identity.clubId, "club-a");
    assert.equal(projection.events.length, 2);
    assert.equal(projection.selectedEvent, null);
    assert.equal(projection.selectedEventExplicit, false);
    assert.equal(resolveSelectedEvent(tournament.events, ""), null);
    const withSelected = projectOfficialTournamentExperience(tournament, {
      selectedEventId: "ev-b",
    });
    assert.equal(withSelected.selectedEvent.id, "ev-b");
    assert.equal(withSelected.selectedEventExplicit, true);
    assert.equal(withSelected.registrationSummary.entryCount, 2);
    assert.equal(withSelected.matchSummary.completedMatchCount, 1);
    assert.equal(withSelected.courtReadinessSummary.courtCount, 2);
    assert.equal(withSelected.refereeReadinessSummary.authority, "CORE-13");
  });

  it("11-12 Open random and AI Balance pairing authorities unchanged", () => {
    const open = officialTournament({ officialMode: OFFICIAL_MODE.OPEN });
    const ai = officialTournament({ officialMode: OFFICIAL_MODE.AI_BALANCE });
    assert.equal(isOpenMode(open), true);
    assert.equal(ratingMayInfluenceOpenPairingOrDraw(), false);
    assert.equal(isAiBalanceMode(ai), true);
    const openProj = projectOfficialTournamentExperience(open);
    assert.equal(openProj.pairingReadinessSummary.openPairingRatingNeutral, true);
    assert.equal(openProj.pairingReadinessSummary.aiBalancePairing, false);
    const aiProj = projectOfficialTournamentExperience(ai);
    assert.equal(aiProj.pairingReadinessSummary.aiBalancePairing, true);
    assert.equal(typeof ratingMayInfluencePairing(ai), "boolean");
  });

  it("13-17 CORE and court authorities locked / unchanged labels", () => {
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT, "CORE-13");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.MATCH_LIFECYCLE, "CORE-15");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.SCORING, "CORE-16");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_RESULT, "CORE-17");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.COURT, "canonical-court-authority");
    const adapter = resolveTournamentExperienceAdapter(officialTournament());
    assert.equal(adapter.commands.assignReferee, null);
    assert.equal(adapter.commands.scoreMatch, null);
    assert.equal(adapter.commands.authorities.REFEREE_ASSIGNMENT, "CORE-13");
  });

  it("18-19 OfficialTournamentSetup is compatibility-only with no redirect loop", () => {
    assert.equal(OFFICIAL_LEGACY_ROUTE_ACTIVATION.setupRedirectToOverview, true);
    const legacy = officialLegacySetupPath("off-1");
    assert.equal(legacy, "/tournament/official/off-1?experience=legacy");
    assert.equal(isOfficialLegacyExperienceRequested({ get: () => "legacy" }), true);
    assert.equal(isOfficialLegacyExperienceRequested({ get: () => "" }), false);
    const overview = resolveOfficialCanonicalOpenPath("off-1");
    assert.notEqual(overview, legacy);
    assert.equal(overview.includes("experience=legacy"), false);
    const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
    assert.ok(router.includes("OfficialExperienceCompatibilityRoute"));
    assert.equal(router.includes('element={<OfficialTournamentSetup />}'), false);
  });

  it("20-22 Individual Internal / Team / Daily routes unchanged", () => {
    assert.equal(
      resolveA1OpenPath({ id: "i1", mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT }),
      "/tournament/i1/overview"
    );
    assert.equal(
      getTournamentSetupPath({ id: "i1", mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT }),
      "/tournament/internal/i1"
    );
    assert.equal(
      resolveA1OpenPath({ id: "t1", mode: TOURNAMENT_MODE.TEAM_TOURNAMENT }),
      "/tournaments/t1"
    );
    assert.equal(
      resolveA1OpenPath({ id: "d1", mode: TOURNAMENT_MODE.DAILY_PLAY }),
      "/tournament/daily/d1"
    );
    assert.equal(
      resolveTournamentCreateNavigatePath("internal_tournament", "i1", "ev"),
      "/tournament/internal/i1?event=ev"
    );
    assert.equal(
      resolveTournamentCreateNavigatePath("official_tournament", "off-1", "ev"),
      "/tournament/off-1/settings"
    );
    assert.equal(
      resolveTournamentCreateNavigatePath("official_tournament", "off-2"),
      "/tournament/off-2/settings"
    );
  });

  it("23-25 reuses canonical shell / no second design system / no duplicate authority writers", () => {
    const overview = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualOverviewPage.jsx"),
      "utf8"
    );
    assert.ok(overview.includes("TournamentExperienceWorkspace"));
    assert.ok(overview.includes("resolveTournamentExperienceAdapter"));
    assert.ok(overview.includes("officialLegacySetupPath"));
    assert.equal(overview.includes("OfficialTournamentExperienceShell"), false);
    assert.equal(overview.includes("OfficialTournamentTheme"), false);
    assert.equal(overview.includes("OfficialTournamentDesignSystem"), false);
    const adapterSrc = readFileSync(
      path.join(
        root,
        "src/features/tournament/official-tournament-experience/officialTournamentExperienceAdapter.js"
      ),
      "utf8"
    );
    assert.ok(adapterSrc.includes("COMMAND delegation") || adapterSrc.includes("Command surface delegates") || adapterSrc.includes("createOfficialExperienceCommandBoundary"));
    assert.equal(adapterSrc.includes("updateTournamentCommand"), false);
    assert.equal(OFFICIAL_LEGACY_ROUTE_ACTIVATION.bracketRedirectToCanonical, false);
    assert.equal(OFFICIAL_LEGACY_ROUTE_ACTIVATION.directorRedirectToCanonical, false);
    assert.equal(mapOfficialLegacyBracketToCanonical("off-1"), "/tournament/off-1/bracket");
    assert.equal(mapOfficialLegacyDirectorToCanonical("off-1"), "/tournament/off-1/director");
    assert.equal(ENGINE_ROUTE_CLASSIFICATION.engine, "A");
    assert.equal(ENGINE_ROUTE_CLASSIFICATION.logs, "A");
    assert.equal(ENGINE_ROUTE_CLASSIFICATION.schedule, "B");
    assert.equal(ENGINE_ROUTE_CLASSIFICATION.draw, "C");
    assert.equal(individualOverviewPath("x"), "/tournament/x/overview");
  });
});
