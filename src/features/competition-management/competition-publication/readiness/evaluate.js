/**
 * Publication readiness evaluation (CM-06).
 *
 * Fail-closed gate that runs before any CompetitionPublication record is
 * created. Structural/contract violations (missing identifiers, unknown
 * profile/channel, mismatched source references, external lifecycle block)
 * return a hard `validationFail`. Once all inputs are structurally valid and
 * correctly scoped, remaining semantic readiness (branding publication-facing
 * baseline) is reported as `issues` with a `ready` outcome flag — mirroring
 * CM-05's readiness shape. No network calls. No publish. No persistence.
 */

import { evaluateCompetitionBrandingReadiness } from "../../competition-branding/index.js";
import { COMPETITION_PUBLICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { COMPETITION_PUBLICATION_SEVERITY } from "../constants/severity.js";
import {
  COMPETITION_PUBLICATION_SEMANTIC_STATE,
} from "../constants/status.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import { deepFreeze, isNonEmptyString, compareFieldPath } from "../contracts/shared.js";
import {
  collectProfileErrors,
  collectChannelErrors,
  collectVersionSourceErrors,
  collectDefinitionMatchErrors,
  collectConfigurationErrors,
  collectBrandingErrors,
  collectChannelVisibilityErrors,
  collectExternalLifecycleBlockErrors,
} from "../contracts/publication.js";
import { getCompetitionPublicationProfile } from "../profiles/index.js";

/**
 * @param {string} path
 * @param {string} code
 * @param {string} severity
 * @param {string} message
 * @param {object} [details]
 */
function createIssue(path, code, severity, message, details = {}) {
  return deepFreeze({ path, code, severity, message, details });
}

/**
 * @param {object} [command]
 * @returns {import("../contracts/validation.js").CompetitionPublicationValidationResult}
 */
export function evaluateCompetitionPublicationReadiness(command = {}) {
  const snap = snapshotInput(command);
  void snap;

  const cmd = command && typeof command === "object" ? command : {};

  /** @type {object[]} */
  const structuralErrors = [];

  if (!isNonEmptyString(cmd.tenantId)) {
    structuralErrors.push(
      createFieldError(
        "tenantId",
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    structuralErrors.push(
      createFieldError(
        "competitionId",
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  structuralErrors.push(...collectChannelErrors(cmd.channel));
  structuralErrors.push(...collectProfileErrors(cmd.profileId));

  if (structuralErrors.length > 0) {
    return validationFail(structuralErrors);
  }

  const tenantId = String(cmd.tenantId).trim();
  const competitionId = String(cmd.competitionId).trim();
  const profile = getCompetitionPublicationProfile(cmd.profileId);

  structuralErrors.push(
    ...collectVersionSourceErrors(cmd.competitionVersion, {
      tenantId,
      competitionId,
      expectedSourceVersionId: cmd.expectedSourceVersionId,
      expectedSourceVersionNumber: cmd.expectedSourceVersionNumber,
    })
  );
  structuralErrors.push(
    ...collectDefinitionMatchErrors(cmd.definition, cmd.competitionVersion, {
      tenantId,
      competitionId,
      expectedDefinitionRevision: cmd.expectedDefinitionRevision,
    })
  );
  structuralErrors.push(
    ...collectConfigurationErrors(
      cmd.configurationPresence,
      cmd.configuration,
      cmd.expectedConfigurationRevision,
      { tenantId, competitionId }
    )
  );
  structuralErrors.push(
    ...collectBrandingErrors(cmd.branding, cmd.expectedBrandingRevision, {
      tenantId,
      competitionId,
    })
  );
  structuralErrors.push(...collectExternalLifecycleBlockErrors(cmd.externalLifecycleBlock));

  if (
    cmd.definition &&
    typeof cmd.definition === "object" &&
    isNonEmptyString(/** @type {any} */ (cmd.definition).visibility)
  ) {
    structuralErrors.push(
      ...collectChannelVisibilityErrors(cmd.channel, /** @type {any} */ (cmd.definition).visibility)
    );
  }

  if (structuralErrors.length > 0) {
    return validationFail(structuralErrors);
  }

  /** @type {object[]} */
  const issues = [];

  const brandingReadiness = evaluateCompetitionBrandingReadiness({
    branding: cmd.branding,
    profile: profile.brandingReadinessProfile,
  });

  if (!brandingReadiness.ok) {
    return validationFail([
      createFieldError(
        "branding",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_BRANDING,
        "branding failed CM-05 readiness evaluation unexpectedly",
        {}
      ),
    ]);
  }

  const brandingValue = brandingReadiness.value;
  for (const bIssue of brandingValue.issues) {
    issues.push(
      createIssue(`branding.${bIssue.path}`, bIssue.code, bIssue.severity, bIssue.message, bIssue.details || {})
    );
  }
  if (!brandingValue.ready) {
    issues.push(
      createIssue(
        "branding",
        COMPETITION_PUBLICATION_ERROR_CODE.BRANDING_NOT_READY,
        COMPETITION_PUBLICATION_SEVERITY.ERROR,
        `branding is not ready for the ${profile.brandingReadinessProfile} publication profile`,
        { brandingErrorCount: brandingValue.errorCount }
      )
    );
  }

  issues.sort((a, b) => {
    const byPath = compareFieldPath(a.path, b.path);
    if (byPath !== 0) return byPath;
    const bySev = String(a.severity).localeCompare(String(b.severity), "en");
    if (bySev !== 0) return bySev;
    return String(a.code).localeCompare(String(b.code), "en");
  });

  const errorCount = issues.filter(
    (i) => i.severity === COMPETITION_PUBLICATION_SEVERITY.ERROR
  ).length;
  const ready = errorCount === 0;
  const outcome = ready
    ? COMPETITION_PUBLICATION_SEMANTIC_STATE.READY
    : COMPETITION_PUBLICATION_SEMANTIC_STATE.NOT_READY;

  const result = deepFreeze({
    tenantId,
    competitionId,
    channel: cmd.channel,
    profileId: cmd.profileId,
    ready,
    outcome,
    issueCount: issues.length,
    errorCount,
    issues: Object.freeze(issues),
    networkCallsPerformed: 0,
    published: false,
    externalLifecycleBlocked: false,
  });

  return validationOk(result, {
    summary: ready
      ? `Competition publication readiness PASS (channel=${cmd.channel}, profile=${cmd.profileId}).`
      : `Competition publication readiness FAIL (channel=${cmd.channel}, profile=${cmd.profileId}, ${errorCount} errors).`,
    reasons: Object.freeze([
      `outcome=${outcome}`,
      `issueCount=${issues.length}`,
      "noNetwork",
      "noPublish",
      "noSourceMutation",
    ]),
  });
}
