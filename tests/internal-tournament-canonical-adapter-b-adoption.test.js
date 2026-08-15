/**
 * Internal Tournament Canonical Adapter B adoption + no-direct-bypass lock.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  EVENT_TYPE,
  MATCH_STATUS,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../src/models/tournament/constants.js";
import { OWNERSHIP_STATUS } from "../src/features/court-resource/constants/courtResourceContract.js";
import {
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_RESULT_CODE,
} from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import {
  IDENTITY_ACCESS_CONTRACT,
  PARTICIPANT_CONTRACT,
  PRODUCTION_BINDING_STATUS,
  SHARED_ADAPTER_ERROR_CODE,
  isCompetitionAdapterContractError,
} from "../src/features/competition-engine/integration/contracts/index.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  createCompetitionRefereeAdapterRegistry,
  runCompetitionRefereeAdapterConformance,
} from "../src/features/competition-engine/integration/referee/index.js";
import {
  INTERNAL_ADAPTER_ACTIVATION,
  INTERNAL_COURT_AUTHORITY,
  assignCourtsAndTimesToExistingInternalMatches,
  createInternalTournamentAdapterB,
  createInternalTournamentCourtAdapter,
  createInternalTournamentRefereeAdapter,
  loadInternalScheduleCourts,
  resolveInternalConditionalAdapterActivation,
  resolveInternalTournamentLifecycle,
} from "../src/features/tournament/internal/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function makeInternalTournament(overrides = {}) {
  return {
    id: "comp-ref-1",
    name: "Internal Adapter B",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.ACTIVE,
    tenantId: "tenant-1",
    clubId: "club-1",
    settings: { pairing: { strategyKey: "skill_controlled" }, ...(overrides.settings || {}) },
    events: [
      {
        id: "event-1",
        type: EVENT_TYPE.MEN_DOUBLE,
        entries: [
          { id: "entry-a", name: "A", playerIds: ["p-a", "p-a2"] },
          { id: "entry-b", name: "B", playerIds: ["p-b", "p-b2"] },
        ],
        matches: [
          {
            id: "match-1",
            entryAId: "entry-a",
            entryBId: "entry-b",
            status: MATCH_STATUS.ASSIGNED,
            scheduledStart: "2026-08-15T08:00:00",
            courtId: "court-1",
            physicalCourtId: "court-1",
          },
        ],
      },
    ],
    ...overrides,
  };
}

function expectCode(fn, code) {
  try {
    fn();
    assert.fail(`expected ${code}`);
  } catch (err) {
    assert.equal(isCompetitionAdapterContractError(err), true);
    assert.equal(err.code, code);
  }
}

describe("Internal Tournament Canonical Adapter B", () => {
  it("01-04/16 foundation adapters are bound with tenant scope and no owned Core engines", () => {
    const tournament = makeInternalTournament();
    const bundle = createInternalTournamentAdapterB({
      tournament,
      actor: { id: "auth-uid-1" },
    });
    assert.equal(bundle.identity.contractId, IDENTITY_ACCESS_CONTRACT.contractId);
    assert.equal(bundle.identity.productionBinding, PRODUCTION_BINDING_STATUS.BOUND);
    assert.equal(bundle.tenant.productionBinding, PRODUCTION_BINDING_STATUS.PARTIAL);
    assert.equal(bundle.participant.contractId, PARTICIPANT_CONTRACT.contractId);
    assert.equal(bundle.membership.productionBinding, PRODUCTION_BINDING_STATUS.PARTIAL);
    assert.equal(bundle.audit.productionBinding, PRODUCTION_BINDING_STATUS.PARTIAL);
    assert.equal(bundle.court.ownsCourtAssignmentAuthority, false);
    assert.equal(bundle.referee.ownsAssignmentAuthority, false);
    assert.equal(bundle.referee.ownsScoringAuthority, false);
    assert.equal(bundle.referee.actorIdentityAuthority, "auth.uid");
    for (const key of [
      "eligibilityDecisionEngine",
      "drawEngine",
      "scoringEngine",
      "championEngine",
    ]) {
      assert.equal(bundle.court[key], undefined);
      assert.equal(bundle.referee[key], undefined);
    }
  });

  it("07 Court Adapter V1 lists physicalCourtId, supports OWN_RESERVATION, fail-closes FOREIGN", async () => {
    const court = createInternalTournamentCourtAdapter({
      listEligibleCourts: () => ({
        ok: true,
        courts: [{ id: "tt412-court-01", name: "Sân 1", active: true, status: "active" }],
      }),
      getCourtAvailability: () => ({
        ok: true,
        courts: [
          {
            courtId: "tt412-court-01",
            court: { id: "tt412-court-01", name: "Sân 1" },
            available: true,
            ownership: { status: OWNERSHIP_STATUS.OWN_RESERVATION },
          },
        ],
      }),
      reserveCourts: () => ({
        ok: false,
        code: "FOREIGN_RESERVATION_CONFLICT",
        error: "foreign",
      }),
      validateCourtAssignment: () => ({
        ok: false,
        code: "FOREIGN_RESERVATION_CONFLICT",
        error: "foreign",
      }),
    });
    assert.equal(court.contractVersion, COMPETITION_COURT_ADAPTER_CONTRACT_VERSION);
    const listed = court.listEligibleCourts({ clubId: "club-1", tenantId: "tenant-1" });
    assert.equal(listed.ok, true);
    assert.equal(listed.courts[0].physicalCourtId, "tt412-court-01");
    const availability = court.getCourtAvailability({
      clubId: "club-1",
      tenantId: "tenant-1",
      competitionId: "comp-1",
      date: "2026-08-15",
      startTime: "08:00",
      endTime: "10:00",
    });
    assert.equal(availability.courts[0].resultCode, COMPETITION_COURT_RESULT_CODE.OWN_RESERVATION);
    const reserved = court.reserveCourts({
      clubId: "club-1",
      tenantId: "tenant-1",
      competitionId: "comp-1",
      physicalCourtIds: ["tt412-court-01"],
      date: "2026-08-15",
      startTime: "08:00",
      endTime: "10:00",
    });
    assert.equal(reserved.ok, false);
    assert.equal(reserved.failClosed, true);
    assert.equal(reserved.code, COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION);
    const assignment = court.validateMatchAssignment({
      clubId: "club-1",
      tenantId: "tenant-1",
      competitionId: "comp-1",
      physicalCourtId: "tt412-court-01",
      matchId: "match-1",
      date: "2026-08-15",
      startTime: "08:00",
      endTime: "10:00",
    });
    assert.equal(assignment.ok, false);
    assert.equal(assignment.failClosed, true);

    const loaded = await loadInternalScheduleCourts({
      clubId: "club-1",
      tenantId: "tenant-1",
      competitionId: "comp-1",
      courtAdapter: court,
    });
    assert.equal(loaded.authority, INTERNAL_COURT_AUTHORITY);
    assert.equal(loaded.courts[0].physicalCourtId, "tt412-court-01");
  });

  it("07 assignment fail-closes FOREIGN_RESERVATION and does not mutate match ids", () => {
    const matches = [{ id: "GA-R1-M1", entryAId: "a", entryBId: "b" }];
    const blocked = assignCourtsAndTimesToExistingInternalMatches({
      matches,
      courts: [{ id: "tt412-court-01", name: "Sân 1", active: true, status: "active" }],
      date: "2026-08-15",
      courtAdapter: {
        reserveCourts: () => ({
          ok: false,
          code: COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION,
          failClosed: true,
          error: "foreign",
        }),
      },
      competitionId: "comp-1",
      clubId: "club-1",
      tenantId: "tenant-1",
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.failClosed, true);
    assert.equal(blocked.matches[0].courtId, undefined);
  });

  it("08 Referee Adapter V1 passes shared conformance", () => {
    const tournament = makeInternalTournament();
    const adapter = createInternalTournamentRefereeAdapter({ tournament });
    assert.equal(adapter.contractId, COMPETITION_REFEREE_ADAPTER_CONTRACT_ID);
    assert.equal(adapter.contractVersion, COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION);
    const registry = createCompetitionRefereeAdapterRegistry({ adapters: [adapter] });
    const conformance = runCompetitionRefereeAdapterConformance(adapter, {
      registry,
      validRequest: {
        tenantId: "tenant-1",
        competitionId: "comp-ref-1",
        matchId: "match-1",
      },
    });
    assert.equal(conformance.ok, true, JSON.stringify(conformance.results));
    const propagation = adapter.resolveResultPropagation({
      tenantId: "tenant-1",
      competitionId: "comp-ref-1",
      matchId: "match-1",
    });
    assert.equal(propagation.propagateOnlyIfAccepted, true);
    assert.equal(propagation.instructions.source, "CORE-17 accepted active result only");
    assert.equal(adapter.wiredToProductionRuntime, false);
  });

  it("05/06/09 conditional activation does not block Internal lifecycle when inactive", () => {
    const inactive = resolveInternalConditionalAdapterActivation({
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      settings: { useRating: false },
    });
    assert.equal(inactive.rating, INTERNAL_ADAPTER_ACTIVATION.INACTIVE);
    assert.equal(inactive.ranking, INTERNAL_ADAPTER_ACTIVATION.INACTIVE);
    assert.equal(inactive.finance, INTERNAL_ADAPTER_ACTIVATION.INACTIVE);
    assert.equal(inactive.lifecycleBlockedByInactiveConditional, false);
    const lifecycle = resolveInternalTournamentLifecycle(
      makeInternalTournament({ settings: { useRating: false } })
    );
    assert.ok(lifecycle.CURRENT_STEP);

    const financeActive = resolveInternalConditionalAdapterActivation({
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      settings: { entryFee: 100000 },
    });
    assert.equal(financeActive.finance, INTERNAL_ADAPTER_ACTIVATION.ACTIVE);
    const bundle = createInternalTournamentAdapterB({
      tournament: makeInternalTournament({ settings: { entryFee: 100000 } }),
    });
    assert.equal(bundle.finance.productionBinding, PRODUCTION_BINDING_STATUS.NOT_CONFIGURED);
    expectCode(
      () =>
        bundle.finance.getEntryFeeStatus({
          tenantId: "tenant-1",
          competitionId: "comp-ref-1",
          actorId: "auth-uid-1",
          correlationId: "c1",
        }),
      SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED
    );
  });

  it("10-12/15 optional adapters are non-blocking; 13-14 stay disabled", () => {
    const activation = resolveInternalConditionalAdapterActivation(makeInternalTournament());
    assert.equal(activation.notification, INTERNAL_ADAPTER_ACTIVATION.OPTIONAL);
    assert.equal(activation.fileMedia, INTERNAL_ADAPTER_ACTIVATION.OPTIONAL);
    assert.equal(activation.streaming, INTERNAL_ADAPTER_ACTIVATION.OPTIONAL);
    assert.equal(activation.analytics, INTERNAL_ADAPTER_ACTIVATION.OPTIONAL);
    assert.equal(activation.federation, INTERNAL_ADAPTER_ACTIVATION.DISABLED);
    assert.equal(activation.crm, INTERNAL_ADAPTER_ACTIVATION.DISABLED);
    const lifecycle = resolveInternalTournamentLifecycle(makeInternalTournament());
    assert.ok(lifecycle.CURRENT_STEP);
  });

  it("no direct club_data_v3 / Team court reader / synthetic court identity bypass", () => {
    const court = readSrc("src/features/tournament/internal/internalScheduleCourts.js");
    const adapter = readSrc("src/features/tournament/internal/InternalTournamentCourtAdapter.js");
    const referee = readSrc("src/features/tournament/internal/InternalTournamentRefereeAdapter.js");
    const composition = readSrc("src/features/tournament/internal/internalCanonicalAdapterB.js");
    const stage = readSrc("src/components/tournament/internal/InternalScheduleStage.jsx");
    const blob = court + adapter + referee + composition + stage;
    assert.doesNotMatch(blob, /listCanonicalClubCourtsForFormatVenue/);
    assert.doesNotMatch(blob, /club_data_v3/);
    assert.doesNotMatch(blob, /localStorage/);
    assert.doesNotMatch(adapter, /court-\$\{index/);
    assert.doesNotMatch(referee, /assignReferee|persistScore|acceptResult/);
    assert.match(adapter, /createCourtResourceCompetitionAdapter/);
    assert.match(referee, /competition.referee.adapter.v1/);
    assert.match(stage, /createInternalTournamentCourtAdapter/);
  });
});
