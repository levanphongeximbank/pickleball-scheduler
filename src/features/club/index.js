export { CLUB_MEMBER_ROLES, CLUB_MEMBER_ROLE_LABELS, CLUB_MEMBER_STATUSES } from "./constants/clubMemberRoles.js";
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
  canApproveClubMembershipRequests,
  canManageClubGovernance,
  assignClubOwner,
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
  reclaimLocalPresidentClubForUser,
  listLocalPresidentClubsForUser,
  canTransferClubOwnership,
  transferClubOwnership,
  transferClubPresident,
  assignClubVicePresident,
  setClubVicePresidents,
  listClubGovernanceCandidates,
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
  addMemberToClub,
  removeMemberFromClub,
  updateClubMemberRole,
  updateClubMemberStatus,
} from "./services/clubMemberService.js";

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
} from "./services/clubTournamentBridge.js";

export {
  getClubTournaments,
  createClubInternalTournament,
  getClubInternalTournamentPlayerPool,
  getClubInternalTournamentPlayers,
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
  rpcV2ClubAssignOwner,
  rpcV2ClubClearOwner,
  rpcV2ClubTransferPresident,
  rpcV2ClubLeaveMembership,
  rpcV2GetMyActiveMembership,
  mapV2ClubToUiClub,
} from "./services/clubStorageV2RpcService.js";

export {
  resolveMyActiveClubMembership,
  hasClubFromProfileFields,
  canShowCreateClub,
  canShowLeaveClub,
  stripLegacyProfileClubFields,
} from "./services/clubActiveMembershipService.js";

export { ensureStorageSchemaV42 } from "./storage/storageSchemaV42.js";

export { pullClubRegistryForUser, mergeClubsIntoLocal, cloudRowToClubRecord, syncClubRegistryForUser, pushPendingLocalClubsToCloud, listLocalClubsEligibleForCloudPush } from "./services/clubRegistryCloudSync.js";
export { persistClubToCloud, syncClubsForVenueToCloud } from "./services/clubRegistryCloudService.js";

export {
  PLATFORM_ATHLETE_LINK_STATUS,
  isPlatformAthleteViewer,
  getClubPlayersPlatformWide,
  buildOrphanProfileAthletes,
  getPlatformAthletes,
} from "./services/platformAthleteService.js";
