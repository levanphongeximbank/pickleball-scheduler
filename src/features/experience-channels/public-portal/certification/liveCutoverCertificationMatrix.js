/**
 * EC-06 — Frozen Public Portal LIVE cutover certification matrix.
 *
 * Only CERTIFIED_LIVE_CUTOVER rows may remove mock fallback / claim production
 * remote LIVE cutover. This inventory is intentionally empty for runtime
 * cutovers: no surface currently proves a certified remote public source under
 * all twelve EC-06 gates without backend/contract changes.
 */

import { deepFreeze } from "../../contracts/shared.js";
import { PUBLIC_PORTAL_SURFACE_ID, PUBLIC_PORTAL_BOUNDARY_ID } from "../constants/surfaceIds.js";
import { PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION } from "../constants/liveCutoverClassifications.js";

/** Mirrors publicHomeDataSource PUBLIC_HOME_SECTION_ID — no runtime import. */
const HOME_SECTION = Object.freeze({
  STATS: "home-stats",
  FEATURED_TOURNAMENTS: "home-featured-tournaments",
  LIVE_SCORES: "home-live-scores",
  SCHEDULE: "home-schedule",
  RESULTS: "home-results",
  FEATURED_CLUBS: "home-featured-clubs",
  FEATURED_COURTS: "home-featured-courts",
  UPCOMING_EVENTS: "home-upcoming-events",
  NEWS: "home-news",
  SPONSORS: "home-sponsors",
});

const C = PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION;

/**
 * Twelve EC-06 certification gates (evidence shorthand).
 * @typedef {Object} LiveCutoverGateEvidence
 * @property {boolean} remotePublicSource
 * @property {boolean} noPrivateAuthOrTenant
 * @property {boolean} stableCanonicalAdapter
 * @property {boolean} errorNotEmptySuccess
 * @property {boolean} noMockFallbackOnLiveFail
 * @property {boolean} distinctPresentationStates
 * @property {boolean} noSensitivePayload
 * @property {boolean} noBusinessLogicInUi
 * @property {boolean} targetedTests
 * @property {boolean} clearOwnership
 * @property {boolean} productionReadyEvidence
 * @property {boolean} noEngineOrBackendContractChange
 */

/**
 * @param {Partial<LiveCutoverGateEvidence>} overrides
 * @returns {Readonly<LiveCutoverGateEvidence>}
 */
function gates(overrides = {}) {
  return deepFreeze({
    remotePublicSource: false,
    noPrivateAuthOrTenant: true,
    stableCanonicalAdapter: true,
    errorNotEmptySuccess: true,
    noMockFallbackOnLiveFail: false,
    distinctPresentationStates: true,
    noSensitivePayload: true,
    noBusinessLogicInUi: true,
    targetedTests: true,
    clearOwnership: true,
    productionReadyEvidence: false,
    noEngineOrBackendContractChange: true,
    ...overrides,
  });
}

/**
 * @typedef {Object} LiveCutoverMatrixRow
 * @property {string} id
 * @property {string} kind
 * @property {string} classification
 * @property {string} liveSourceSummary
 * @property {boolean} allowMockFallbackRetained
 * @property {boolean} implementCutover
 * @property {Readonly<LiveCutoverGateEvidence>} gates
 * @property {string} rationale
 */

/** @type {ReadonlyArray<Readonly<LiveCutoverMatrixRow>>} */
export const PUBLIC_PORTAL_LIVE_CUTOVER_MATRIX = deepFreeze([
  {
    id: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    kind: "surface",
    classification: C.NO_REMOTE_SOURCE,
    liveSourceSummary:
      "Browser local club registry + club blob (loadClubs/loadClubData) — not a remote public catalog API.",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noMockFallbackOnLiveFail: false,
      productionReadyEvidence: false,
    }),
    rationale:
      "Gate 1 fails: no certified remote public clubs source. Mock fallback retained with MIXED honesty (EC-03).",
  },
  {
    id: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS,
    kind: "surface",
    classification: C.NO_REMOTE_SOURCE,
    liveSourceSummary:
      "Derived from local club blob courts/hours — not a remote public venues API.",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noMockFallbackOnLiveFail: false,
      productionReadyEvidence: false,
    }),
    rationale:
      "Gate 1 fails: no certified remote public courts source. Mock fallback retained (EC-03).",
  },
  {
    id: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS,
    kind: "surface",
    classification: C.NO_REMOTE_SOURCE,
    liveSourceSummary:
      "Local club blob tournaments mapped for list presentation — not a remote public tournament feed.",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noMockFallbackOnLiveFail: false,
      productionReadyEvidence: false,
    }),
    rationale:
      "Gate 1 fails: no certified remote public tournaments source. Mock fallback retained (EC-04).",
  },
  {
    id: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS,
    kind: "surface",
    classification: C.LIVE_SOURCE_NOT_CERTIFIED,
    liveSourceSummary:
      "VPR flag off → explicit MOCK; flag on → local VPR leaderboard store (not remote public RPC).",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noMockFallbackOnLiveFail: false,
      productionReadyEvidence: false,
      noEngineOrBackendContractChange: true,
    }),
    rationale:
      "Live path exists when VPR enabled but is local-store, not certified remote. Mock retained; ranking engines untouched (EC-04).",
  },
  {
    id: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_HOME,
    kind: "surface",
    classification: C.LIVE_SOURCE_NOT_CERTIFIED,
    liveSourceSummary:
      "Composite Home: featured lists reuse EC-03/04 local adapters; hub sections mock; news projects NEWS-04.",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noMockFallbackOnLiveFail: false,
      productionReadyEvidence: false,
    }),
    rationale:
      "Home is not a single remote source. Section rows below govern cutover eligibility. No whole-Home LIVE cutover.",
  },
  {
    id: HOME_SECTION.STATS,
    kind: "home-section",
    classification: C.NO_REMOTE_SOURCE,
    liveSourceSummary: "Local club blob aggregate counters or MOCK when no clubs.",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({ remotePublicSource: false, productionReadyEvidence: false }),
    rationale: "No remote public stats feed.",
  },
  {
    id: HOME_SECTION.FEATURED_TOURNAMENTS,
    kind: "home-section",
    classification: C.NO_REMOTE_SOURCE,
    liveSourceSummary: "Projection of EC-04 getPublicTournamentsResult.",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({ remotePublicSource: false, noMockFallbackOnLiveFail: false }),
    rationale: "Inherits uncertified tournaments source.",
  },
  {
    id: HOME_SECTION.FEATURED_CLUBS,
    kind: "home-section",
    classification: C.NO_REMOTE_SOURCE,
    liveSourceSummary: "Projection of EC-03 getPublicClubsResult.",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({ remotePublicSource: false, noMockFallbackOnLiveFail: false }),
    rationale: "Inherits uncertified clubs source.",
  },
  {
    id: HOME_SECTION.FEATURED_COURTS,
    kind: "home-section",
    classification: C.NO_REMOTE_SOURCE,
    liveSourceSummary: "Projection of EC-03 getPublicCourtsResult.",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({ remotePublicSource: false, noMockFallbackOnLiveFail: false }),
    rationale: "Inherits uncertified courts source.",
  },
  {
    id: HOME_SECTION.LIVE_SCORES,
    kind: "home-section",
    classification: C.MOCK_WITH_HONEST_PROVENANCE,
    liveSourceSummary: "MOCK_LIVE_SCORES only.",
    allowMockFallbackRetained: false,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noMockFallbackOnLiveFail: true,
      productionReadyEvidence: false,
      stableCanonicalAdapter: true,
    }),
    rationale: "Honest MOCK (EC-05). No remote live-scores source to cut over.",
  },
  {
    id: HOME_SECTION.SCHEDULE,
    kind: "home-section",
    classification: C.MOCK_WITH_HONEST_PROVENANCE,
    liveSourceSummary: "MOCK_SCHEDULE only.",
    allowMockFallbackRetained: false,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noMockFallbackOnLiveFail: true,
      productionReadyEvidence: false,
    }),
    rationale: "Honest MOCK (EC-05).",
  },
  {
    id: HOME_SECTION.RESULTS,
    kind: "home-section",
    classification: C.MOCK_WITH_HONEST_PROVENANCE,
    liveSourceSummary: "MOCK_RESULTS only.",
    allowMockFallbackRetained: false,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noMockFallbackOnLiveFail: true,
      productionReadyEvidence: false,
    }),
    rationale: "Honest MOCK (EC-05).",
  },
  {
    id: HOME_SECTION.UPCOMING_EVENTS,
    kind: "home-section",
    classification: C.MOCK_WITH_HONEST_PROVENANCE,
    liveSourceSummary: "MOCK_UPCOMING_EVENTS only.",
    allowMockFallbackRetained: false,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noMockFallbackOnLiveFail: true,
      productionReadyEvidence: false,
    }),
    rationale: "Honest MOCK (EC-05).",
  },
  {
    id: HOME_SECTION.SPONSORS,
    kind: "home-section",
    classification: C.MOCK_WITH_HONEST_PROVENANCE,
    liveSourceSummary: "MOCK_SPONSORS only.",
    allowMockFallbackRetained: false,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noMockFallbackOnLiveFail: true,
      productionReadyEvidence: false,
    }),
    rationale: "Honest MOCK (EC-05).",
  },
  {
    id: HOME_SECTION.NEWS,
    kind: "home-section",
    classification: C.ALREADY_LIVE_NO_CHANGE,
    liveSourceSummary:
      "NEWS-04 projectHomeNewsSection — remote RPC via getPublicNews; no silent mock fallback.",
    allowMockFallbackRetained: false,
    implementCutover: false,
    gates: gates({
      remotePublicSource: true,
      noMockFallbackOnLiveFail: true,
      productionReadyEvidence: false,
      distinctPresentationStates: true,
    }),
    rationale:
      "Remote live path already honest (NEWS-04). Production deploy/certification evidence incomplete — no EC-06 cutover change.",
  },
  {
    id: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_NEWS,
    kind: "surface",
    classification: C.ALREADY_LIVE_NO_CHANGE,
    liveSourceSummary:
      "getPublicNews → News facade → news_public_content_query_public (anon). Explicit MOCK/PREVIEW only.",
    allowMockFallbackRetained: false,
    implementCutover: false,
    gates: gates({
      remotePublicSource: true,
      noPrivateAuthOrTenant: true,
      stableCanonicalAdapter: true,
      errorNotEmptySuccess: true,
      noMockFallbackOnLiveFail: true,
      distinctPresentationStates: true,
      noSensitivePayload: true,
      noBusinessLogicInUi: true,
      targetedTests: true,
      clearOwnership: true,
      productionReadyEvidence: false,
      noEngineOrBackendContractChange: true,
    }),
    rationale:
      "Already LIVE without silent mock fallback (NEWS-04). Gate 11 fails for EC-06 productionReady cutover claim (Production not certified/deployed). No adapter change.",
  },
  {
    id: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_ROOT,
    kind: "surface",
    classification: C.HIGH_COLLISION_DEFERRED,
    liveSourceSummary: "Auth redirect / Home guest render — shell/PWA collision surface.",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noPrivateAuthOrTenant: false,
      productionReadyEvidence: false,
      targetedTests: false,
    }),
    rationale: "Out of EC-06 cutover scope; PublicRoot/shell remain high-collision.",
  },
  {
    id: PUBLIC_PORTAL_BOUNDARY_ID.TOURNAMENT_PUBLIC_VIEW,
    kind: "boundary",
    classification: C.HIGH_COLLISION_DEFERRED,
    liveSourceSummary: "Tournament Ops / Competition public detail — not Public Portal list.",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noBusinessLogicInUi: false,
      productionReadyEvidence: false,
      noEngineOrBackendContractChange: false,
    }),
    rationale: "DEFERRED — Competition/Tournament Ops ownership. No Public Portal cutover.",
  },
  {
    id: PUBLIC_PORTAL_BOUNDARY_ID.ATHLETES_DIRECTORY,
    kind: "boundary",
    classification: C.HIGH_COLLISION_DEFERRED,
    liveSourceSummary: "Authenticated player directory — not anonymous Public Portal.",
    allowMockFallbackRetained: true,
    implementCutover: false,
    gates: gates({
      remotePublicSource: false,
      noPrivateAuthOrTenant: false,
      productionReadyEvidence: false,
    }),
    rationale: "Not anonymous Public Portal; deferred.",
  },
]);

/**
 * @returns {ReadonlyArray<Readonly<LiveCutoverMatrixRow>>}
 */
export function listPublicPortalLiveCutoverMatrix() {
  return PUBLIC_PORTAL_LIVE_CUTOVER_MATRIX;
}

/**
 * @param {unknown} id
 * @returns {Readonly<LiveCutoverMatrixRow> | null}
 */
export function getPublicPortalLiveCutoverRow(id) {
  const key = String(id ?? "").trim();
  return PUBLIC_PORTAL_LIVE_CUTOVER_MATRIX.find((row) => row.id === key) ?? null;
}

/**
 * @returns {ReadonlyArray<Readonly<LiveCutoverMatrixRow>>}
 */
export function listCertifiedLiveCutoverRows() {
  return deepFreeze(
    PUBLIC_PORTAL_LIVE_CUTOVER_MATRIX.filter(
      (row) => row.classification === C.CERTIFIED_LIVE_CUTOVER && row.implementCutover === true
    )
  );
}
