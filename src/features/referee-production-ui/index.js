export {
  REFEREE_PRODUCTION_UI_ID,
  COURT_ORIENTATION,
  COURT_SLOT,
  ASSIGNMENT_CARD_ACTION,
  ASSIGNMENT_CARD_ACTION_LABEL,
  RESULT_STATUS,
  CANONICAL_UI_COMMAND,
  REFEREE_UI_ERROR_CODE,
} from "./constants.js";

export { projectResultStatus } from "./projection/resultStatus.js";
export {
  formatScoringPolicyLabel,
  formatCanonicalScoreLine,
} from "./projection/formatScoringPolicyLabel.js";
export { resolveAssignmentAction } from "./projection/resolveAssignmentAction.js";
export { projectDreamBreakerRotation } from "./projection/projectDreamBreakerRotation.js";
export { projectCanonicalCourtView } from "./projection/projectCanonicalCourtView.js";
export { buildRefereeAssignmentCard } from "./projection/buildRefereeAssignmentCard.js";
export { buildRefereeMatchView } from "./projection/buildRefereeMatchView.js";

export { createCanonicalRefereeApplicationClient } from "./application/createCanonicalRefereeApplicationClient.js";
export { createBrowserRefereeApplicationClient } from "./application/createBrowserRefereeApplicationClient.js";
export { createAuthenticatedRefereeCommandTransport } from "./application/createAuthenticatedRefereeCommandTransport.js";
export { createTrustedRefereeBackend } from "./application/createTrustedRefereeBackend.js";
export {
  resolveCanonicalRefereeModeState,
  detectCompetitionModeHint,
} from "./application/resolveCanonicalRefereeModeState.js";
export {
  assertRefereeUiSecurity,
  assertNotPrivilegedBrowserComposition,
} from "./application/assertProductionUiSecurity.js";
export { isRefereeWorkspaceRoute } from "./application/isRefereeWorkspaceRoute.js";

export {
  formatCompetitionModeLabel,
  formatAssignmentStatusLabel,
  formatLocalScheduledTime,
  formatCourtLabel,
  formatCompetitionDisplayName,
} from "./projection/formatRefereeUiLabels.js";

export { useCanonicalRefereeHome } from "./hooks/useCanonicalRefereeHome.js";
export { useCanonicalRefereeMatch } from "./hooks/useCanonicalRefereeMatch.js";

export { default as RefereeHome } from "./components/RefereeHome.jsx";
export { default as RefereeMatchScreen } from "./components/RefereeMatchScreen.jsx";
export { default as CanonicalCourtView } from "./components/CanonicalCourtView.jsx";
export { default as RefereeAssignmentCard } from "./components/RefereeAssignmentCard.jsx";
export { default as RefereeCompactChrome } from "./components/RefereeCompactChrome.jsx";
