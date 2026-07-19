export {
  CLUB_MEMBER_ROLES,
  CLUB_MEMBER_ROLE_LABELS,
  CLUB_MEMBER_STATUSES,
  CLUB_MEMBER_STATUS_LABELS,
  normalizeClubMemberStatus,
  isClubMemberStatusActive,
  getClubMemberStatusLabel,
  countActiveClubMembers,
} from "./constants/clubMemberRoles.js";
export { CLUB_STATUSES, CLUB_STATUS_LABELS, DEFAULT_CLUB_ELO } from "./constants/clubStatus.js";

export {
  getClubsByTenant,
  getClubById,
  getClubStats,
  createClub,
  updateClub,
  deactivateClub,
  deleteClubSoft,
  getTenantPlayers,
  getTenantPlayersLegacy,
  getTenantPlayersAware,
} from "./services/clubTenantService.js";

export {
  getClubsVisibleToUser,
  canUserViewClub,
  filterClubsForUser,
} from "./services/clubAccessService.js";

export {
  isClubOwner,
  isClubPresident,
  isClubVicePresident,
  resolveClubGovernanceTitle,
  hasClubGovernanceManagerAccess,
  resolveGovernanceElevatedRole,
  syncGovernanceAuthRoleFromClub,
  canViewFullClubMembers,
  canViewClubMemberSummary,
  canAssignClubOwner,
  canChangeClubPresident,
  canRelinquishClubPresident,
  canDeleteClub,
  canDeleteClubMembers,
  canAddClubMembers,
  canApproveClubMembershipRequests,
  canManageClubGovernance,
  assignClubOwner,
  clearClubPresident,
  updateClubGovernance,
  getGovernanceDisplayLabels,
  fetchGovernanceNameHints,
  getRegisteredClusterLabel,
  getRegisteredCourtsLabels,
  canApproveClubRegistration,
  approveClubRegistration,
  rejectClubRegistration,
  resolveGovernanceForCreate,
  canSelfRegisterClub,
  bootstrapSelfRegisteredPresident,
  finalizeSelfRegisteredClubCloud,
  listLocalPresidentClubsForUser,
  canTransferClubOwnership,
  canShowTransferClubOwnership,
  transferClubOwnership,
  transferClubPresident,
  assignClubVicePresident,
  setClubVicePresidents,
  listClubGovernanceCandidates,
  listClubGovernanceCandidatesAsync,
  deleteClubAsOwner,
} from "./services/clubGovernanceService.js";

export {
  MAX_VICE_PRESIDENTS,
  getVicePresidentUserIds,
} from "./models/clubGovernance.js";

export {
  CLUB_ACTIVITY_DAY_LABELS,
  formatClubActivityDayLabel,
} from "./models/clubActivitySession.js";

export {
  canManageClubActivitySchedule,
  listClubActivitySessions,
  getClubActivitySessionSummary,
  getTodayClubActivitySessions,
  createClubActivitySession,
  updateClubActivitySession,
  deleteClubActivitySession,
} from "./services/clubActivityScheduleService.js";

export {
  getClubMembers,
  getClubMembersForTournamentInvite,
  mapV2MemberRowToUi,
  addMemberToClub,
  removeMemberFromClub,
  restoreMemberToClub,
  updateClubMemberRole,
  updateClubMemberStatus,
  resolveTargetUserIdForMemberCommand,
  probeClubMemberMutationAccess,
  formatMemberCommandUserError,
  isProtectedGovernanceMember,
} from "./services/clubMemberService.js";

/** Phase 2C — freeze-named membership.* / joinRequest.* ports */
export {
  membershipList,
  membershipListActiveRoster,
  membershipAdd,
  membershipRemove,
  membershipRestore,
  membershipLeave,
} from "./api/membershipApi.js";

export {
  joinRequestCreate,
  joinRequestApprove,
  joinRequestReject,
  joinRequestCancel,
  joinRequestListPending,
  joinRequestListMine,
} from "./api/joinRequestApi.js";

/** Phase 2D — freeze-named governance.* ports */
export {
  governanceGet,
  governanceAssignOwner,
  governanceClearOwner,
  governanceAssignPresident,
  governanceClearPresident,
  governanceAssignVp,
  governanceClearVp,
  governanceTransferOwnership,
} from "./api/governanceApi.js";

/** Phase 2E — canonical governance read model */
export {
  GOVERNANCE_READ_STATE,
  GOVERNANCE_ROLE_LABELS,
  GOVERNANCE_MISSING_PROFILE_LABEL,
  GOVERNANCE_UNASSIGNED_LABEL,
  GOVERNANCE_NO_VP_LABEL,
  isCanonicalGovernanceReadEnabled,
  toGovernanceReadModel,
  toGovernanceDisplayLabels,
  toGovernanceReadSnapshot,
  mapGovernanceRoleCodesToLabel,
  resolveMemberGovernanceRoleLabel,
  countUniqueActiveGovernancePersons,
  shouldRefetchGovernanceOnConflict,
  resolveGovernanceRefreshAction,
} from "./context/governanceCanonicalReadModel.js";

export {
  readClubGovernance,
  buildGovernanceReadModelFromClub,
  refreshClubGovernanceReadModel,
  hydrateGovernanceDisplayProfiles,
} from "./services/governanceReadService.js";

export { useGovernanceReadModel } from "./hooks/useGovernanceReadModel.js";

export {
  MEMBERSHIP_AUDIT_EVENTS,
  JOIN_REQUEST_AUDIT_EVENTS,
  SERVER_MEMBERSHIP_AUDIT_ALIASES,
  resolveServerMembershipAuditAction,
  resolveFreezeMembershipAuditEvents,
} from "./constants/membershipAuditEvents.js";

export {
  GOVERNANCE_AUDIT_EVENTS,
  SERVER_GOVERNANCE_AUDIT_ALIASES,
  resolveServerGovernanceAuditAction,
  resolveFreezeGovernanceAuditEvents,
} from "./constants/governanceAuditEvents.js";

export {
  CANONICAL_MEMBERSHIP_STATUSES,
  MEMBERSHIP_TRANSITIONS,
  toCanonicalMembershipStatus,
  isCanonicalMembershipActive,
  assertMembershipTransition,
  toActiveRosterMemberDto,
} from "./membership/membershipLifecycle.js";

export {
  getClubRatings,
  getPlayerClubRating,
  updateClubRating,
  createDefaultClubRatingForPlayer,
  getClubRatingHistory,
} from "./services/clubRatingService.js";

export { getClubMatches, addClubMatch } from "./services/clubMatchService.js";

export { createFriendlyClubMatch, getRecentClubActivity } from "./services/clubActivityService.js";

export {
  processClubInternalMatchCompletion,
  findTournamentClubId,
  resolveTournamentClubId,
  buildTournamentNotFoundMessage,
} from "./services/clubTournamentBridge.js";

export {
  getClubTournaments,
  createClubInternalTournament,
  getClubInternalTournamentPlayerPool,
  getClubInternalTournamentPlayers,
  getClubInternalTournamentPlayersAware,
  getTournamentParticipantPlayersAware,
} from "./services/clubTournamentService.js";

export { applyClubMatchElo, applyClubMatchEloById } from "./services/clubEloService.js";

export {
  CLUB_MEMBERSHIP_REQUEST_STATUSES,
  CLUB_MEMBERSHIP_REQUEST_STATUS_LABELS,
} from "./constants/clubMembershipRequestStatuses.js";

export {
  submitClubMembershipRequest,
  cancelClubMembershipRequest,
  listPendingMembershipRequests,
  listMyMembershipRequests,
  listJoinableClubs,
  listDiscoverableClubs,
  getClubDiscoverySummary,
  listMyMembershipRequestsAll,
  listMyMembershipRequestsCanonical,
  probeMembershipReviewAccess,
  approveClubMembershipRequest,
  rejectClubMembershipRequest,
  getMyClubSummary,
  leaveMyClub,
} from "./services/clubMembershipRequestService.js";

export { ensureClubManagementSeed } from "./seed/clubManagementSeed.js";

export { isClubRegistryCloudEnabled, isClubStorageV2Enabled } from "./config/clubRegistryFlags.js";

export {
  rpcV2ClubCreate,
  rpcV2ClubGet,
  rpcV2ClubListRegistry,
  rpcV2ClubListDiscoverable,
  rpcV2ClubListMembers,
  rpcV2ClubSubmitMembershipRequest,
  rpcV2ClubListMyRequests,
  rpcV2ClubListPendingRequests,
  rpcV2ClubCancelMembershipRequest,
  rpcV2ClubReviewMembershipRequest,
  // Phase 2D — governance RPCs are internal (clubGovernanceService / governanceApi).
  // Do not re-export raw mutating governance RPCs from the Club barrel.
  rpcV2ClubLeaveMembership,
  rpcV2ClubAddMember,
  rpcV2ClubRemoveMember,
  rpcV2ClubRestoreMember,
  rpcV2GetMyActiveMembership,
  mapV2ClubToUiClub,
} from "./services/clubStorageV2RpcService.js";

export {
  resolveMyActiveClubMembership,
  hasClubFromProfileFields,
  canShowCreateClub,
  canShowLeaveClub,
  stripLegacyProfileClubFields,
  buildMyClubSummaryFromClub,
  resolveMyClubHomeMemberCount,
  getCachedMembershipSnapshot,
  resetMyActiveClubMembershipCache,
  invalidateMyActiveClubMembershipCache,
  clearMembershipCacheForUser,
  shouldFetchMembership,
} from "./services/clubActiveMembershipService.js";

export {
  MEMBERSHIP_PHASE,
  resolveMembershipPhase,
  isMembershipPhaseReady,
  isMembershipPhasePending,
} from "./membership/membershipState.js";

export { useMyClubMembership } from "./hooks/useMyClubMembership.js";
export {
  MyClubMembershipRootProvider,
  useMyClubMembershipFromContext,
  useRequiredMyClubMembership,
} from "./hooks/MyClubMembershipContext.jsx";
export {
  resolveClubAwarePlayerHomePath,
  resolvePostAuthClubPath,
  resolvePostLoginClubPath,
  resolveDirectMyClubPath,
} from "./routing/clubLandingResolver.js";
export {
  CLUB_ROUTE_PATHS,
  MY_CLUB_MEMBER_VIEWS,
  CLUB_LANDING_STATE,
  resolveClubLandingState,
  resolveClubLandingRedirect,
  resolveLegacyMyClubQueryRedirect,
  resolveMyClubMemberView,
  shouldRedirectMyClubToDiscover,
  isClubRouteRedirectLoop,
  markClubRouteRedirect,
  clearClubRouteRedirectLoop,
} from "./routing/clubMembershipRouteLogic.js";

export { ensureStorageSchemaV42 } from "./storage/storageSchemaV42.js";

export { pullClubRegistryForUser, mergeClubsIntoLocal, cloudRowToClubRecord, syncClubRegistryForUser, pushPendingLocalClubsToCloud, listLocalClubsEligibleForCloudPush } from "./services/clubRegistryCloudSync.js";
// Phase 45A.3F — persistClubToCloud / syncClubsForVenueToCloud are not part of the
// public Club command surface. Import from clubRegistryCloudService or
// clubOfflineCommandAdapter only for V2-OFF rollback.

export {
  CLUB_REGISTRY_SCOPE,
  buildClubRegistryCacheKey,
  invalidateClubRegistryCache,
  invalidateAllClubRegistryCache,
} from "./registry/clubRegistryCache.js";

export {
  normalizeRegistryRow,
  filterRegistryRows,
  fetchTenantClubRegistry,
  fetchPlatformClubRegistry,
  assertTenantRegistryAccess,
  assertPlatformRegistryAccess,
  paginateRegistryRows,
} from "./services/clubRegistryService.js";

export { useCanReviewMembership } from "./hooks/useCanReviewMembership.js";
export { canReviewMembershipForClub } from "./services/clubGovernanceService.js";
export {
  buildClubNavContext,
  isClubNavItemVisible,
  resolveMyClubTabVisibility,
  CLUB_NAV_GATED_KEYS,
  CLUB_NAV_ITEM_KEYS,
} from "./navigation/clubNavMatrix.js";
export { useClubMenuScope } from "./navigation/useClubMenuScope.js";

export {
  PLATFORM_ATHLETE_LINK_STATUS,
  isPlatformAthleteViewer,
  getClubPlayersPlatformWide,
  getClubPlayersPlatformWideAware,
  buildOrphanProfileAthletes,
  getPlatformAthletes,
  resolveMembershipAuthUserId,
} from "./services/platformAthleteService.js";

export {
  resolveV2AthleteProfile,
  isAccountOnlyByV2Data,
  pickPrimaryMembership,
} from "./services/resolveV2AthleteProfileService.js";

export * from "./ui/index.js";
