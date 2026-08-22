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
  resolveTournamentExperienceAdapter,
  resolveTournamentExperienceMode,
  TOURNAMENT_EXPERIENCE_MODE,
} from "../src/features/tournament/experience-a1/experienceModeResolver.js";
import { resolveSelectedEvent } from "../src/features/tournament/experience-a1/deriveOverview.js";
import {
  hasCanonicalRegistrationPublication,
  publicationPrimaryActionLabel,
  resolveRegistrationPublicationStatus,
} from "../src/features/tournament/experience-a1/publicationSemantics.js";
import { deriveRegistrationModel } from "../src/features/tournament/experience-a1/batchB/deriveRegistration.js";
import { deriveParticipantsModel } from "../src/features/tournament/experience-a1/batchB/deriveParticipants.js";
import {
  buildOfficialSettingsSavePatch,
  buildOfficialPublishRegistrationPatch,
  buildOfficialCloseRegistrationPatch,
  buildOfficialRemoveEntryPatch,
  projectOfficialSettings,
  projectOfficialRegistration,
  projectOfficialParticipants,
  resolveOfficialCanonicalOpenPath,
  officialLegacySetupPath,
  OFFICIAL_EXPERIENCE_AUTHORITY,
  OFFICIAL_LEGACY_ROUTE_ACTIVATION,
  OFFICIAL_COMMAND_DELEGATION_MAP,
} from "../src/features/tournament/official-tournament-experience/index.js";
import {
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_SCORING_METHOD,
  SIDEOUT_OPERATIONAL,
  BEST_OF_3_OPERATIONAL,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  ratingMayInfluenceOpenPairingOrDraw,
  isOpenMode,
  isAiBalanceMode,
} from "../src/features/tournament/official-open-adapter-b/activation.js";
import { individualOverviewPath } from "../src/features/tournament/experience-a1/routes.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function officialTournament(overrides = {}) {
  return {
    id: "off-o2",
    name: "Official O2",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.DRAFT,
    tenantId: "tenant-a",
    clubId: "club-a",
    hostClubName: "CLB A",
    events: [
      {
        id: "ev-a",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [
          {
            id: "entry-1",
            name: "A / B",
            status: "pending",
            playerIds: ["p1", "p2"],
          },
          {
            id: "entry-2",
            name: "Solo",
            status: "approved",
            playerIds: ["p3"],
          },
        ],
        matches: [],
      },
      {
        id: "ev-b",
        name: "Đôi nữ",
        eventType: EVENT_TYPE.WOMEN_DOUBLE,
        entries: [],
        matches: [],
      },
    ],
    settings: {
      registration: {},
      officialCompetition: {
        registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
        scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
        matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_1,
        groupCount: 4,
      },
      eligibilityRules: {
        skill: { enabled: false, maxLevel: null },
        rating: { enabled: false, maxRating: null },
      },
    },
    ...overrides,
  };
}

describe("wave-o2-official-settings-registration-participants-01", () => {
  it("1-8 Settings route/adapter/save/event scoping/unsupported scoring", () => {
    const tournament = officialTournament();
    assert.equal(resolveTournamentExperienceMode(tournament), TOURNAMENT_EXPERIENCE_MODE.OFFICIAL);
    const adapter = resolveTournamentExperienceAdapter(tournament, { selectedEventId: "ev-a" });
    assert.ok(adapter.commands.saveSettings);
    assert.equal(typeof adapter.commands.saveSettings, "function");
    const settings = projectOfficialSettings(tournament, { selectedEventId: "ev-a" });
    assert.equal(settings.identity.tournamentId, "off-o2");
    assert.equal(settings.selectedEvent.id, "ev-a");
    assert.equal(settings.selectedEventExplicit, true);
    assert.equal(resolveSelectedEvent(tournament.events, ""), null);
    assert.equal(settings.scoringCapabilities.rally, true);
    assert.equal(settings.scoringCapabilities.sideOut, SIDEOUT_OPERATIONAL);
    assert.equal(settings.scoringCapabilities.bestOf3, BEST_OF_3_OPERATIONAL);
    assert.equal(settings.scoringCapabilities.winBy, false);
    assert.equal(settings.scoringCapabilities.changeEnd, false);

    const saved = buildOfficialSettingsSavePatch(tournament, {
      name: "Official O2 Renamed",
      hostClubName: "CLB B",
      officialMode: OFFICIAL_MODE.OPEN,
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      groupCount: 6,
      scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
      matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_1,
      maxLevel: "4.5",
      maxRating: "",
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.patch.name, "Official O2 Renamed");
    assert.ok(saved.patch.settings.officialCompetition);
    assert.equal(saved.patch.settings.officialCompetition.groupCount, 6);
    assert.equal(saved.authority, OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SETTINGS);

    const sideOutBlocked = buildOfficialSettingsSavePatch(tournament, {
      name: "X",
      scoringMethod: OFFICIAL_SCORING_METHOD.SIDE_OUT,
      matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_1,
    });
    if (!SIDEOUT_OPERATIONAL) {
      assert.equal(sideOutBlocked.ok, false);
      assert.equal(sideOutBlocked.code, "SIDE_OUT_UNSUPPORTED");
    }

    const bestOf3Blocked = buildOfficialSettingsSavePatch(tournament, {
      name: "X",
      scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
      matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_3,
    });
    if (!BEST_OF_3_OPERATIONAL) {
      assert.equal(bestOf3Blocked.ok, false);
      assert.equal(bestOf3Blocked.code, "BEST_OF_3_UNSUPPORTED");
    }

    const settingsPage = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualSettingsPage.jsx"),
      "utf8"
    );
    assert.ok(settingsPage.includes("buildOfficialSettingsSavePatch"));
    assert.ok(settingsPage.includes("dirty"));
    assert.ok(settingsPage.includes("official-competition-settings"));
    assert.equal(settingsPage.includes("createOfficialSettingsStore"), false);
  });

  it("9-15 Registration publication + window + event scope", () => {
    const draft = officialTournament();
    assert.equal(resolveRegistrationPublicationStatus(draft), "NOT_PUBLISHED");
    assert.equal(hasCanonicalRegistrationPublication(draft), false);
    assert.equal(publicationPrimaryActionLabel(""), "Công bố đăng ký");

    const published = officialTournament({ status: TOURNAMENT_STATUS.REGISTRATION });
    assert.equal(resolveRegistrationPublicationStatus(published), "PUBLISHED");
    assert.equal(hasCanonicalRegistrationPublication(published), true);
    assert.equal(publicationPrimaryActionLabel("PUBLISHED"), "Quản lý công bố");

    const pub = buildOfficialPublishRegistrationPatch(draft);
    assert.equal(pub.ok, true);
    assert.equal(pub.nextStatus, TOURNAMENT_STATUS.REGISTRATION);

    const model = deriveRegistrationModel(published, { selectedEventId: "ev-a" });
    assert.equal(model.official, true);
    assert.equal(model.publicationEnabled, true);
    assert.equal(model.eventId, "ev-a");
    assert.equal(model.needsEventChoice, false);

    const needsChoice = deriveRegistrationModel(published, { selectedEventId: "" });
    assert.equal(needsChoice.needsEventChoice, true);

    const regProj = projectOfficialRegistration(published, { selectedEventId: "ev-a" });
    assert.equal(regProj.publicationPublished, true);
    assert.equal(regProj.pendingCount, 1);
    assert.equal(regProj.authority, OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION);

    const close = buildOfficialCloseRegistrationPatch(published);
    assert.equal(close.ok, true);
    assert.ok(close.patch.settings);
    assert.equal(close.authority, OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION);

    assert.ok(OFFICIAL_COMMAND_DELEGATION_MAP.publishRegistration.includes("REGISTRATION"));
    assert.equal(OFFICIAL_COMMAND_DELEGATION_MAP.publishRegistration.includes("newPublicationStore"), false);
  });

  it("16-24 Participants real data + Open/AI semantics + no load mutation", () => {
    const openIndividual = officialTournament({
      officialMode: OFFICIAL_MODE.OPEN,
      settings: {
        ...officialTournament().settings,
        officialCompetition: {
          ...officialTournament().settings.officialCompetition,
          registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
        },
      },
    });
    const participants = projectOfficialParticipants(openIndividual, { selectedEventId: "ev-a" });
    assert.equal(participants.rows.length, 2);
    assert.equal(participants.rows[1].unit, "individual");
    assert.deepEqual(participants.rows[1].playerIds, ["p3"]);
    assert.equal(participants.rows[0].entryId, "entry-1");

    const openPair = officialTournament({
      officialMode: OFFICIAL_MODE.OPEN,
      settings: {
        ...officialTournament().settings,
        officialCompetition: {
          ...officialTournament().settings.officialCompetition,
          registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
        },
      },
    });
    const pairModel = deriveParticipantsModel(openPair, { selectedEventId: "ev-a" });
    assert.equal(pairModel.rows[0].unit, "pair");
    assert.deepEqual(pairModel.rows[0].playerIds, ["p1", "p2"]);

    const ai = officialTournament({ officialMode: OFFICIAL_MODE.AI_BALANCE });
    const aiModel = deriveParticipantsModel(ai, { selectedEventId: "ev-a" });
    assert.equal(aiModel.officialMode, OFFICIAL_MODE.AI_BALANCE);
    assert.ok(aiModel.rows.every((row) => Array.isArray(row.playerIds)));

    const removeMissingEvent = buildOfficialRemoveEntryPatch(openIndividual, "", "entry-1");
    assert.equal(removeMissingEvent.ok, false);
    assert.equal(removeMissingEvent.code, "EVENT_REQUIRED");

    const removeOk = buildOfficialRemoveEntryPatch(openIndividual, "ev-a", "entry-1");
    assert.equal(removeOk.ok, true);
    assert.equal(removeOk.patch.events.find((event) => event.id === "ev-a").entries.length, 1);

    const page = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualParticipantsPage.jsx"),
      "utf8"
    );
    assert.ok(page.includes("removeEntry"));
    assert.equal(page.includes("runPairing"), false);
    assert.equal(page.includes("createPair"), false);
  });

  it("25-41 route regression + authority locks + no second shell", () => {
    assert.equal(resolveOfficialCanonicalOpenPath({ id: "off-o2" }), "/tournament/off-o2/overview");
    assert.equal(individualOverviewPath("off-o2"), "/tournament/off-o2/overview");
    assert.ok(officialLegacySetupPath("off-o2").includes("experience=legacy"));
    assert.equal(OFFICIAL_LEGACY_ROUTE_ACTIVATION.bracketRedirectToCanonical, false);
    assert.equal(OFFICIAL_LEGACY_ROUTE_ACTIVATION.directorRedirectToCanonical, false);

    assert.equal(isOpenMode(officialTournament()), true);
    assert.equal(ratingMayInfluenceOpenPairingOrDraw(), false);
    assert.equal(isAiBalanceMode(officialTournament({ officialMode: OFFICIAL_MODE.AI_BALANCE })), true);

    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT, "CORE-13");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.MATCH_LIFECYCLE, "CORE-15");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.SCORING, "CORE-16");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_RESULT, "CORE-17");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.COURT, "canonical-court-authority");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SETTINGS, "official-open-settings-domain");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_ELIGIBILITY, "official-open-eligibility-engine");

    const adapter = resolveTournamentExperienceAdapter(officialTournament());
    assert.equal(adapter.commands.assignReferee, null);
    assert.equal(adapter.commands.scoreMatch, null);
    assert.equal(adapter.wave, "O6");

    const overview = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualOverviewPage.jsx"),
      "utf8"
    );
    assert.ok(overview.includes("TournamentExperienceWorkspace"));
    assert.equal(overview.includes("OfficialTournamentTheme"), false);
    assert.equal(overview.includes("OfficialTournamentExperienceShell"), false);

    const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
    assert.ok(router.includes("/tournament/:tournamentId/settings"));
    assert.ok(router.includes("/tournament/:tournamentId/registration"));
    assert.ok(router.includes("/tournament/:tournamentId/participants"));
    assert.ok(router.includes("OfficialExperienceCompatibilityRoute"));
  });
});
