/**
 * Row ↔ domain mapping for News durable persistence (NEWS-02).
 */

import { deepFreeze } from "../../contracts/shared.js";

/**
 * @param {Record<string, unknown>} content domain aggregate
 */
export function domainToItemRow(content) {
  const window = content.publicationWindow || {};
  return {
    content_id: content.contentId,
    content_type: content.contentType,
    content_scope: content.contentScope,
    tenant_id: content.tenantId ?? null,
    venue_id: content.venueId ?? null,
    club_id: content.clubId ?? null,
    competition_id: content.competitionId ?? null,
    author_id: content.authorId,
    editorial_owner_id: content.editorialOwnerId,
    editorial_status: content.editorialStatus,
    public_visibility: content.publicVisibility,
    provenance: content.provenance,
    current_revision_id: content.revisionId ?? null,
    approved_revision_id:
      content.approval && content.approval.decision === "APPROVED"
        ? content.approval.revisionId
        : null,
    published_revision_id:
      content.editorialStatus === "PUBLISHED" ? content.revisionId : null,
    publish_at: window.publishAt ?? null,
    unpublish_at: window.unpublishAt ?? null,
    publication_timezone: window.timezone ?? null,
    published_at: content.publishedAt ?? null,
    unpublished_at: content.unpublishedAt ?? null,
    archived_at: content.archivedAt ?? null,
    row_version: content.version,
    created_at: content.createdAt,
    updated_at: content.updatedAt,
  };
}

/**
 * @param {Record<string, unknown>} content
 */
export function domainToRevisionRow(content) {
  return {
    revision_id: content.revisionId,
    content_id: content.contentId,
    version: content.version,
    content_scope: content.contentScope,
    tenant_id: content.tenantId ?? null,
    venue_id: content.venueId ?? null,
    club_id: content.clubId ?? null,
    competition_id: content.competitionId ?? null,
    title: content.title,
    summary: content.summary ?? "",
    slug: content.slug,
    locale: content.locale,
    body_payload: {},
    seo_metadata: content.seoMetadata || {},
    banner_payload: content.banner ?? null,
    sponsor_payload: content.sponsor ?? null,
    created_by: content.editorialOwnerId || content.authorId,
    created_at: content.updatedAt || content.createdAt,
  };
}

/**
 * @param {Record<string, unknown>} content
 */
export function domainToCategoryRefRows(content) {
  const list = Array.isArray(content.categoryReferences)
    ? content.categoryReferences
    : [];
  return list.map((ref, index) => ({
    content_id: content.contentId,
    revision_id: content.revisionId,
    category_id: ref.categoryId,
    slug: ref.slug,
    display_label: ref.displayLabel,
    locale: ref.locale,
    sort_order: index,
  }));
}

/**
 * @param {Record<string, unknown>} content
 */
export function domainToTagRefRows(content) {
  const list = Array.isArray(content.tagReferences) ? content.tagReferences : [];
  return list.map((ref, index) => ({
    content_id: content.contentId,
    revision_id: content.revisionId,
    tag_id: ref.tagId,
    slug: ref.slug,
    label: ref.label,
    locale: ref.locale,
    sort_order: index,
  }));
}

/**
 * @param {Record<string, unknown>} content
 */
export function domainToMediaRefRows(content) {
  const list = Array.isArray(content.mediaReferences)
    ? content.mediaReferences
    : [];
  return list.map((ref, index) => ({
    content_id: content.contentId,
    revision_id: content.revisionId,
    media_id: ref.mediaId,
    media_kind: ref.mediaKind,
    url: ref.url,
    alt_text: ref.altText ?? null,
    caption: ref.caption ?? null,
    locale: ref.locale ?? null,
    attribution: ref.attribution ?? null,
    sort_order: index,
  }));
}

/**
 * @param {Record<string, unknown>} content
 */
export function domainToReviewRow(content) {
  const review = content.review;
  if (!review) return null;
  return {
    review_id: `revw_${content.contentId}_${review.version || content.version}`,
    content_id: content.contentId,
    revision_id: review.revisionId || content.revisionId,
    revision_version: review.version || content.version,
    reviewer_id: review.reviewerId,
    decision: review.decision,
    comment_text: review.reason ?? null,
    decided_at: review.decidedAt,
  };
}

/**
 * @param {Record<string, unknown>} content
 */
export function domainToApprovalRow(content) {
  const approval = content.approval;
  if (!approval) return null;
  return {
    approval_id: `appr_${content.contentId}_${approval.version || content.version}`,
    content_id: content.contentId,
    revision_id: approval.revisionId || content.revisionId,
    revision_version: approval.version || content.version,
    approver_id: approval.approverId,
    decision: approval.decision,
    reason: approval.reason ?? null,
    decided_at: approval.decidedAt,
  };
}

/**
 * Assemble domain aggregate from item + revision + refs + latest review/approval.
 * @param {{
 *   item: Record<string, unknown>,
 *   revision: Record<string, unknown>,
 *   categories?: object[],
 *   tags?: object[],
 *   media?: object[],
 *   review?: object|null,
 *   approval?: object|null,
 * }} parts
 */
export function rowsToDomainAggregate(parts) {
  const item = parts.item;
  const revision = parts.revision;
  const review = parts.review
    ? Object.freeze({
        reviewerId: parts.review.reviewer_id,
        decision: parts.review.decision,
        decidedAt: parts.review.decided_at,
        reason: parts.review.comment_text ?? undefined,
        revisionId: parts.review.revision_id,
        version: parts.review.revision_version,
      })
    : null;
  const approval = parts.approval
    ? Object.freeze({
        approverId: parts.approval.approver_id,
        decision: parts.approval.decision,
        decidedAt: parts.approval.decided_at,
        reason: parts.approval.reason ?? undefined,
        revisionId: parts.approval.revision_id,
        version: parts.approval.revision_version,
      })
    : null;

  return deepFreeze({
    contentId: item.content_id,
    contentType: item.content_type,
    contentScope: item.content_scope,
    tenantId: item.tenant_id ?? null,
    venueId: item.venue_id ?? null,
    clubId: item.club_id ?? null,
    competitionId: item.competition_id ?? null,
    authorId: item.author_id,
    editorialOwnerId: item.editorial_owner_id,
    title: revision.title,
    summary: revision.summary ?? "",
    slug: revision.slug,
    locale: revision.locale,
    categoryReferences: Object.freeze(
      (parts.categories || []).map((c) =>
        Object.freeze({
          categoryId: c.category_id,
          slug: c.slug,
          displayLabel: c.display_label,
          locale: c.locale,
        })
      )
    ),
    tagReferences: Object.freeze(
      (parts.tags || []).map((t) =>
        Object.freeze({
          tagId: t.tag_id,
          slug: t.slug,
          label: t.label,
          locale: t.locale,
        })
      )
    ),
    mediaReferences: Object.freeze(
      (parts.media || []).map((m) =>
        Object.freeze({
          mediaId: m.media_id,
          mediaKind: m.media_kind,
          url: m.url,
          altText: m.alt_text ?? undefined,
          caption: m.caption ?? undefined,
          locale: m.locale ?? undefined,
          attribution: m.attribution ?? undefined,
        })
      )
    ),
    seoMetadata: revision.seo_metadata || {},
    banner: revision.banner_payload ?? null,
    sponsor: revision.sponsor_payload ?? null,
    revisionId: revision.revision_id,
    version: item.row_version,
    editorialStatus: item.editorial_status,
    review,
    approval,
    publicationWindow: Object.freeze({
      publishAt: item.publish_at ?? null,
      unpublishAt: item.unpublish_at ?? null,
      timezone: item.publication_timezone ?? null,
    }),
    publicVisibility: item.public_visibility,
    provenance: item.provenance,
    publishedAt: item.published_at ?? null,
    unpublishedAt: item.unpublished_at ?? null,
    archivedAt: item.archived_at ?? null,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  });
}

/**
 * Map public RPC row → public candidate shape (pre-projection).
 * @param {Record<string, unknown>} row
 */
export function publicRpcRowToCandidate(row) {
  return deepFreeze({
    contentId: row.content_id,
    contentType: row.content_type,
    contentScope: row.content_scope,
    title: row.title,
    summary: row.summary,
    slug: row.slug,
    locale: row.locale,
    categoryReferences: row.category_references || [],
    tagReferences: row.tag_references || [],
    mediaReferences: row.media_references || [],
    seoMetadata: row.seo_metadata || {},
    publishedAt: row.published_at ?? null,
    publicationWindow: Object.freeze({
      publishAt: row.publish_at ?? null,
      unpublishAt: row.unpublish_at ?? null,
      timezone: row.publication_timezone ?? null,
    }),
    revisionId: row.revision_id,
    version: row.version,
    provenance: row.provenance,
    editorialStatus: "PUBLISHED",
    publicVisibility: "PUBLIC",
    tenantId: row.tenant_id ?? null,
    venueId: row.venue_id ?? null,
    clubId: row.club_id ?? null,
    competitionId: row.competition_id ?? null,
    banner: row.banner ?? null,
    sponsor: row.sponsor ?? null,
    archivedAt: null,
  });
}
