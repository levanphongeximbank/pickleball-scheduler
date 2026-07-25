export {
  NEWS_EDITORIAL_CAPABILITY,
  NEWS_EDITORIAL_CAPABILITY_VALUES,
  NEWS_PERMISSION,
  NEWS_AUTH_ACTOR_KIND,
  NEWS_AUTH_DECISION,
  NEWS_CAPABILITY_PERMISSION_MAP,
  getNews02CapabilityMatrix,
} from "./capabilityMatrix.js";

export {
  authorizeNewsEditorialCapability,
  assertNewsEditorialCapability,
  rejectActorSpoofing,
} from "./editorialAuthorize.js";
