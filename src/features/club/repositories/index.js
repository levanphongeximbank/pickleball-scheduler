export {
  CANONICAL_REPOSITORY_FLAG_KEYS,
  isCanonicalClubRepositoryEnabled,
  isCanonicalPlayerRepositoryEnabled,
  readCanonicalFlag,
} from "../config/canonicalRepositoryFlags.js";

export {
  CANONICAL_SOURCE,
  CANONICAL_WARNING_CODE,
  LOCAL_DEFAULT_CLUB_ID,
  MAPPING_STATUS,
  buildDerivedAuthPlayerId,
  buildRepoError,
  buildRepoResult,
  emptyMappingSummary,
  isLocalDefaultClub,
} from "./canonicalRepositoryTypes.js";

export {
  canonicalClubRepository,
  createCanonicalClubRepository,
} from "./canonicalClubRepository.js";

export {
  canonicalMembershipRepository,
  createCanonicalMembershipRepository,
  dedupeMembershipHistory,
  resolveMembershipStatus,
} from "./canonicalMembershipRepository.js";

export {
  canonicalPlayerRepository,
  createCanonicalPlayerRepository,
  normalizePlayerRecord,
  resolvePlayerForMembership,
  resolvePlayerForProfile,
} from "./canonicalPlayerRepository.js";
