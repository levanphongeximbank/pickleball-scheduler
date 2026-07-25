/**
 * Public content read projection (NEWS-01).
 * Fail-closed: non-public content does not leak internal review/approval metadata.
 */

import { EDITORIAL_STATUS } from "../constants/editorialLifecycle.js";
import { CONTENT_PROVENANCE } from "../constants/provenance.js";
import { isPubliclyReadableVisibility } from "../constants/publicVisibility.js";
import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import { deepFreeze, failContract } from "../contracts/shared.js";
import { evaluatePublicationEligibility } from "../domain/publicationEligibility.js";

/**
 * @param {Record<string, unknown>} content
 * @param {{ now: string, requireLiveProvenance?: boolean }} ctx
 */
export function projectPublicContent(content, ctx) {
  if (!content || typeof content !== "object") {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.CONTENT_NOT_PUBLIC,
      "Content is not projectable as public",
      { reason: "invalid_content" }
    );
  }

  if (content.editorialStatus === EDITORIAL_STATUS.ARCHIVED) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.ARCHIVED_CONTENT,
      "Archived content is not public",
      { contentId: content.contentId }
    );
  }

  if (content.editorialStatus !== EDITORIAL_STATUS.PUBLISHED) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.CONTENT_NOT_PUBLIC,
      "Only PUBLISHED content may be projected as public",
      {
        contentId: content.contentId,
        editorialStatus: content.editorialStatus,
      }
    );
  }

  if (!isPubliclyReadableVisibility(content.publicVisibility)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.CONTENT_NOT_PUBLIC,
      "Content visibility is not public",
      {
        contentId: content.contentId,
        publicVisibility: content.publicVisibility,
      }
    );
  }

  const eligibility = evaluatePublicationEligibility(content, { now: ctx.now });
  if (!eligibility.eligible) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.CONTENT_NOT_PUBLIC,
      "Content fails publication eligibility for public projection",
      { reasons: eligibility.reasons, reason: eligibility.reason }
    );
  }

  const provenance = content.provenance;
  if (provenance === CONTENT_PROVENANCE.MOCK && ctx.requireLiveProvenance) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.PROVENANCE_MISMATCH,
      "MOCK content must never be projected as LIVE",
      { provenance }
    );
  }
  // Never relabel MOCK as LIVE
  if (provenance === CONTENT_PROVENANCE.LIVE && !ctx.allowLive) {
    // NEWS-01 has no durable live path; refuse LIVE projection unless explicitly allowed by later phases.
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.PROVENANCE_MISMATCH,
      "LIVE public projection requires durable live path (deferred beyond NEWS-01)",
      { provenance }
    );
  }

  return deepFreeze({
    contentId: content.contentId,
    contentType: content.contentType,
    contentScope: content.contentScope,
    title: content.title,
    summary: content.summary,
    slug: content.slug,
    locale: content.locale,
    categoryReferences: content.categoryReferences || [],
    tagReferences: content.tagReferences || [],
    mediaReferences: content.mediaReferences || [],
    seoMetadata: content.seoMetadata || null,
    publishedAt: content.publishedAt || null,
    publicationWindow: content.publicationWindow
      ? {
          publishAt: content.publicationWindow.publishAt,
          unpublishAt: content.publicationWindow.unpublishAt,
          timezone: content.publicationWindow.timezone,
        }
      : null,
    revisionId: content.revisionId,
    version: content.version,
    provenance,
    scopeReference: Object.freeze({
      tenantId: content.tenantId ?? null,
      venueId: content.venueId ?? null,
      clubId: content.clubId ?? null,
      competitionId: content.competitionId ?? null,
    }),
    banner: content.banner
      ? {
          placement: content.banner.placement,
          media: content.banner.media,
          destination: content.banner.destination,
        }
      : null,
    sponsor: content.sponsor
      ? {
          sponsorId: content.sponsor.sponsorId,
          disclosureLabel: content.sponsor.disclosureLabel,
          media: content.sponsor.media,
          destination: content.sponsor.destination,
        }
      : null,
  });
}

/**
 * Safe variant returning typed non-public result instead of throw.
 * @param {Record<string, unknown>} content
 * @param {{ now: string, allowLive?: boolean, requireLiveProvenance?: boolean }} ctx
 */
export function tryProjectPublicContent(content, ctx) {
  try {
    return Object.freeze({
      ok: true,
      value: projectPublicContent(content, ctx),
    });
  } catch (err) {
    return Object.freeze({
      ok: false,
      error: err,
    });
  }
}
