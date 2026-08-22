export {
  OFFICIAL_OPEN_ADAPTER_B_ID,
  OFFICIAL_OPEN_ADAPTER_B_VERSION,
  SHARED_CONTRACT_CAPABILITY_GAP,
  SHARED_REFEREE_CONTRACT_CAPABILITY_GAP,
  COURT_SHARED_RUNTIME_GAP,
  EXTERNAL_DEPENDENCY,
  TEMPORARY_COMPATIBILITY_NONCANONICAL,
  ADAPTER_B_STATUS,
  BYPASS_CLASSIFICATION,
} from "./constants.js";

export {
  isOfficialOpenTournament,
  isOpenMode,
  isAiBalanceMode,
  shouldActivateOfficialOpenRating,
  shouldActivateOfficialOpenMembership,
  shouldActivateOfficialOpenRanking,
  shouldActivateOfficialOpenFederation,
  ratingMayInfluencePairing,
  ratingMayInfluenceOpenPairingOrDraw,
} from "./activation.js";

export {
  resolveOfficialOpenTenantScope,
  resolveOfficialOpenTenantIdOrEmpty,
  distinguishOfficialOpenScopeIds,
} from "./tenant.js";

export { createOfficialTournamentRefereeAdapter } from "./officialTournamentRefereeAdapter.js";

export {
  buildOfficialOpenCompetitionRulesProfile,
} from "./buildOfficialOpenCompetitionRulesProfile.js";

export {
  createOfficialOpenCompetitionRulesSurface,
  resolveOfficialEffectiveCapability,
  OFFICIAL_CLASSIC_EXECUTION_BINDING,
} from "./officialOpenCompetitionRules.js";

export {
  OFFICIAL_CORE16_LIVE_SCORING_BINDING_ID,
  OFFICIAL_CORE16_LIVE_SCORING_BINDING_VERSION,
  OFFICIAL_SIDEOUT_EXECUTION_BINDING,
  OFFICIAL_SIDEOUT_EXECUTION_BINDING_GAP,
  OFFICIAL_WIN_BY_EXECUTION_BINDING,
  OFFICIAL_WIN_BY_EXECUTION_BINDING_GAP,
  OFFICIAL_CHANGE_END_EXECUTION_BINDING,
  OFFICIAL_CHANGE_END_EXECUTION_BINDING_GAP,
  OFFICIAL_RALLY_EXECUTION_BINDING,
  SCORING_PERSISTENCE_SSOT,
  CLASSIC_LIVE_SCORE_WRITER_ROLE,
  resolveOfficialCore16ScoringFormat,
  createOfficialCore16LiveScoringSession,
  applyOfficialCore16RallyOutcome,
  undoOfficialCore16LastPoint,
  confirmOfficialCore16ChangeEnds,
  assertOfficialCore16TerminalForCommit,
  projectOfficialCore16ScoringState,
  buildOfficialCore16RulesEnvelopeFromTournament,
  encodeOfficialCore16RulesQuery,
  parseOfficialCore16RulesQuery,
  buildOfficialRefereeUrlWithCore16Rules,
  getOfficialCore16ExecutionBindingTruth,
} from "./officialOpenCore16LiveScoringBinding.js";

export { listOfficialOpenEligibleCourts } from "./court.js";

export {
  createOfficialOpenAdapterB,
  getOfficialOpenAdapterB,
  __resetOfficialOpenAdapterBForTests,
} from "./createOfficialOpenAdapterB.js";

export {
  evaluateOfficialOpenManageAccess,
  evaluateOfficialOpenReopenAccess,
  isOfficialOpenManageTarget,
  buildOfficialOpenEligibilityOptions,
} from "./consume.js";

export {
  OFFICIAL_OPEN_DIRECT_DOMAIN_INVENTORY,
  summarizeOfficialOpenBypassInventory,
} from "./inventory.js";
