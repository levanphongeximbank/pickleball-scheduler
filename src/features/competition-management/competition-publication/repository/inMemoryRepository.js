/**
 * Capability-local in-memory CompetitionPublication repository (CM-06).
 *
 * Serves tests and dormant capability exercises only. Not production
 * persistence. Clones on write/read. Fail-closed concurrency. Enforces the
 * "one current PUBLISHED record per tenant+competition+channel" invariant and
 * the atomic supersede transition described in the CM-06 contract.
 */

import { COMPETITION_PUBLICATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
} from "../contracts/validation.js";
import { deepFreeze, clonePlain, isNonEmptyString } from "../contracts/shared.js";
import { isCompetitionPublication } from "../contracts/publication.js";
import {
  publicationScopeKey,
  createIdempotencyStorageKey,
  publicReferenceKey,
} from "../contracts/identity.js";
import { COMPETITION_PUBLICATION_STATUS } from "../constants/status.js";
import { COMPETITION_PUBLICATION_INITIAL_REVISION } from "../constants/revision.js";
import { COMPETITION_PUBLICATION_REPOSITORY_PORT_METHODS } from "../ports/repositoryPort.js";

export { publicationScopeKey };

/**
 * @returns {object}
 */
export function createInMemoryCompetitionPublicationRepository() {
  /** @type {Map<string, object>} publicationId -> frozen clone */
  const byId = new Map();
  /** @type {Map<string, string>} scopeKey(tenant::comp::channel) -> current publicationId */
  const byScopeCurrent = new Map();
  /** @type {Map<string, string>} idempotency storage key -> publicationId */
  const byIdempotency = new Map();
  /** @type {Map<string, string>} tenant::slug -> publicationId (first owner, never released) */
  const byPublicReference = new Map();

  /**
   * @param {{ publication: object, previous?: { publicationId: string, supersededRecord: object } | null }} params
   */
  function createPublicationAtomically(params = {}) {
    const publication = params && typeof params === "object" ? params.publication : null;
    const previous = params && typeof params === "object" ? params.previous ?? null : null;

    if (!isCompetitionPublication(publication)) {
      return validationFail([
        createFieldError(
          "publication",
          COMPETITION_PUBLICATION_ERROR_CODE.MALFORMED_PUBLICATION,
          "cannot create malformed CompetitionPublication",
          {}
        ),
      ]);
    }

    const stored = deepFreeze(clonePlain(publication));
    const scope = publicationScopeKey(stored.tenantId, stored.competitionId, stored.channel);

    if (byId.has(stored.publicationId)) {
      return validationFail([
        createFieldError(
          "publicationId",
          COMPETITION_PUBLICATION_ERROR_CODE.DUPLICATE_PUBLICATION,
          "duplicate publication identity in repository",
          { publicationId: stored.publicationId }
        ),
      ]);
    }

    if (stored.status !== COMPETITION_PUBLICATION_STATUS.PUBLISHED) {
      return validationFail([
        createFieldError(
          "status",
          COMPETITION_PUBLICATION_ERROR_CODE.MALFORMED_PUBLICATION,
          "createPublicationAtomically only accepts a new PUBLISHED record",
          { status: stored.status }
        ),
      ]);
    }

    if (previous == null) {
      if (byScopeCurrent.has(scope)) {
        return validationFail([
          createFieldError(
            "publicationId",
            COMPETITION_PUBLICATION_ERROR_CODE.REPOSITORY_CONFLICT,
            "a current publication already exists for this tenant+competition+channel scope",
            { scope }
          ),
        ]);
      }
      if (stored.revision !== COMPETITION_PUBLICATION_INITIAL_REVISION) {
        return validationFail([
          createFieldError(
            "revision",
            COMPETITION_PUBLICATION_ERROR_CODE.REPOSITORY_CONFLICT,
            `first publish requires revision=${COMPETITION_PUBLICATION_INITIAL_REVISION}`,
            { actual: stored.revision }
          ),
        ]);
      }
      if (stored.previousPublicationId !== null) {
        return validationFail([
          createFieldError(
            "previousPublicationId",
            COMPETITION_PUBLICATION_ERROR_CODE.REPOSITORY_CONFLICT,
            "first publish requires previousPublicationId=null",
            {}
          ),
        ]);
      }
    } else {
      const priorId = previous.publicationId;
      const priorStored = byId.get(priorId);
      if (
        !priorStored ||
        priorStored.tenantId !== stored.tenantId ||
        priorStored.competitionId !== stored.competitionId ||
        priorStored.channel !== stored.channel
      ) {
        return validationFail([
          createFieldError(
            "previous.publicationId",
            COMPETITION_PUBLICATION_ERROR_CODE.PUBLICATION_NOT_FOUND,
            "prior publication not found for tenant/competition/channel scope",
            { publicationId: priorId }
          ),
        ]);
      }
      if (byScopeCurrent.get(scope) !== priorId) {
        return validationFail([
          createFieldError(
            "previous.publicationId",
            COMPETITION_PUBLICATION_ERROR_CODE.CURRENT_PUBLICATION_MISMATCH,
            "prior publication is not the current publication for this scope",
            { expectedCurrent: byScopeCurrent.get(scope), actual: priorId }
          ),
        ]);
      }
      if (priorStored.status !== COMPETITION_PUBLICATION_STATUS.PUBLISHED) {
        return validationFail([
          createFieldError(
            "previous.publicationId",
            COMPETITION_PUBLICATION_ERROR_CODE.CURRENT_PUBLICATION_MISMATCH,
            "prior publication is not currently PUBLISHED",
            { status: priorStored.status }
          ),
        ]);
      }
      if (stored.previousPublicationId !== priorId) {
        return validationFail([
          createFieldError(
            "previousPublicationId",
            COMPETITION_PUBLICATION_ERROR_CODE.REPOSITORY_CONFLICT,
            "new publication.previousPublicationId must equal prior publicationId",
            { expected: priorId, actual: stored.previousPublicationId }
          ),
        ]);
      }
      if (stored.revision !== priorStored.revision + 1) {
        return validationFail([
          createFieldError(
            "revision",
            COMPETITION_PUBLICATION_ERROR_CODE.REPOSITORY_CONFLICT,
            "new publication revision must equal prior revision + 1",
            { expected: priorStored.revision + 1, actual: stored.revision }
          ),
        ]);
      }

      const supersededCandidate = previous.supersededRecord;
      if (
        !isCompetitionPublication(supersededCandidate) ||
        supersededCandidate.publicationId !== priorId ||
        supersededCandidate.status !== COMPETITION_PUBLICATION_STATUS.SUPERSEDED
      ) {
        return validationFail([
          createFieldError(
            "previous.supersededRecord",
            COMPETITION_PUBLICATION_ERROR_CODE.MALFORMED_PUBLICATION,
            "supersededRecord must be a valid SUPERSEDED copy of the prior publication",
            {}
          ),
        ]);
      }
    }

    if (stored.publicReference?.slug) {
      const refKey = publicReferenceKey(stored.tenantId, stored.publicReference.slug);
      const owner = byPublicReference.get(refKey);
      if (owner && owner !== stored.publicationId) {
        return validationFail([
          createFieldError(
            "publicReference.slug",
            COMPETITION_PUBLICATION_ERROR_CODE.DUPLICATE_PUBLIC_REFERENCE,
            "requested public reference slug is already in use for this tenant",
            { slug: stored.publicReference.slug }
          ),
        ]);
      }
    }

    if (stored.idempotencyKey) {
      const idemKey = createIdempotencyStorageKey(
        stored.tenantId,
        stored.competitionId,
        stored.channel,
        stored.idempotencyKey
      );
      const owner = byIdempotency.get(idemKey);
      if (owner && owner !== stored.publicationId) {
        return validationFail([
          createFieldError(
            "idempotencyKey",
            COMPETITION_PUBLICATION_ERROR_CODE.IDEMPOTENCY_CONFLICT,
            "idempotency key already bound to another publication",
            { idempotencyKey: stored.idempotencyKey }
          ),
        ]);
      }
    }

    // Commit atomically (single-threaded JS — safe to mutate maps sequentially here).
    if (previous != null) {
      byId.set(previous.publicationId, deepFreeze(clonePlain(previous.supersededRecord)));
    }
    byId.set(stored.publicationId, stored);
    byScopeCurrent.set(scope, stored.publicationId);
    if (stored.publicReference?.slug) {
      byPublicReference.set(
        publicReferenceKey(stored.tenantId, stored.publicReference.slug),
        stored.publicationId
      );
    }
    if (stored.idempotencyKey) {
      byIdempotency.set(
        createIdempotencyStorageKey(
          stored.tenantId,
          stored.competitionId,
          stored.channel,
          stored.idempotencyKey
        ),
        stored.publicationId
      );
    }

    return validationOk(clonePlain(stored), {
      summary: "Competition publication created in capability-local repository.",
      reasons: Object.freeze([
        `publicationId=${stored.publicationId}`,
        `revision=${stored.revision}`,
        previous == null ? "firstPublish" : "republishSupersededPrior",
        "notProductionPersistence",
      ]),
    });
  }

  /**
   * @param {{ tenantId: string, competitionId: string, publicationId: string }} query
   */
  function findPublicationById(query = {}) {
    if (!isNonEmptyString(query.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_PUBLICATION_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.competitionId)) {
      return validationFail([
        createFieldError(
          "competitionId",
          COMPETITION_PUBLICATION_ERROR_CODE.MISSING_COMPETITION,
          "explicit competitionId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.publicationId)) {
      return validationFail([
        createFieldError(
          "publicationId",
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_IDENTIFIER,
          "explicit publicationId is required",
          {}
        ),
      ]);
    }

    const tenantId = String(query.tenantId).trim();
    const competitionId = String(query.competitionId).trim();
    const publicationId = String(query.publicationId).trim();
    const found = byId.get(publicationId);

    if (!found || found.tenantId !== tenantId || found.competitionId !== competitionId) {
      return validationFail([
        createFieldError(
          "publicationId",
          COMPETITION_PUBLICATION_ERROR_CODE.PUBLICATION_NOT_FOUND,
          "publication not found for tenant/competition scope",
          { publicationId }
        ),
      ]);
    }

    return validationOk(clonePlain(found), {
      summary: "Competition publication found.",
      reasons: Object.freeze([`publicationId=${publicationId}`, `status=${found.status}`]),
    });
  }

  /**
   * @param {{ tenantId: string, competitionId: string, channel: string }} query
   */
  function findCurrentPublication(query = {}) {
    if (!isNonEmptyString(query.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_PUBLICATION_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.competitionId)) {
      return validationFail([
        createFieldError(
          "competitionId",
          COMPETITION_PUBLICATION_ERROR_CODE.MISSING_COMPETITION,
          "explicit competitionId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.channel)) {
      return validationFail([
        createFieldError(
          "channel",
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_CHANNEL,
          "explicit channel is required",
          {}
        ),
      ]);
    }

    const tenantId = String(query.tenantId).trim();
    const competitionId = String(query.competitionId).trim();
    const channel = String(query.channel).trim();
    const scope = publicationScopeKey(tenantId, competitionId, channel);
    const currentId = byScopeCurrent.get(scope);

    if (!currentId) {
      return validationOk(null, {
        summary: "No current competition publication exists for this scope.",
        reasons: Object.freeze(["semanticState=UNPUBLISHED"]),
      });
    }

    return findPublicationById({ tenantId, competitionId, publicationId: currentId });
  }

  /**
   * @param {{ tenantId: string, competitionId: string, channel?: string }} query
   */
  function listPublications(query = {}) {
    if (!isNonEmptyString(query.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_PUBLICATION_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.competitionId)) {
      return validationFail([
        createFieldError(
          "competitionId",
          COMPETITION_PUBLICATION_ERROR_CODE.MISSING_COMPETITION,
          "explicit competitionId is required",
          {}
        ),
      ]);
    }

    const tenantId = String(query.tenantId).trim();
    const competitionId = String(query.competitionId).trim();
    const channelFilter = isNonEmptyString(query.channel) ? String(query.channel).trim() : null;

    const items = [...byId.values()]
      .filter(
        (p) =>
          p.tenantId === tenantId &&
          p.competitionId === competitionId &&
          (channelFilter == null || p.channel === channelFilter)
      )
      .map((p) => clonePlain(p))
      .sort((a, b) => {
        const byChannel = String(a.channel).localeCompare(String(b.channel), "en");
        if (byChannel !== 0) return byChannel;
        return a.revision - b.revision;
      });

    return validationOk(Object.freeze(items), {
      summary: "Competition publications listed.",
      reasons: Object.freeze([
        `tenantId=${tenantId}`,
        `competitionId=${competitionId}`,
        `count=${items.length}`,
        "sortedByChannelThenRevision",
      ]),
    });
  }

  /**
   * @param {{ tenantId: string, competitionId: string, channel: string, idempotencyKey: string }} query
   */
  function findByIdempotencyKey(query = {}) {
    if (!isNonEmptyString(query.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_PUBLICATION_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.competitionId)) {
      return validationFail([
        createFieldError(
          "competitionId",
          COMPETITION_PUBLICATION_ERROR_CODE.MISSING_COMPETITION,
          "explicit competitionId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.channel)) {
      return validationFail([
        createFieldError(
          "channel",
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_CHANNEL,
          "explicit channel is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.idempotencyKey)) {
      return validationFail([
        createFieldError(
          "idempotencyKey",
          COMPETITION_PUBLICATION_ERROR_CODE.MISSING_IDEMPOTENCY_KEY,
          "explicit idempotencyKey is required",
          {}
        ),
      ]);
    }

    const key = createIdempotencyStorageKey(
      query.tenantId,
      query.competitionId,
      query.channel,
      query.idempotencyKey
    );
    const publicationId = byIdempotency.get(key);
    if (!publicationId) {
      return validationOk(null, {
        summary: "No publication bound to idempotency key.",
        reasons: Object.freeze(["found=null"]),
      });
    }
    return findPublicationById({
      tenantId: query.tenantId,
      competitionId: query.competitionId,
      publicationId,
    });
  }

  /**
   * Optional dry-run duplicate slug check (does not mutate/reserve).
   * @param {{ tenantId: string, slug: string, publicationId?: string }} query
   */
  function reservePublicReference(query = {}) {
    if (!isNonEmptyString(query.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_PUBLICATION_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.slug)) {
      return validationFail([
        createFieldError(
          "slug",
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG,
          "explicit slug is required",
          {}
        ),
      ]);
    }

    const refKey = publicReferenceKey(query.tenantId, query.slug);
    const owner = byPublicReference.get(refKey);
    if (owner && owner !== query.publicationId) {
      return validationFail([
        createFieldError(
          "slug",
          COMPETITION_PUBLICATION_ERROR_CODE.DUPLICATE_PUBLIC_REFERENCE,
          "requested public reference slug is already in use for this tenant",
          { slug: query.slug }
        ),
      ]);
    }

    return validationOk(
      { available: true },
      {
        summary: "Public reference slug is available.",
        reasons: Object.freeze([`slug=${query.slug}`]),
      }
    );
  }

  return Object.freeze({
    __isCapabilityLocalInMemory: true,
    createPublicationAtomically,
    findPublicationById,
    findCurrentPublication,
    listPublications,
    findByIdempotencyKey,
    reservePublicReference,
    clear() {
      byId.clear();
      byScopeCurrent.clear();
      byIdempotency.clear();
      byPublicReference.clear();
    },
    size() {
      return byId.size;
    },
    get portMethods() {
      return COMPETITION_PUBLICATION_REPOSITORY_PORT_METHODS;
    },
  });
}
