import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { generateSchedule } from "../src/features/tournament-engine/engines/scheduleEngine.js";
import {
  findMinimumRestViolations,
  validateScheduleConflicts,
} from "../src/features/individual-tournament/engines/restTimeEngine.js";
import {
  canRegenerateSchedule,
  canPublishSchedule,
  canLockSchedule,
  forceRepublishSchedule,
  getSchedulePublishStatus,
  lockSchedule,
  publishSchedule,
  recordScheduleCreated,
  reopenSchedule,
  SCHEDULE_PUBLISH_STATUS,
  SCHEDULE_AUDIT_ACTIONS,
} from "../src/tournament/engines/publishScheduleEngine.js";
import { DRAW_PUBLISH_STATUS } from "../src/tournament/engines/publishDrawEngine.js";
import { MATCH_STATUS } from "../src/models/tournament/constants.js";

function makeTournament(overrides = {}) {
  return {
    id: "t-s1-e",
    clubId: "club-1",
    settings: {
      draw: {
        status: DRAW_PUBLISH_STATUS.PUBLISHED,
        publishedAt: "2026-07-14T08:00:00.000Z",
        snapshot: [{ id: "g1" }],
      },
      ...(overrides.settings || {}),
    },
    ...overrides,
  };
}

function scheduledMatches() {
  return [
    {
      id: "m1",
      entryAId: "e1",
      entryBId: "e2",
      courtId: "c1",
      scheduledStart: "2026-07-14T08:00:00.000Z",
      scheduledEnd: "2026-07-14T08:25:00.000Z",
      slot: 0,
      status: MATCH_STATUS.WAITING,
    },
    {
      id: "m2",
      entryAId: "e3",
      entryBId: "e4",
      courtId: "c2",
      scheduledStart: "2026-07-14T08:00:00.000Z",
      scheduledEnd: "2026-07-14T08:25:00.000Z",
      slot: 1,
      status: MATCH_STATUS.WAITING,
    },
  ];
}

test("T-S1-E01 Min rest violation fails schedule generation", () => {
  // Same player on back-to-back rounds with huge minRest and only 1 court/short day → fail
  const matches = [
    {
      id: "m1",
      entryAId: "p1",
      entryBId: "p2",
      round: 1,
      status: MATCH_STATUS.WAITING,
    },
    {
      id: "m2",
      entryAId: "p1",
      entryBId: "p3",
      round: 2,
      status: MATCH_STATUS.WAITING,
    },
    {
      id: "m3",
      entryAId: "p1",
      entryBId: "p4",
      round: 3,
      status: MATCH_STATUS.WAITING,
    },
  ];

  const result = generateSchedule(
    {
      tournamentId: "t1",
      matches,
      courts: [{ id: "c1", name: "Sân 1", priority: 10 }],
      scheduleConfig: {
        startTime: "08:00",
        endTime: "08:40",
        averageMatchMinutes: 25,
        bufferMinutes: 5,
        minRestMinutes: 60,
        date: "2026-07-14",
        strictRest: true,
      },
    },
    { strictRest: true, legacyAvailability: true }
  );

  assert.equal(result.ok, false);
  assert.ok((result.errors || []).length > 0);
});

test("T-S1-E01b generateSchedule auto-adjusts to satisfy min rest", () => {
  const matches = [
    {
      id: "m1",
      entryAId: "p1",
      entryBId: "p2",
      round: 1,
      status: MATCH_STATUS.WAITING,
    },
    {
      id: "m2",
      entryAId: "p1",
      entryBId: "p3",
      round: 2,
      status: MATCH_STATUS.WAITING,
    },
  ];

  const result = generateSchedule({
    tournamentId: "t1",
    matches,
    courts: [
      { id: "c1", name: "Sân 1", priority: 10 },
      { id: "c2", name: "Sân 2", priority: 5 },
    ],
    scheduleConfig: {
      startTime: "08:00",
      endTime: "22:00",
      averageMatchMinutes: 25,
      bufferMinutes: 5,
      minRestMinutes: 30,
      date: "2026-07-14",
    },
  }, { legacyAvailability: true });

  assert.equal(result.ok, true);
  const m1 = result.data.matches.find((m) => m.id === "m1");
  const m2 = result.data.matches.find((m) => m.id === "m2");
  const gap =
    (new Date(m2.scheduledStart).getTime() - new Date(m1.scheduledEnd).getTime()) / 60000;
  assert.ok(gap >= 30, `expected rest >= 30, got ${gap}`);
});

test("T-S1-E02 Publish schedule locks mutations", () => {
  let tournament = makeTournament();
  const matches = scheduledMatches();

  const created = recordScheduleCreated(tournament, matches, { userId: "btc" });
  assert.equal(created.ok, true);
  tournament = created.tournament;

  const locked = lockSchedule(tournament, matches, { userId: "btc" });
  assert.equal(locked.ok, true);
  tournament = locked.tournament;

  const published = publishSchedule(tournament, matches, { userId: "btc" });
  assert.equal(published.ok, true);
  tournament = published.tournament;

  const publish = getSchedulePublishStatus(tournament);
  assert.equal(publish.status, SCHEDULE_PUBLISH_STATUS.PUBLISHED);
  assert.ok(publish.publishedAt);
  assert.ok(Array.isArray(publish.snapshot));
  assert.equal(publish.snapshot.length, 2);

  const regen = canRegenerateSchedule(tournament);
  assert.equal(regen.ok, false);

  const reopenDenied = reopenSchedule(tournament, { hasReopenPermission: false });
  assert.equal(reopenDenied.ok, false);
  assert.equal(reopenDenied.code, "REOPEN_FORBIDDEN");

  const force = forceRepublishSchedule(tournament, {
    hasReopenPermission: true,
    userId: "owner",
  });
  assert.equal(force.ok, true);
  assert.equal(
    getSchedulePublishStatus(force.tournament).status,
    SCHEDULE_PUBLISH_STATUS.DRAFT
  );
  assert.ok(
    force.tournament.settings.schedule.auditLog.some(
      (e) => e.action === SCHEDULE_AUDIT_ACTIONS.FORCE_PUBLISH
    )
  );
});

test("T-S1-E03 Player time conflict detected", () => {
  const matches = [
    {
      id: "m1",
      entryAId: "e1",
      entryBId: "e2",
      scheduledStart: "2026-07-14T08:00:00.000Z",
      scheduledEnd: "2026-07-14T08:25:00.000Z",
      courtId: "c1",
    },
    {
      id: "m2",
      entryAId: "e1",
      entryBId: "e3",
      scheduledStart: "2026-07-14T08:10:00.000Z",
      scheduledEnd: "2026-07-14T08:35:00.000Z",
      courtId: "c2",
    },
  ];

  const rest = findMinimumRestViolations(matches, 15);
  assert.equal(rest.ok, false);
  assert.ok(rest.conflictCount >= 1);

  const validation = validateScheduleConflicts(matches, { minRestMinutes: 15 });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.length >= 1);
});

test("schedule lifecycle draft → lock → publish → reopen", () => {
  let tournament = makeTournament();
  const matches = scheduledMatches();

  tournament = recordScheduleCreated(tournament, matches, { userId: "btc" }).tournament;
  assert.equal(getSchedulePublishStatus(tournament).status, SCHEDULE_PUBLISH_STATUS.DRAFT);

  assert.equal(canLockSchedule(tournament, matches).ok, true);
  tournament = lockSchedule(tournament, matches, { userId: "btc" }).tournament;
  assert.equal(getSchedulePublishStatus(tournament).status, SCHEDULE_PUBLISH_STATUS.LOCKED);

  assert.equal(canPublishSchedule(tournament, matches).ok, true);
  tournament = publishSchedule(tournament, matches, { userId: "btc" }).tournament;
  assert.equal(getSchedulePublishStatus(tournament).status, SCHEDULE_PUBLISH_STATUS.PUBLISHED);

  tournament = reopenSchedule(tournament, {
    hasReopenPermission: true,
    userId: "owner",
  }).tournament;
  assert.equal(getSchedulePublishStatus(tournament).status, SCHEDULE_PUBLISH_STATUS.DRAFT);
  assert.ok(
    tournament.settings.schedule.auditLog.some(
      (e) => e.action === SCHEDULE_AUDIT_ACTIONS.REOPENED
    )
  );
});

test("cannot lock schedule before draw published", () => {
  const tournament = makeTournament({
    settings: {
      draw: { status: DRAW_PUBLISH_STATUS.DRAFT },
    },
  });
  const result = canLockSchedule(tournament, scheduledMatches());
  assert.equal(result.ok, false);
  assert.match(result.error, /bốc thăm/i);
});

test("TournamentPublishSchedulePage no longer uses team demo builder", () => {
  const pagePath = path.join("src/pages/tournament/TournamentPublishSchedulePage.jsx");
  const source = fs.readFileSync(pagePath, "utf8");
  assert.doesNotMatch(source, /buildDemoTeamData/);
  assert.doesNotMatch(source, /team-tournament\/engines\/publishScheduleEngine/);
  assert.match(source, /IndividualTournamentSelector/);
  assert.match(source, /publishScheduleEngine\.js/);
});

test("sessions + court priority respected", () => {
  const matches = [
    {
      id: "m1",
      entryAId: "a",
      entryBId: "b",
      round: 1,
      status: MATCH_STATUS.WAITING,
    },
  ];
  const result = generateSchedule({
    matches,
    courts: [
      {
        id: "c-low",
        name: "Low",
        priority: 1,
        availableSessions: ["morning"],
      },
      {
        id: "c-high",
        name: "High",
        priority: 99,
        availableSessions: ["morning"],
      },
    ],
    scheduleConfig: {
      sessions: [{ id: "morning", startTime: "08:00", endTime: "12:00" }],
      averageMatchMinutes: 25,
      bufferMinutes: 5,
      minRestMinutes: 15,
      date: "2026-07-14",
    },
  }, { legacyAvailability: true });
  assert.equal(result.ok, true);
  assert.equal(result.data.matches[0].courtId, "c-high");
  assert.equal(result.data.matches[0].session, "morning");
});
