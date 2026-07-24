/**
 * E2E-05 Public Competition Experience application facade.
 *
 * Read-only published projections. Does not call Organizer commands,
 * does not implement parallel engines, and fail-closes on unpublished data.
 */

import {
  E2E05_PUBLIC_EXPERIENCE_PHASE,
  E2E05_PUBLIC_EXPERIENCE_VERSION,
  PUBLIC_ERROR_CODE,
  PUBLIC_QUERY,
} from "./constants.js";
import {
  failPublic,
  isPublicCompetitionExperienceError,
  normalizePublicError,
} from "./errors.js";
import {
  computePublicFingerprint,
  deepFreeze,
  snapshotInput,
} from "./fingerprint.js";
import {
  assertArchiveVisible,
  assertBracketPublished,
  assertCompetitionPublished,
  assertFinalResultsPublished,
  assertParticipantsVisible,
  assertResultsPublished,
  assertSchedulePublished,
  assertPublicTenantScope,
  requirePublicScope,
  resolvePublicVisibility,
} from "./gates/publicationPrivacyGates.js";
import { projectPublishedRecordFromOrganizer } from "./adapters/projectPublishedRecordFromOrganizer.js";
import {
  buildPublicArchiveProjection,
  buildPublicBracketProjection,
  buildPublicCompetitionExperienceProjection,
  buildPublicFinalResultsProjection,
  buildPublicMatchCenterProjection,
  buildPublicOverviewProjection,
  buildPublicParticipantsProjection,
  buildPublicPoolsProjection,
  buildPublicQualificationProjection,
  buildPublicScheduleProjection,
  buildPublicStandingsProjection,
} from "./projections/buildPublicCompetitionProjection.js";
import { createInMemoryPublicExperienceStore } from "./store/createInMemoryPublicExperienceStore.js";

/**
 * @param {object} deps
 */
export function createPublicCompetitionExperienceFacade(deps = {}) {
  const store = deps.store || createInMemoryPublicExperienceStore({
    clockIso: deps.clockIso || "2026-07-24T00:00:00.000Z",
  });

  /**
   * Optional read-through to Organizer store (read-only).
   * Never mutates Organizer state.
   * @type {null | { get: (tenantId: string, competitionId: string) => object }}
   */
  const organizerStore = deps.organizerStore || null;

  /**
   * @param {object} query
   * @returns {object}
   */
  function loadPublishedRecord(query) {
    const { tenantId, competitionId } = requirePublicScope(query);
    let record = store.get(tenantId, competitionId);

    if (!record && organizerStore && typeof organizerStore.get === "function") {
      const organizerRecord = organizerStore.get(tenantId, competitionId);
      if (organizerRecord) {
        record = projectPublishedRecordFromOrganizer({
          organizerRecord,
          publicOverlay: query.publicOverlay || deps.publicOverlay || {},
        });
      }
    }

    if (!record && query.publishedRecord) {
      record = projectPublishedRecordFromOrganizer({
        organizerRecord: query.publishedRecord,
        publicOverlay: query.publicOverlay || {},
      });
    }

    assertPublicTenantScope(record, tenantId, competitionId);
    return record;
  }

  /**
   * @param {string} queryKind
   * @param {object} query
   * @param {object} result
   */
  function okResult(queryKind, query, result) {
    const fingerprint = computePublicFingerprint(
      {
        queryKind,
        tenantId: query.tenantId,
        competitionId: query.competitionId,
        result,
      },
      "e2e05-query"
    );
    return deepFreeze({
      ok: true,
      phase: E2E05_PUBLIC_EXPERIENCE_PHASE,
      version: E2E05_PUBLIC_EXPERIENCE_VERSION,
      queryKind,
      fingerprint,
      result,
    });
  }

  /**
   * @param {Function} fn
   * @param {object} query
   * @param {string} queryKind
   */
  async function runQuery(fn, query, queryKind) {
    const inputSnap = snapshotInput(query);
    void inputSnap;
    try {
      const record = loadPublishedRecord(query);
      const visibility = resolvePublicVisibility(
        record.visibility,
        record.publicationState
      );
      const result = fn(record, visibility, query);
      return okResult(queryKind, query, result);
    } catch (err) {
      if (isPublicCompetitionExperienceError(err)) throw err;
      throw normalizePublicError(err);
    }
  }

  async function getPublicCompetitionOverview(query = {}) {
    return runQuery(
      (record, visibility) => {
        assertCompetitionPublished(visibility);
        return buildPublicOverviewProjection(record);
      },
      query,
      PUBLIC_QUERY.OVERVIEW
    );
  }

  async function getPublicParticipants(query = {}) {
    return runQuery(
      (record, visibility) => {
        assertCompetitionPublished(visibility);
        assertParticipantsVisible(visibility);
        return buildPublicParticipantsProjection(record);
      },
      query,
      PUBLIC_QUERY.PARTICIPANTS
    );
  }

  async function getPublicSchedule(query = {}) {
    return runQuery(
      (record, visibility) => {
        assertCompetitionPublished(visibility);
        assertSchedulePublished(visibility);
        return buildPublicScheduleProjection(record);
      },
      query,
      PUBLIC_QUERY.SCHEDULE
    );
  }

  async function getPublicPools(query = {}) {
    return runQuery(
      (record, visibility) => {
        assertCompetitionPublished(visibility);
        return buildPublicPoolsProjection(record);
      },
      query,
      PUBLIC_QUERY.POOLS
    );
  }

  async function getPublicStandings(query = {}) {
    return runQuery(
      (record, visibility) => {
        assertCompetitionPublished(visibility);
        assertResultsPublished(visibility);
        return buildPublicStandingsProjection(record);
      },
      query,
      PUBLIC_QUERY.STANDINGS
    );
  }

  async function getPublicQualification(query = {}) {
    return runQuery(
      (record, visibility) => {
        assertCompetitionPublished(visibility);
        assertResultsPublished(visibility);
        return buildPublicQualificationProjection(record);
      },
      query,
      PUBLIC_QUERY.QUALIFICATION
    );
  }

  async function getPublicBracket(query = {}) {
    return runQuery(
      (record, visibility) => {
        assertCompetitionPublished(visibility);
        assertBracketPublished(visibility);
        return buildPublicBracketProjection(record);
      },
      query,
      PUBLIC_QUERY.BRACKET
    );
  }

  async function getPublicMatchCenter(query = {}) {
    return runQuery(
      (record, visibility) => {
        assertCompetitionPublished(visibility);
        return buildPublicMatchCenterProjection(record);
      },
      query,
      PUBLIC_QUERY.MATCH_CENTER
    );
  }

  async function getPublicFinalResults(query = {}) {
    return runQuery(
      (record, visibility) => {
        assertCompetitionPublished(visibility);
        assertFinalResultsPublished(visibility);
        return buildPublicFinalResultsProjection(record);
      },
      query,
      PUBLIC_QUERY.FINAL_RESULTS
    );
  }

  async function getPublicArchiveState(query = {}) {
    return runQuery(
      (record, visibility) => {
        assertCompetitionPublished(visibility);
        assertArchiveVisible(visibility);
        return buildPublicArchiveProjection(record);
      },
      query,
      PUBLIC_QUERY.ARCHIVE
    );
  }

  async function getPublicCompetitionExperience(query = {}) {
    return runQuery(
      (record, visibility) => {
        assertCompetitionPublished(visibility);
        return buildPublicCompetitionExperienceProjection(record);
      },
      query,
      PUBLIC_QUERY.FULL_EXPERIENCE
    );
  }

  /**
   * Seed / replace published snapshot (tests + integrator adapters).
   * Not an Organizer command — public store write only.
   */
  function putPublishedCompetitionSnapshot(command = {}) {
    const { tenantId, competitionId } = requirePublicScope(command);
    if (!command.snapshot || typeof command.snapshot !== "object") {
      failPublic(
        PUBLIC_ERROR_CODE.INVALID_INPUT,
        "snapshot object is required",
        {}
      );
    }
    const record = store.put(tenantId, competitionId, command.snapshot);
    return deepFreeze({
      ok: true,
      tenantId,
      competitionId,
      revision: record.revision,
      projectionFingerprint: computePublicFingerprint(
        { tenantId, competitionId, revision: record.revision },
        "e2e05-put"
      ),
    });
  }

  return Object.freeze({
    kind: "public-competition-experience-facade",
    phase: E2E05_PUBLIC_EXPERIENCE_PHASE,
    version: E2E05_PUBLIC_EXPERIENCE_VERSION,
    wiredToProductionRuntime: false,
    ownsEngines: false,
    store,
    getPublicCompetitionOverview,
    getPublicParticipants,
    getPublicSchedule,
    getPublicPools,
    getPublicStandings,
    getPublicQualification,
    getPublicBracket,
    getPublicMatchCenter,
    getPublicFinalResults,
    getPublicArchiveState,
    getPublicCompetitionExperience,
    putPublishedCompetitionSnapshot,
  });
}

/**
 * Convenience read helper matching Organizer naming style.
 * @param {object} query
 * @param {object} [deps]
 */
export async function getPublicCompetitionExperienceState(query, deps = {}) {
  const facade = createPublicCompetitionExperienceFacade(deps);
  return facade.getPublicCompetitionExperience(query);
}
