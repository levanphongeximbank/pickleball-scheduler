export {
  CONTENT_TYPE,
  CONTENT_TYPE_VALUES,
  isContentType,
} from "./contentTypes.js";

export {
  CONTENT_SCOPE,
  CONTENT_SCOPE_VALUES,
  isContentScope,
} from "./contentScopes.js";

export {
  EDITORIAL_STATUS,
  EDITORIAL_STATUS_VALUES,
  EDITORIAL_TERMINAL_STATUSES,
  EDITORIAL_ALLOWED_TRANSITIONS,
  isEditorialStatus,
  isEditorialTransitionAllowed,
} from "./editorialLifecycle.js";

export {
  CONTENT_PROVENANCE,
  CONTENT_PROVENANCE_VALUES,
  isContentProvenance,
} from "./provenance.js";

export {
  PUBLIC_VISIBILITY,
  PUBLIC_VISIBILITY_VALUES,
  isPublicVisibility,
  isPubliclyReadableVisibility,
} from "./publicVisibility.js";

export const NEWS_PUBLIC_CONTENT_PHASE = Object.freeze({
  id: "NEWS-02",
  name: "durable-persistence-sql-rls-editorial-authorization",
  priorPhase: "NEWS-01",
  hasPersistence: true,
  persistenceApplied: false,
  hasSql: true,
  sqlApplied: false,
  hasStaging: false,
  hasProduction: false,
  wiredToPublicPortal: false,
  hasSchedulerWorker: false,
  hasMediaUpload: false,
  structureComplete: true,
  productionBlocked: true,
});
