/**
 * Phase 2J — shared setTournamentCourtScheduleCommand court-authorization guard.
 * Does not change Team/Daily booking engines. Does not bypass checkBookingConflict.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import {
  authorizeProvidedTournamentCourts,
  PROVIDED_COURT_AUTH_CODE,
} from "../src/features/tournament/services/tournamentCommands.js";
import { checkBookingConflict } from "../src/domain/courtBookingEngine.js";

function src(path) {
  return readFileSync(path, "utf8");
}

const SCOPE = { clubId: "club-1", tenantId: "tenant-a" };

const CANONICAL = [
  { id: "court-1", name: "Sân 1", clubId: "club-1", tenantId: "tenant-a" },
  { id: "court-2", name: "Sân 2", clubId: "club-1", tenantId: "tenant-a" },
];

describe("official-open-tournament-phase2j-shared-booking-guard-01", () => {
  it("A. Official provided canonical courts in-scope are authorized", () => {
    const result = authorizeProvidedTournamentCourts(CANONICAL, SCOPE, ["court-1"]);
    assert.equal(result.ok, true);
    assert.equal(result.courts.length, 2);
  });

  it("B. Official empty provided courts fail closed with no localStorage fallback", () => {
    const empty = authorizeProvidedTournamentCourts([], SCOPE, []);
    assert.equal(empty.ok, false);
    assert.equal(empty.code, PROVIDED_COURT_AUTH_CODE.ZERO_COURTS_SELECTED);

    const notArray = authorizeProvidedTournamentCourts(null, SCOPE, ["court-1"]);
    assert.equal(notArray.ok, false);
    assert.equal(notArray.code, PROVIDED_COURT_AUTH_CODE.ZERO_COURTS_SELECTED);

    const commandSrc = src("src/features/tournament/services/tournamentCommands.js");
    assert.match(commandSrc, /hasOwnProperty\.call\(options, "courts"\)/);
    const providedStart = commandSrc.indexOf(
      '} else if (Object.prototype.hasOwnProperty.call(options, "courts"))'
    );
    const providedEnd = commandSrc.indexOf("} else {", providedStart);
    assert.ok(providedStart >= 0, "provided-courts branch missing");
    assert.ok(providedEnd > providedStart, "legacy else branch missing");
    const providedBranch = commandSrc.slice(providedStart, providedEnd);
    assert.match(providedBranch, /authorizeProvidedTournamentCourts/);
    assert.match(providedBranch, /readCanonicalClubCourtBookingSnapshot/);
    assert.doesNotMatch(providedBranch, /loadCourtsForClub/);
    assert.doesNotMatch(providedBranch, /localStorage\.getItem/);
  });

  it("C. wrong-tenant or wrong-club provided court fail closed", () => {
    const otherTenant = authorizeProvidedTournamentCourts(
      [
        ...CANONICAL,
        { id: "court-x", name: "Sân other", clubId: "club-1", tenantId: "tenant-b" },
      ],
      SCOPE,
      ["court-1"]
    );
    assert.equal(otherTenant.ok, false);
    assert.equal(otherTenant.code, PROVIDED_COURT_AUTH_CODE.COURT_TENANT_FORBIDDEN);

    const otherClub = authorizeProvidedTournamentCourts(
      [{ id: "court-1", name: "Sân 1", clubId: "club-other", tenantId: "tenant-a" }],
      SCOPE,
      ["court-1"]
    );
    assert.equal(otherClub.ok, false);
    assert.equal(otherClub.code, PROVIDED_COURT_AUTH_CODE.COURT_TENANT_FORBIDDEN);

    const selectedOutside = authorizeProvidedTournamentCourts(CANONICAL, SCOPE, [
      "court-foreign",
    ]);
    assert.equal(selectedOutside.ok, false);
    assert.equal(selectedOutside.code, PROVIDED_COURT_AUTH_CODE.COURT_NOT_IN_AUTHORIZED_SET);
  });

  it("D. overlap still blocked by checkBookingConflict", () => {
    const conflict = checkBookingConflict(
      [
        {
          id: "b1",
          courtId: "court-1",
          courtName: "Sân 1",
          date: "2026-08-20",
          startTime: "08:00",
          endTime: "10:00",
          bookingStatus: "confirmed",
        },
      ],
      {
        courtId: "court-1",
        date: "2026-08-20",
        startTime: "09:00",
        endTime: "11:00",
      }
    );
    assert.ok(conflict);
    assert.equal(conflict.code, "CONFLICT");
    const bookingSrc = src("src/domain/tournamentBookingService.js");
    assert.match(bookingSrc, /checkBookingConflict/);
    const commandSrc = src("src/features/tournament/services/tournamentCommands.js");
    assert.match(commandSrc, /syncTournamentCourtBookings/);
  });

  it("E. Team Tournament does not consume this command", () => {
    const commandSrc = src("src/features/tournament/services/tournamentCommands.js");
    const createUsesTeam =
      commandSrc.includes("createTeamTournamentForUi") &&
      commandSrc.includes("TOURNAMENT_MODE.TEAM_TOURNAMENT");
    assert.equal(createUsesTeam, true);
    assert.doesNotMatch(
      src("src/features/team-tournament/services/teamTournamentService.js"),
      /setTournamentCourtScheduleCommand/
    );
    assert.doesNotMatch(
      src("src/components/tournament/team/TeamFormatVenueSetupPanel.jsx"),
      /setTournamentCourtScheduleCommand/
    );
  });

  it("F. Daily Play does not consume this command", () => {
    assert.doesNotMatch(
      src("src/features/daily-play/canonical/dailyPlayCanonicalService.js"),
      /setTournamentCourtScheduleCommand/
    );
    assert.doesNotMatch(
      src("src/features/daily-play/canonical/inMemoryDailyPlayAuthority.js"),
      /setTournamentCourtScheduleCommand/
    );
  });

  it("G. callers without provided courts retain loadCourtsForClub", () => {
    const commandSrc = src("src/features/tournament/services/tournamentCommands.js");
    assert.equal(commandSrc.includes("} else {"), true);
    assert.equal(commandSrc.includes("courts = loadCourtsForClub(scope.clubId);"), true);
    const panelSrc = src("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(panelSrc, /loadCourtsForClub/);
    assert.match(panelSrc, /TournamentCourtSchedulePanel/);
  });
});
