/**
 * Content aggregate factory (NEWS-01).
 */

import { isContentType } from "../constants/contentTypes.js";
import { isContentScope } from "../constants/contentScopes.js";
import { EDITORIAL_STATUS } from "../constants/editorialLifecycle.js";
import {
  CONTENT_PROVENANCE,
  isContentProvenance,
} from "../constants/provenance.js";
import {
  isPublicVisibility,
  PUBLIC_VISIBILITY,
} from "../constants/publicVisibility.js";
import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import { createCategoryReference } from "../contracts/categoryReference.js";
import { createTagReference } from "../contracts/tagReference.js";
import { createMediaReference } from "../contracts/mediaReference.js";
import { createSeoMetadata } from "../contracts/seoMetadata.js";
import { createPublicationWindow } from "../contracts/publicationWindow.js";
import { createBannerContentContract } from "../contracts/bannerContent.js";
import { createSponsorContentContract } from "../contracts/sponsorContent.js";
import {
  deepFreeze,
  failContract,
  isValidLocale,
  isValidSlug,
  requireNonEmptyString,
} from "../contracts/shared.js";
import {
  createContentId,
  createRevisionId,
  requireOpaqueId,
} from "../contracts/identifiers.js";
import { CONTENT_TYPE } from "../constants/contentTypes.js";
import { validateScopeOwnership } from "./scopeOwnership.js";
import { assertPositiveVersion } from "./revisionVersion.js";

/**
 * @param {Record<string, unknown>} input
 * @param {{ contentSeed: string, revisionSeed: string, createdAt: string }} ctx
 */
export function createDraftContent(input, ctx) {
  const contentSeed = requireNonEmptyString(ctx.contentSeed, "contentSeed");
  const revisionSeed = requireNonEmptyString(ctx.revisionSeed, "revisionSeed");
  const createdAt = requireNonEmptyString(ctx.createdAt, "createdAt");

  const contentType = requireNonEmptyString(input.contentType, "contentType");
  if (!isContentType(contentType)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.UNSUPPORTED_CONTENT_TYPE,
      "Unsupported content type",
      { contentType }
    );
  }

  const contentScope = requireNonEmptyString(input.contentScope, "contentScope");
  if (!isContentScope(contentScope)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.UNSUPPORTED_CONTENT_SCOPE,
      "Unsupported content scope",
      { contentScope }
    );
  }

  const ownership = validateScopeOwnership(contentScope, {
    tenantId: input.tenantId,
    venueId: input.venueId,
    clubId: input.clubId,
    competitionId: input.competitionId,
  });

  const authorId = requireOpaqueId(input.authorId, "authorId");
  const editorialOwnerId = requireOpaqueId(
    input.editorialOwnerId ?? input.authorId,
    "editorialOwnerId"
  );
  if (!editorialOwnerId) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_EDITORIAL_OWNERSHIP,
      "editorialOwnerId is required",
      { field: "editorialOwnerId" }
    );
  }

  const title = requireNonEmptyString(input.title, "title");
  const summary =
    contentType === CONTENT_TYPE.BANNER ||
    contentType === CONTENT_TYPE.SPONSOR_CONTENT
      ? input.summary == null || input.summary === ""
        ? ""
        : requireNonEmptyString(input.summary, "summary")
      : requireNonEmptyString(input.summary, "summary");

  const slugRaw = requireNonEmptyString(input.slug, "slug");
  if (!isValidSlug(slugRaw)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_SLUG,
      "Invalid content slug",
      { field: "slug", value: slugRaw }
    );
  }
  const slug = slugRaw.trim();

  const localeRaw = requireNonEmptyString(input.locale, "locale");
  if (!isValidLocale(localeRaw)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_LOCALE,
      "Invalid content locale",
      { field: "locale", value: localeRaw }
    );
  }
  const locale = localeRaw.trim();

  const categoryReferences = normalizeList(
    input.categoryReferences,
    createCategoryReference,
    "categoryReferences"
  );
  const tagReferences = normalizeList(
    input.tagReferences,
    createTagReference,
    "tagReferences"
  );
  const mediaReferences = normalizeList(
    input.mediaReferences,
    createMediaReference,
    "mediaReferences"
  );
  const seoMetadata = createSeoMetadata(
    /** @type {Record<string, unknown>} */ (input.seoMetadata || {})
  );
  const publicationWindow = createPublicationWindow(
    /** @type {Record<string, unknown>} */ (input.publicationWindow || {})
  );

  const publicVisibility = input.publicVisibility || PUBLIC_VISIBILITY.PUBLIC;
  if (!isPublicVisibility(publicVisibility)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTENT_FIELD,
      "Invalid publicVisibility",
      { field: "publicVisibility", value: publicVisibility }
    );
  }

  const provenance = input.provenance || CONTENT_PROVENANCE.PREVIEW;
  if (!isContentProvenance(provenance)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.PROVENANCE_MISMATCH,
      "Unsupported content provenance",
      { field: "provenance", value: provenance }
    );
  }
  // Drafts are never LIVE; LIVE only after durable live path (NEWS-02+). NEWS-01 defaults PREVIEW.
  if (provenance === CONTENT_PROVENANCE.LIVE) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.PROVENANCE_MISMATCH,
      "LIVE provenance is not allowed for NEWS-01 in-memory drafts (no durable live path)",
      { provenance }
    );
  }

  const banner =
    contentType === CONTENT_TYPE.BANNER
      ? createBannerContentContract(
          /** @type {Record<string, unknown>} */ (input.banner || input)
        )
      : input.banner
        ? createBannerContentContract(
            /** @type {Record<string, unknown>} */ (input.banner)
          )
        : null;

  const sponsor =
    contentType === CONTENT_TYPE.SPONSOR_CONTENT
      ? createSponsorContentContract(
          /** @type {Record<string, unknown>} */ (input.sponsor || input)
        )
      : input.sponsor
        ? createSponsorContentContract(
            /** @type {Record<string, unknown>} */ (input.sponsor)
          )
        : null;

  const contentId =
    input.contentId != null
      ? requireOpaqueId(input.contentId, "contentId")
      : createContentId("cnt", contentSeed);
  const revisionId =
    input.revisionId != null
      ? requireOpaqueId(input.revisionId, "revisionId")
      : createRevisionId(revisionSeed);
  const version = assertPositiveVersion(input.version ?? 1);

  return deepFreeze({
    contentId,
    contentType,
    contentScope: ownership.contentScope,
    tenantId: ownership.tenantId,
    venueId: ownership.venueId,
    clubId: ownership.clubId,
    competitionId: ownership.competitionId,
    authorId,
    editorialOwnerId,
    title,
    summary,
    slug,
    locale,
    categoryReferences,
    tagReferences,
    mediaReferences,
    seoMetadata,
    banner,
    sponsor,
    revisionId,
    version,
    editorialStatus: EDITORIAL_STATUS.DRAFT,
    review: null,
    approval: null,
    publicationWindow,
    publicVisibility,
    provenance,
    publishedAt: null,
    unpublishedAt: null,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
  });
}

/**
 * @template T
 * @param {unknown} list
 * @param {(item: Record<string, unknown>) => T} factory
 * @param {string} field
 * @returns {ReadonlyArray<T>}
 */
function normalizeList(list, factory, field) {
  if (list == null) return Object.freeze([]);
  if (!Array.isArray(list)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTENT_FIELD,
      `${field} must be an array`,
      { field }
    );
  }
  return Object.freeze(
    list.map((item, index) => {
      if (!item || typeof item !== "object") {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_REFERENCE,
          `Invalid ${field}[${index}]`,
          { field, index }
        );
      }
      return factory(/** @type {Record<string, unknown>} */ (item));
    })
  );
}
