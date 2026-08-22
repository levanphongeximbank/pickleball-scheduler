/**
 * NEW_OFFICIAL_TOURNAMENT_BOOTSTRAP_REMEDIATION
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  TOURNAMENT_MODE,
  OFFICIAL_MODE,
  EVENT_TYPE,
} from "../src/models/tournament/constants.js";
import { resolveTournamentCreateNavigatePath } from "../src/features/tournament/pages/canonicalTournamentCreateStart.js";
import {
  buildAddOfficialEventPatch,
  buildUpdateEventPatch,
} from "../src/features/tournament/experience-a1/settingsWriters.js";
import { buildOfficialAddEventPatch } from "../src/features/tournament/official-tournament-experience/officialExperienceCommands.js";
import {
  SIDEOUT_OPERATIONAL,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_REGISTRATION_MODE,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { buildOfficialSettingsSavePatch } from "../src/features/tournament/official-tournament-experience/officialExperienceCommands.js";
import { deriveRegistrationModel } from "../src/features/tournament/experience-a1/batchB/deriveRegistration.js";
import { resolveSelectedEvent, listTournamentEvents } from "../src/features/tournament/experience-a1/deriveOverview.js";
import { OFFICIAL_EXPERIENCE_AUTHORITY } from "../src/features/tournament/official-tournament-experience/authorityLock.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function emptyOfficial(overrides = {}) {
  return {
    id: "78c20ee0-4f4b-4df3-b5db-e5731ac94357",
    name: "Giải đấu 21/8/2026",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    tenantId: "venue-staging-a",
    clubId: "club-a",
    events: [],
    settings: {},
    ...overrides,
  };
}

describe("NEW_OFFICIAL_TOURNAMENT_BOOTSTRAP_REMEDIATION", () => {
  it("1-5 create handoff lands on /settings; no legacy; no type-as-eventId", () => {
    assert.equal(
      resolveTournamentCreateNavigatePath("official_tournament", "t-new"),
      "/tournament/t-new/settings"
    );
    assert.equal(
      resolveTournamentCreateNavigatePath("official_tournament", "t-new", "men_double"),
      "/tournament/t-new/settings"
    );
    assert.notEqual(
      resolveTournamentCreateNavigatePath("official_tournament", "t-new"),
      "/tournament/t-new/overview"
    );
    const createStart = read("src/features/tournament/pages/canonicalTournamentCreateStart.js");
    assert.match(createStart, /\/settings/);
    assert.doesNotMatch(createStart, /official_tournament[\s\S]{0,200}\/overview\?eventId=/);
    const createPage = read("src/features/tournament/pages/CanonicalTournamentCreatePage.jsx");
    assert.match(createPage, /resolveTournamentCreateNavigatePath/);
    assert.doesNotMatch(createPage, /OfficialTournamentSetup/);
  });

  it("6-9 empty event state CTA; no mutation on load", () => {
    const settings = read("src/features/tournament/experience-a1/pages/IndividualSettingsPage.jsx");
    assert.match(settings, /official-empty-event-state/);
    assert.match(settings, /Thêm nội dung/);
    assert.match(settings, /Chưa có nội dung thi đấu/);
    assert.match(settings, /official-add-event-cta/);
    assert.doesNotMatch(settings, /useEffect\([\s\S]{0,200}buildAddOfficialEventPatch/);
    assert.doesNotMatch(settings, /useEffect\([\s\S]{0,200}handleAddEvent/);
  });

  it("10-18 explicit create: one Event, stable id, selection, no events[0]", () => {
    const t = emptyOfficial();
    const first = buildAddOfficialEventPatch(t, {
      eventType: EVENT_TYPE.MEN_DOUBLE,
      name: "Đôi nam",
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(first.ok, true);
    assert.equal(first.event.name, "Đôi nam");
    assert.equal(first.event.eventType, EVENT_TYPE.MEN_DOUBLE);
    assert.ok(String(first.event.id).length > 0);
    assert.notEqual(first.event.id, "0");
    assert.equal(first.patch.events.length, 1);
    assert.equal(first.patch.events[0].id, first.event.id);

    const nextTournament = { ...t, ...first.patch, events: first.patch.events };
    const selected = resolveSelectedEvent(listTournamentEvents(nextTournament), first.event.id);
    assert.equal(selected?.id, first.event.id);

    const alias = buildOfficialAddEventPatch(nextTournament, {
      eventType: EVENT_TYPE.WOMEN_DOUBLE,
      name: "Đôi nữ",
    });
    assert.equal(alias.ok, true);
    assert.equal(alias.patch.events.length, 2);
    assert.equal(alias.patch.events.some((e) => e.id === first.event.id), true);
    assert.equal(alias.patch.events.some((e) => e.id === alias.event.id), true);

    const alone = resolveSelectedEvent(listTournamentEvents(nextTournament), "");
    // Sole event may resolve for UX continuity; never invent a missing id or events[0] when empty.
    assert.equal(alone?.id, first.event.id);
    const multi = {
      ...nextTournament,
      events: alias.patch.events,
    };
    const noImplicitFirst = resolveSelectedEvent(listTournamentEvents(multi), "");
    assert.equal(noImplicitFirst, null);
  });

  it("AI Balance rejects pair registration on event create", () => {
    const t = emptyOfficial({ officialMode: OFFICIAL_MODE.AI_BALANCE });
    const denied = buildAddOfficialEventPatch(t, {
      eventType: EVENT_TYPE.MEN_DOUBLE,
      name: "Đôi nam",
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "AI_BALANCE_PAIR_REGISTRATION_BLOCKED");
  });

  it("19-23 event update affects selected Event only", () => {
    const base = emptyOfficial();
    const a = buildAddOfficialEventPatch(base, { name: "A", eventType: EVENT_TYPE.MEN_DOUBLE });
    const withA = { ...base, events: a.patch.events };
    const b = buildAddOfficialEventPatch(withA, { name: "B", eventType: EVENT_TYPE.WOMEN_DOUBLE });
    const withBoth = { ...withA, events: b.patch.events };
    const updated = buildUpdateEventPatch(withBoth, a.event.id, { name: "A-renamed" });
    assert.equal(updated.ok, true);
    const renamed = updated.patch.events.find((e) => e.id === a.event.id);
    const other = updated.patch.events.find((e) => e.id === b.event.id);
    assert.equal(renamed.name, "A-renamed");
    assert.equal(other.name, "B");
  });

  it("24-25 registration fail-closed without Event; ready with Event", () => {
    const empty = deriveRegistrationModel(emptyOfficial(), { selectedEventId: "" });
    assert.equal(empty.emptyEvents, true);
    assert.equal(empty.eventId, "");

    const created = buildAddOfficialEventPatch(emptyOfficial(), {
      name: "Đôi nam",
      eventType: EVENT_TYPE.MEN_DOUBLE,
    });
    const withEvent = { ...emptyOfficial(), events: created.patch.events };
    const ready = deriveRegistrationModel(withEvent, { selectedEventId: created.event.id });
    assert.equal(ready.emptyEvents, false);
    assert.equal(ready.eventId, created.event.id);
    assert.equal(ready.needsEventChoice, false);

    const regPage = read(
      "src/features/tournament/experience-a1/pages/IndividualRegistrationPublicationPage.jsx"
    );
    assert.match(regPage, /emptyEvents/);
    assert.match(regPage, /Tạo nội dung trong Cài đặt/);
  });

  it("26-29 Side-out operational via CORE-16; Content event required to persist", () => {
    assert.equal(SIDEOUT_OPERATIONAL, true);

    const withoutEventId = buildOfficialSettingsSavePatch(emptyOfficial(), {
      name: "Giải đấu 21/8/2026",
      scoringMethod: OFFICIAL_SCORING_METHOD.SIDE_OUT,
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(withoutEventId.ok, false);
    assert.equal(withoutEventId.code, "EVENT_REQUIRED");

    const created = buildAddOfficialEventPatch(emptyOfficial(), {
      eventType: EVENT_TYPE.MEN_DOUBLE,
      name: "Đôi nam",
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(created.ok, true);
    const withEvent = {
      ...emptyOfficial(),
      ...created.patch,
      events: created.patch.events,
    };

    const sideOut = buildOfficialSettingsSavePatch(withEvent, {
      name: "Giải đấu 21/8/2026",
      eventId: created.event.id,
      scoringMethod: OFFICIAL_SCORING_METHOD.SIDE_OUT,
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(sideOut.ok, true);

    const rally = buildOfficialSettingsSavePatch(withEvent, {
      name: "Giải đấu 21/8/2026",
      eventId: created.event.id,
      scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(rally.ok, true);

    const settingsPage = read(
      "src/features/tournament/experience-a1/pages/IndividualSettingsPage.jsx"
    );
    const formatPanel = read(
      "src/features/tournament/experience-a1/components/OfficialContentFormatSettingsPanel.jsx"
    );
    assert.match(settingsPage, /OfficialContentFormatSettingsPanel/);
    assert.match(formatPanel, /SIDEOUT_OPERATIONAL/);
    assert.match(formatPanel, /SIDE_OUT|Side-out/i);
  });

  it("36-47 regression locks: CORE authorities + no second shell", () => {
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT, "CORE-13");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.MATCH_LIFECYCLE, "CORE-15");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.SCORING, "CORE-16");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_RESULT, "CORE-17");

    const facade = read(
      "src/features/tournament/official-tournament-experience/officialCore13AssignmentCommands.js"
    );
    assert.match(facade, /executeOfficialCore13RefereeAssignment/);

    const groupDraw = read(
      "src/features/tournament/official-tournament-experience/groupDrawProjection.js"
    );
    assert.match(groupDraw, /listOfficialGroupDrawCompetitionUnits/);

    const dashboard = read("src/pages/dashboard.logic.js");
    assert.match(dashboard, /hasExplicitDashboardClubId|assertExplicitClubId/);

    const settings = read("src/features/tournament/experience-a1/pages/IndividualSettingsPage.jsx");
    assert.doesNotMatch(settings, /OfficialTournamentExperienceShell/);
    assert.doesNotMatch(settings, /createEventStore|secondEventAuthority/);
  });
});
