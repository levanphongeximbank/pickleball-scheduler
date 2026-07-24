/**
 * Application commands for Competition Publication (CM-06).
 *
 * Pure / capability-local: does not mutate the CM-01 definition, CM-04
 * configuration, or CM-05 branding it reads, does not create CM-03 versions,
 * does not touch Competition Core, does not deploy/activate routes, does not
 * send notifications, and does not persist audit records. Fail-closed.
 */

import { COMPETITION_PUBLICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { COMPETITION_PUBLICATION_STATUS } from "../constants/status.js";
import { COMPETITION_PUBLICATION_SEVERITY } from "../constants/severity.js";
import {
  COMPETITION_PUBLICATION_INITIAL_REVISION,
  isValidExpectedCurrentPublicationRevision,
} from "../constants/revision.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import {
  isNonEmptyString,
  canonicalizeJson,
  clonePlain,
  deepFreeze,
} from "../contracts/shared.js";
import { createCompetitionPublicationId } from "../contracts/identity.js";
import { parseRequestedPublicReference } from "../contracts/slug.js";
import {
  collectChannelErrors,
  collectProfileErrors,
  buildCompetitionPublicationRecord,
  computePublicationRequestFingerprint,
} from "../contracts/publication.js";
import { buildSourceReferences } from "../contracts/source.js";
import { getCompetitionPublicationProfile } from "../profiles/index.js";
import { getCompetitionPublicationChannelDescriptor } from "../channels/registry.js";
import { evaluateCompetitionPublicationReadiness } from "../readiness/index.js";
import { buildCompetitionPublicationManifest } from "../manifest/index.js";
import { buildCompetitionPublicationPlan } from "../planning/index.js";
import { createInMemoryCompetitionPublicationRepository } from "../repository/index.js";

/**
 * @param {object} [options]
 * @returns {{ ok: true, repository: object } | { ok: false, result: object }}
 */
function requireRepository(options = {}) {
  if (options.repository) {
    return { ok: true, repository: options.repository };
  }
  return {
    ok: false,
    result: validationFail([
      createFieldError(
        "repository",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_CONTRACT,
        "explicit capability-local repository is required (no implicit global store)",
        {}
      ),
    ]),
  };
}

/**
 * Shared shape checks common to publish + republish.
 * @param {object} cmd
 * @returns {object[]}
 */
function collectCommandShapeErrors(cmd) {
  /** @type {object[]} */
  const errors = [];

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  errors.push(...collectChannelErrors(cmd.channel));
  errors.push(...collectProfileErrors(cmd.profileId));

  if (!isNonEmptyString(cmd.idempotencyKey)) {
    errors.push(
      createFieldError(
        "idempotencyKey",
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_IDEMPOTENCY_KEY,
        "explicit idempotencyKey is required",
        {}
      )
    );
  }

  if (!isValidExpectedCurrentPublicationRevision(cmd.expectedCurrentPublicationRevision)) {
    errors.push(
      createFieldError(
        "expectedCurrentPublicationRevision",
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_EXPECTED_CURRENT_REVISION,
        "explicit expectedCurrentPublicationRevision (integer >= 0) is required",
        { value: cmd.expectedCurrentPublicationRevision }
      )
    );
  }

  return errors;
}

/**
 * Create the first CompetitionPublication record for a tenant+competition+channel.
 *
 * `expectedCurrentPublicationRevision` must be explicit `0`. Use
 * `republishCompetitionPublication` once a current publication already exists.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   channel: string,
 *   profileId: string,
 *   competitionVersion: object,
 *   expectedSourceVersionId: string,
 *   expectedSourceVersionNumber: number,
 *   definition: object,
 *   expectedDefinitionRevision: number,
 *   configurationPresence: "PRESENT"|"ABSENT",
 *   configuration?: object|null,
 *   expectedConfigurationRevision?: number|null,
 *   branding: object,
 *   expectedBrandingRevision: number,
 *   idempotencyKey: string,
 *   expectedCurrentPublicationRevision: 0,
 *   requestedPublicReference?: string|null,
 *   externalLifecycleBlock?: object|null,
 *   clock?: (() => (string|number)) | string | number | null,
 *   repository?: object,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionPublicationValidationResult}
 */
export function publishCompetitionPublication(command = {}) {
  const definitionSnap = snapshotInput(command.definition);
  const versionSnap = snapshotInput(command.competitionVersion);
  const configurationSnap = snapshotInput(command.configuration);
  const brandingSnap = snapshotInput(command.branding);

  const cmd = command && typeof command === "object" ? command : {};

  const errors = collectCommandShapeErrors(cmd);
  const slugParsed = parseRequestedPublicReference(cmd.requestedPublicReference);
  errors.push(...slugParsed.errors);

  if (
    errors.length === 0 &&
    cmd.expectedCurrentPublicationRevision !== 0
  ) {
    errors.push(
      createFieldError(
        "expectedCurrentPublicationRevision",
        COMPETITION_PUBLICATION_ERROR_CODE.STALE_CURRENT_PUBLICATION_REVISION,
        "publishCompetitionPublication requires expectedCurrentPublicationRevision=0 (first publish); use republishCompetitionPublication otherwise",
        { value: cmd.expectedCurrentPublicationRevision }
      )
    );
  }

  if (errors.length > 0) {
    return validationFail(errors);
  }

  const tenantId = String(cmd.tenantId).trim();
  const competitionId = String(cmd.competitionId).trim();
  const channel = cmd.channel;
  const profileId = cmd.profileId;

  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;

  const readiness = evaluateCompetitionPublicationReadiness({
    tenantId,
    competitionId,
    channel,
    profileId,
    competitionVersion: cmd.competitionVersion,
    expectedSourceVersionId: cmd.expectedSourceVersionId,
    expectedSourceVersionNumber: cmd.expectedSourceVersionNumber,
    definition: cmd.definition,
    expectedDefinitionRevision: cmd.expectedDefinitionRevision,
    configurationPresence: cmd.configurationPresence,
    configuration: cmd.configuration,
    expectedConfigurationRevision: cmd.expectedConfigurationRevision,
    branding: cmd.branding,
    expectedBrandingRevision: cmd.expectedBrandingRevision,
    externalLifecycleBlock: cmd.externalLifecycleBlock,
  });
  if (!readiness.ok) return readiness;
  if (!readiness.value.ready) {
    return validationFail(readinessIssuesToFieldErrors(readiness.value.issues));
  }

  const profile = getCompetitionPublicationProfile(profileId);
  const channelDescriptor = getCompetitionPublicationChannelDescriptor(channel);

  const source = buildSourceReferences({
    tenantId,
    competitionId,
    competitionVersion: cmd.competitionVersion,
    configurationPresence: cmd.configurationPresence,
    configuration: cmd.configuration,
    branding: cmd.branding,
  });

  const requestFingerprint = computePublicationRequestFingerprint({
    tenantId,
    competitionId,
    channel,
    profileId,
    source,
    configurationPresence: cmd.configurationPresence,
    publicReference: slugParsed.value,
    expectedCurrentPublicationRevision: cmd.expectedCurrentPublicationRevision,
    currentPublicationId: null,
  });

  const idemFound = repository.findByIdempotencyKey({
    tenantId,
    competitionId,
    channel,
    idempotencyKey: cmd.idempotencyKey,
  });
  if (!idemFound.ok) return idemFound;
  if (idemFound.value) {
    if (idemFound.value.requestFingerprint !== requestFingerprint) {
      return validationFail([
        createFieldError(
          "idempotencyKey",
          COMPETITION_PUBLICATION_ERROR_CODE.IDEMPOTENCY_CONFLICT,
          "idempotencyKey was already used with a different publish request",
          { idempotencyKey: cmd.idempotencyKey }
        ),
      ]);
    }
    return validationOk(
      {
        publication: idemFound.value,
        manifest: idemFound.value.manifest,
        plan: buildCompetitionPublicationPlan({
          publicationId: idemFound.value.publicationId,
          tenantId,
          competitionId,
          channel,
          revision: idemFound.value.revision,
          manifestFingerprint: idemFound.value.manifest.fingerprint,
          channelDescriptor,
          isRepublish: false,
        }),
      },
      {
        summary: "Idempotent retry returned the existing competition publication.",
        reasons: Object.freeze([
          `publicationId=${idemFound.value.publicationId}`,
          "idempotent=true",
        ]),
      }
    );
  }

  const currentFound = repository.findCurrentPublication({ tenantId, competitionId, channel });
  if (!currentFound.ok) return currentFound;
  if (currentFound.value != null) {
    return validationFail([
      createFieldError(
        "expectedCurrentPublicationRevision",
        COMPETITION_PUBLICATION_ERROR_CODE.STALE_CURRENT_PUBLICATION_REVISION,
        "a current publication already exists for this tenant+competition+channel scope",
        { actual: currentFound.value.revision }
      ),
    ]);
  }

  if (slugParsed.value && typeof repository.reservePublicReference === "function") {
    const slugCheck = repository.reservePublicReference({
      tenantId,
      slug: slugParsed.value.slug,
    });
    if (!slugCheck.ok) return slugCheck;
  }

  const revision = COMPETITION_PUBLICATION_INITIAL_REVISION;
  const publicationId = createCompetitionPublicationId(tenantId, competitionId, channel, revision);

  const manifest = buildCompetitionPublicationManifest({
    publicationId,
    tenantId,
    competitionId,
    channel,
    revision,
    profileId,
    profileVersion: profile.version,
    source,
    competitionVersion: cmd.competitionVersion,
    configurationPresence: cmd.configurationPresence,
    configuration: cmd.configuration,
    branding: cmd.branding,
    channelDescriptor,
    publicReference: slugParsed.value,
    clock: cmd.clock,
  });

  const plan = buildCompetitionPublicationPlan({
    publicationId,
    tenantId,
    competitionId,
    channel,
    revision,
    manifestFingerprint: manifest.fingerprint,
    channelDescriptor,
    isRepublish: false,
  });

  const record = buildCompetitionPublicationRecord({
    publicationId,
    tenantId,
    competitionId,
    channel,
    status: COMPETITION_PUBLICATION_STATUS.PUBLISHED,
    revision,
    previousPublicationId: null,
    profileId,
    profileVersion: profile.version,
    idempotencyKey: cmd.idempotencyKey,
    requestFingerprint,
    source,
    audience: {
      classification: channelDescriptor.audienceClassification,
      requiredProfileId: channelDescriptor.requiredProfileId,
      outputReferenceType: channelDescriptor.outputReferenceType,
    },
    publicReference: slugParsed.value,
    manifest,
  });

  const saved = repository.createPublicationAtomically({ publication: record, previous: null });
  if (!saved.ok) return saved;

  const mutationErrors = collectSourceMutationErrors({
    definition: cmd.definition,
    definitionSnap,
    competitionVersion: cmd.competitionVersion,
    versionSnap,
    configuration: cmd.configuration,
    configurationSnap,
    branding: cmd.branding,
    brandingSnap,
  });
  if (mutationErrors.length > 0) return validationFail(mutationErrors);

  return validationOk(
    {
      publication: saved.value,
      manifest,
      plan,
    },
    {
      summary: "Competition publication created.",
      reasons: Object.freeze([
        `publicationId=${saved.value.publicationId}`,
        "status=PUBLISHED",
        "revision=1",
        "previousPublicationId=null",
        "canonicalPublicationRecordCreated",
        "productionActivationNotPerformed",
        "definitionNotMutated",
        "configurationNotMutated",
        "brandingNotMutated",
        "noCompetitionVersionCreated",
        "noNotificationSent",
        "noAuditPersistence",
      ]),
    }
  );
}

/**
 * Supersede the current CompetitionPublication with a new one built from a
 * NEW explicit CompetitionVersion. Requires the caller to identify the
 * current publication either by `currentPublicationId` or implicitly via
 * `expectedCurrentPublicationRevision` against the channel's current pointer.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   channel: string,
 *   profileId: string,
 *   currentPublicationId?: string|null,
 *   competitionVersion: object,
 *   expectedSourceVersionId: string,
 *   expectedSourceVersionNumber: number,
 *   definition: object,
 *   expectedDefinitionRevision: number,
 *   configurationPresence: "PRESENT"|"ABSENT",
 *   configuration?: object|null,
 *   expectedConfigurationRevision?: number|null,
 *   branding: object,
 *   expectedBrandingRevision: number,
 *   idempotencyKey: string,
 *   expectedCurrentPublicationRevision: number,
 *   requestedPublicReference?: string|null,
 *   externalLifecycleBlock?: object|null,
 *   clock?: (() => (string|number)) | string | number | null,
 *   repository?: object,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionPublicationValidationResult}
 */
export function republishCompetitionPublication(command = {}) {
  const definitionSnap = snapshotInput(command.definition);
  const versionSnap = snapshotInput(command.competitionVersion);
  const configurationSnap = snapshotInput(command.configuration);
  const brandingSnap = snapshotInput(command.branding);

  const cmd = command && typeof command === "object" ? command : {};

  const errors = collectCommandShapeErrors(cmd);
  const slugParsed = parseRequestedPublicReference(cmd.requestedPublicReference);
  errors.push(...slugParsed.errors);

  if (
    cmd.currentPublicationId != null &&
    !isNonEmptyString(cmd.currentPublicationId)
  ) {
    errors.push(
      createFieldError(
        "currentPublicationId",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_IDENTIFIER,
        "currentPublicationId must be a non-empty string when provided",
        {}
      )
    );
  }

  if (
    errors.length === 0 &&
    (!Number.isInteger(cmd.expectedCurrentPublicationRevision) ||
      cmd.expectedCurrentPublicationRevision < 1)
  ) {
    errors.push(
      createFieldError(
        "expectedCurrentPublicationRevision",
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_EXPECTED_CURRENT_REVISION,
        "republishCompetitionPublication requires expectedCurrentPublicationRevision >= 1",
        { value: cmd.expectedCurrentPublicationRevision }
      )
    );
  }

  if (errors.length > 0) {
    return validationFail(errors);
  }

  const tenantId = String(cmd.tenantId).trim();
  const competitionId = String(cmd.competitionId).trim();
  const channel = cmd.channel;
  const profileId = cmd.profileId;

  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;

  const readiness = evaluateCompetitionPublicationReadiness({
    tenantId,
    competitionId,
    channel,
    profileId,
    competitionVersion: cmd.competitionVersion,
    expectedSourceVersionId: cmd.expectedSourceVersionId,
    expectedSourceVersionNumber: cmd.expectedSourceVersionNumber,
    definition: cmd.definition,
    expectedDefinitionRevision: cmd.expectedDefinitionRevision,
    configurationPresence: cmd.configurationPresence,
    configuration: cmd.configuration,
    expectedConfigurationRevision: cmd.expectedConfigurationRevision,
    branding: cmd.branding,
    expectedBrandingRevision: cmd.expectedBrandingRevision,
    externalLifecycleBlock: cmd.externalLifecycleBlock,
  });
  if (!readiness.ok) return readiness;
  if (!readiness.value.ready) {
    return validationFail(readinessIssuesToFieldErrors(readiness.value.issues));
  }

  const profile = getCompetitionPublicationProfile(profileId);
  const channelDescriptor = getCompetitionPublicationChannelDescriptor(channel);

  const source = buildSourceReferences({
    tenantId,
    competitionId,
    competitionVersion: cmd.competitionVersion,
    configurationPresence: cmd.configurationPresence,
    configuration: cmd.configuration,
    branding: cmd.branding,
  });

  const requestFingerprint = computePublicationRequestFingerprint({
    tenantId,
    competitionId,
    channel,
    profileId,
    source,
    configurationPresence: cmd.configurationPresence,
    publicReference: slugParsed.value,
    expectedCurrentPublicationRevision: cmd.expectedCurrentPublicationRevision,
    currentPublicationId: cmd.currentPublicationId ?? null,
  });

  const idemFound = repository.findByIdempotencyKey({
    tenantId,
    competitionId,
    channel,
    idempotencyKey: cmd.idempotencyKey,
  });
  if (!idemFound.ok) return idemFound;
  if (idemFound.value) {
    if (idemFound.value.requestFingerprint !== requestFingerprint) {
      return validationFail([
        createFieldError(
          "idempotencyKey",
          COMPETITION_PUBLICATION_ERROR_CODE.IDEMPOTENCY_CONFLICT,
          "idempotencyKey was already used with a different republish request",
          { idempotencyKey: cmd.idempotencyKey }
        ),
      ]);
    }
    return validationOk(
      {
        publication: idemFound.value,
        manifest: idemFound.value.manifest,
        plan: buildCompetitionPublicationPlan({
          publicationId: idemFound.value.publicationId,
          tenantId,
          competitionId,
          channel,
          revision: idemFound.value.revision,
          manifestFingerprint: idemFound.value.manifest.fingerprint,
          channelDescriptor,
          isRepublish: true,
        }),
      },
      {
        summary: "Idempotent retry returned the existing competition publication.",
        reasons: Object.freeze([
          `publicationId=${idemFound.value.publicationId}`,
          "idempotent=true",
        ]),
      }
    );
  }

  let current;
  if (isNonEmptyString(cmd.currentPublicationId)) {
    const found = repository.findPublicationById({
      tenantId,
      competitionId,
      publicationId: cmd.currentPublicationId,
    });
    if (!found.ok) return found;
    current = found.value;
    if (current.channel !== channel) {
      return validationFail([
        createFieldError(
          "currentPublicationId",
          COMPETITION_PUBLICATION_ERROR_CODE.CURRENT_PUBLICATION_MISMATCH,
          "currentPublicationId does not belong to the requested channel",
          { expected: channel, actual: current.channel }
        ),
      ]);
    }
  } else {
    const found = repository.findCurrentPublication({ tenantId, competitionId, channel });
    if (!found.ok) return found;
    if (!found.value) {
      return validationFail([
        createFieldError(
          "currentPublicationId",
          COMPETITION_PUBLICATION_ERROR_CODE.MISSING_CURRENT_PUBLICATION_REFERENCE,
          "no current publication exists for this scope; provide explicit currentPublicationId or publish first",
          {}
        ),
      ]);
    }
    current = found.value;
  }

  if (current.status !== COMPETITION_PUBLICATION_STATUS.PUBLISHED) {
    return validationFail([
      createFieldError(
        "currentPublicationId",
        COMPETITION_PUBLICATION_ERROR_CODE.CURRENT_PUBLICATION_MISMATCH,
        "the referenced publication is not currently PUBLISHED",
        { status: current.status }
      ),
    ]);
  }
  if (current.revision !== cmd.expectedCurrentPublicationRevision) {
    return validationFail([
      createFieldError(
        "expectedCurrentPublicationRevision",
        COMPETITION_PUBLICATION_ERROR_CODE.STALE_CURRENT_PUBLICATION_REVISION,
        "expectedCurrentPublicationRevision does not match the current publication revision",
        { expected: cmd.expectedCurrentPublicationRevision, actual: current.revision }
      ),
    ]);
  }

  if (source.sourceCompetitionVersionId === current.source.sourceCompetitionVersionId) {
    return validationFail([
      createFieldError(
        "competitionVersion.versionId",
        COMPETITION_PUBLICATION_ERROR_CODE.SAME_SOURCE_REPUBLISH,
        "republish requires a new CompetitionVersion different from the currently published source",
        { sourceCompetitionVersionId: current.source.sourceCompetitionVersionId }
      ),
    ]);
  }

  if (slugParsed.value && typeof repository.reservePublicReference === "function") {
    const slugCheck = repository.reservePublicReference({
      tenantId,
      slug: slugParsed.value.slug,
      publicationId: current.publicationId,
    });
    if (!slugCheck.ok) return slugCheck;
  }

  const revision = current.revision + 1;
  const publicationId = createCompetitionPublicationId(tenantId, competitionId, channel, revision);

  const manifest = buildCompetitionPublicationManifest({
    publicationId,
    tenantId,
    competitionId,
    channel,
    revision,
    profileId,
    profileVersion: profile.version,
    source,
    competitionVersion: cmd.competitionVersion,
    configurationPresence: cmd.configurationPresence,
    configuration: cmd.configuration,
    branding: cmd.branding,
    channelDescriptor,
    publicReference: slugParsed.value,
    clock: cmd.clock,
  });

  const plan = buildCompetitionPublicationPlan({
    publicationId,
    tenantId,
    competitionId,
    channel,
    revision,
    manifestFingerprint: manifest.fingerprint,
    channelDescriptor,
    isRepublish: true,
  });

  const record = buildCompetitionPublicationRecord({
    publicationId,
    tenantId,
    competitionId,
    channel,
    status: COMPETITION_PUBLICATION_STATUS.PUBLISHED,
    revision,
    previousPublicationId: current.publicationId,
    profileId,
    profileVersion: profile.version,
    idempotencyKey: cmd.idempotencyKey,
    requestFingerprint,
    source,
    audience: {
      classification: channelDescriptor.audienceClassification,
      requiredProfileId: channelDescriptor.requiredProfileId,
      outputReferenceType: channelDescriptor.outputReferenceType,
    },
    publicReference: slugParsed.value,
    manifest,
  });

  const supersededRecord = deepFreeze({
    ...clonePlain(current),
    status: COMPETITION_PUBLICATION_STATUS.SUPERSEDED,
  });

  const saved = repository.createPublicationAtomically({
    publication: record,
    previous: { publicationId: current.publicationId, supersededRecord },
  });
  if (!saved.ok) return saved;

  const mutationErrors = collectSourceMutationErrors({
    definition: cmd.definition,
    definitionSnap,
    competitionVersion: cmd.competitionVersion,
    versionSnap,
    configuration: cmd.configuration,
    configurationSnap,
    branding: cmd.branding,
    brandingSnap,
  });
  if (mutationErrors.length > 0) return validationFail(mutationErrors);

  return validationOk(
    {
      publication: saved.value,
      manifest,
      plan,
      previousPublication: supersededRecord,
    },
    {
      summary: "Competition publication republished with a new source version.",
      reasons: Object.freeze([
        `publicationId=${saved.value.publicationId}`,
        `previousPublicationId=${current.publicationId}`,
        `revision=${revision}`,
        "status=PUBLISHED",
        "priorPublicationSuperseded",
        "canonicalPublicationRecordCreated",
        "productionActivationNotPerformed",
        "definitionNotMutated",
        "configurationNotMutated",
        "brandingNotMutated",
        "noCompetitionVersionCreated",
        "noNotificationSent",
        "noAuditPersistence",
      ]),
    }
  );
}

/**
 * @param {readonly object[]} issues
 * @returns {object[]}
 */
function readinessIssuesToFieldErrors(issues) {
  const errorIssues = issues.filter(
    (i) => i.severity === COMPETITION_PUBLICATION_SEVERITY.ERROR
  );
  if (errorIssues.length === 0) {
    return [
      createFieldError(
        "readiness",
        COMPETITION_PUBLICATION_ERROR_CODE.READINESS_FAILED,
        "competition publication readiness failed",
        {}
      ),
    ];
  }
  return errorIssues.map((i) =>
    createFieldError(i.path, i.code, i.message, i.details || {})
  );
}

/**
 * Prove that CM-06 never mutated the CM-01/CM-03/CM-04/CM-05 inputs it consumed.
 * @param {{
 *   definition: unknown, definitionSnap: unknown,
 *   competitionVersion: unknown, versionSnap: unknown,
 *   configuration: unknown, configurationSnap: unknown,
 *   branding: unknown, brandingSnap: unknown,
 * }} params
 * @returns {object[]}
 */
function collectSourceMutationErrors(params) {
  /** @type {object[]} */
  const errors = [];
  if (canonicalizeJson(params.definition) !== canonicalizeJson(params.definitionSnap)) {
    errors.push(
      createFieldError(
        "definition",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_CONTRACT,
        "definition was mutated during publication",
        {}
      )
    );
  }
  if (canonicalizeJson(params.competitionVersion) !== canonicalizeJson(params.versionSnap)) {
    errors.push(
      createFieldError(
        "competitionVersion",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_CONTRACT,
        "competitionVersion was mutated during publication",
        {}
      )
    );
  }
  if (canonicalizeJson(params.configuration) !== canonicalizeJson(params.configurationSnap)) {
    errors.push(
      createFieldError(
        "configuration",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_CONTRACT,
        "configuration was mutated during publication",
        {}
      )
    );
  }
  if (canonicalizeJson(params.branding) !== canonicalizeJson(params.brandingSnap)) {
    errors.push(
      createFieldError(
        "branding",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_CONTRACT,
        "branding was mutated during publication",
        {}
      )
    );
  }
  return errors;
}

/**
 * @param {{ tenantId: string, competitionId: string, publicationId: string, repository?: object }} command
 */
export function getCompetitionPublicationById(command = {}) {
  const snap = snapshotInput(command);
  void snap;
  const repoGate = requireRepository(command);
  if (!repoGate.ok) return repoGate.result;
  return repoGate.repository.findPublicationById({
    tenantId: command.tenantId,
    competitionId: command.competitionId,
    publicationId: command.publicationId,
  });
}

/**
 * @param {{ tenantId: string, competitionId: string, channel: string, repository?: object }} command
 */
export function getCurrentCompetitionPublication(command = {}) {
  const snap = snapshotInput(command);
  void snap;
  const repoGate = requireRepository(command);
  if (!repoGate.ok) return repoGate.result;
  return repoGate.repository.findCurrentPublication({
    tenantId: command.tenantId,
    competitionId: command.competitionId,
    channel: command.channel,
  });
}

/**
 * @param {{ tenantId: string, competitionId: string, channel?: string, repository?: object }} command
 */
export function listCompetitionPublicationsCommand(command = {}) {
  const snap = snapshotInput(command);
  void snap;
  const repoGate = requireRepository(command);
  if (!repoGate.ok) return repoGate.result;
  return repoGate.repository.listPublications({
    tenantId: command.tenantId,
    competitionId: command.competitionId,
    channel: command.channel,
  });
}

/**
 * @param {object} command
 */
export function evaluateCompetitionPublicationReadinessCommand(command = {}) {
  return evaluateCompetitionPublicationReadiness(command);
}

/**
 * @returns {ReturnType<typeof createInMemoryCompetitionPublicationRepository>}
 */
export function createCapabilityLocalPublicationRepository() {
  return createInMemoryCompetitionPublicationRepository();
}
