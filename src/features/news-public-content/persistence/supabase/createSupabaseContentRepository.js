/**
 * Supabase ContentRepositoryPort adapter (NEWS-02).
 *
 * Injected client only. No mock fallback. No import-time network.
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../../errors/errorCodes.js";
import { NewsPublicContentError } from "../../errors/NewsPublicContentError.js";
import { matchesContentRepositoryPort } from "../../ports/contentRepositoryPort.js";
import { NEWS_RPC, NEWS_TABLE } from "../schema.js";
import { assertSupabaseNewsClient } from "./clientContract.js";
import { mapSupabaseNewsError } from "./errorMapping.js";
import {
  domainToApprovalRow,
  domainToCategoryRefRows,
  domainToItemRow,
  domainToMediaRefRows,
  domainToRevisionRow,
  domainToReviewRow,
  domainToTagRefRows,
  publicRpcRowToCandidate,
  rowsToDomainAggregate,
} from "./rowMappers.js";

/**
 * @param {{ client: object, preferRpc?: boolean }} options
 */
export function createSupabaseContentRepository(options) {
  const client = assertSupabaseNewsClient(options?.client);
  const preferRpc = options?.preferRpc !== false;

  const repository = {
    async getByContentId(contentId) {
      if (!contentId || typeof contentId !== "string") {
        throw new NewsPublicContentError(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTENT_IDENTITY,
          "contentId is required",
          { field: "contentId" }
        );
      }
      try {
        const { data: item, error: itemError } = await client
          .from(NEWS_TABLE.ITEMS)
          .select("*")
          .eq("content_id", contentId)
          .maybeSingle();
        if (itemError) throw mapSupabaseNewsError(itemError, { contentId, operation: "getByContentId" });
        if (!item) return null;

        const revisionId = item.current_revision_id;
        if (!revisionId) {
          throw new NewsPublicContentError(
            NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_REVISION_VERSION,
            "Content row is missing current_revision_id",
            { contentId }
          );
        }

        const { data: revision, error: revError } = await client
          .from(NEWS_TABLE.REVISIONS)
          .select("*")
          .eq("revision_id", revisionId)
          .maybeSingle();
        if (revError) throw mapSupabaseNewsError(revError, { contentId, operation: "getByContentId" });
        if (!revision) return null;

        const [categories, tags, media, review, approval] = await Promise.all([
          loadRefs(client, NEWS_TABLE.CATEGORY_REFS, contentId, revisionId),
          loadRefs(client, NEWS_TABLE.TAG_REFS, contentId, revisionId),
          loadRefs(client, NEWS_TABLE.MEDIA_REFS, contentId, revisionId),
          loadLatestDecision(client, NEWS_TABLE.REVIEWS, contentId),
          loadLatestDecision(client, NEWS_TABLE.APPROVALS, contentId),
        ]);

        return rowsToDomainAggregate({
          item,
          revision,
          categories,
          tags,
          media,
          review,
          approval,
        });
      } catch (err) {
        if (err instanceof NewsPublicContentError) throw err;
        throw mapSupabaseNewsError(err, { contentId, operation: "getByContentId" });
      }
    },

    async save(content) {
      if (!content || typeof content !== "object" || !content.contentId) {
        throw new NewsPublicContentError(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
          "save requires a content aggregate",
          { field: "content" }
        );
      }
      const contentId = content.contentId;
      const expectedPrevious =
        content.version > 1 ? content.version - 1 : null;

      try {
        if (preferRpc && typeof client.rpc === "function") {
          const item = domainToItemRow(content);
          const revision = domainToRevisionRow(content);
          const { data, error } = await client.rpc(NEWS_RPC.SAVE_AGGREGATE, {
            p_item: item,
            p_revision: revision,
            p_category_refs: domainToCategoryRefRows(content),
            p_tag_refs: domainToTagRefRows(content),
            p_media_refs: domainToMediaRefRows(content),
            p_review: domainToReviewRow(content),
            p_approval: domainToApprovalRow(content),
            p_expected_row_version: expectedPrevious,
          });
          if (error) {
            throw mapSupabaseNewsError(error, {
              contentId,
              operation: "save",
              expectedVersion: expectedPrevious ?? 1,
            });
          }
          return data;
        }

        // Direct table path (service_role / tests): CAS on row_version
        return await saveViaTables(client, content, expectedPrevious);
      } catch (err) {
        if (err instanceof NewsPublicContentError) throw err;
        throw mapSupabaseNewsError(err, {
          contentId,
          operation: "save",
          expectedVersion: expectedPrevious ?? 1,
        });
      }
    },

    async queryPublicCandidates(query = {}) {
      try {
        if (preferRpc && typeof client.rpc === "function") {
          const { data, error } = await client.rpc(NEWS_RPC.QUERY_PUBLIC, {
            p_now: query.now || new Date().toISOString(),
            p_locale: query.locale ?? null,
            p_content_scope: query.contentScope ?? null,
            p_limit: query.limit ?? 50,
          });
          if (error) {
            throw mapSupabaseNewsError(error, { operation: "queryPublicCandidates" });
          }
          const rows = Array.isArray(data) ? data : data ? [data] : [];
          return Object.freeze(rows.map(publicRpcRowToCandidate));
        }

        const { data, error } = await client
          .from(NEWS_TABLE.ITEMS)
          .select("*")
          .eq("editorial_status", "PUBLISHED")
          .eq("public_visibility", "PUBLIC")
          .is("archived_at", null)
          .neq("provenance", "MOCK");
        if (error) {
          throw mapSupabaseNewsError(error, { operation: "queryPublicCandidates" });
        }
        const items = Array.isArray(data) ? data : [];
        const out = [];
        for (const item of items) {
          if (!item.published_revision_id) continue;
          const { data: revision } = await client
            .from(NEWS_TABLE.REVISIONS)
            .select("*")
            .eq("revision_id", item.published_revision_id)
            .maybeSingle();
          if (!revision) continue;
          out.push(
            rowsToDomainAggregate({
              item,
              revision,
              categories: [],
              tags: [],
              media: [],
              review: null,
              approval: null,
            })
          );
        }
        return Object.freeze(out);
      } catch (err) {
        if (err instanceof NewsPublicContentError) throw err;
        throw mapSupabaseNewsError(err, { operation: "queryPublicCandidates" });
      }
    },

    async findSlugCollision({
      slug,
      locale,
      contentScope,
      tenantId,
      excludeContentId,
    }) {
      try {
        let builder = client
          .from(NEWS_TABLE.REVISIONS)
          .select("*")
          .eq("slug", slug)
          .eq("locale", locale);
        if (contentScope) builder = builder.eq("content_scope", contentScope);
        if (tenantId) builder = builder.eq("tenant_id", tenantId);
        const { data, error } = await builder.limit(5);
        if (error) {
          throw mapSupabaseNewsError(error, { operation: "findSlugCollision" });
        }
        const rows = Array.isArray(data) ? data : [];
        const hit = rows.find(
          (r) => !excludeContentId || r.content_id !== excludeContentId
        );
        if (!hit) return null;
        return repository.getByContentId(hit.content_id);
      } catch (err) {
        if (err instanceof NewsPublicContentError) throw err;
        throw mapSupabaseNewsError(err, { operation: "findSlugCollision" });
      }
    },

    async detectVersionConflict({ contentId, expectedVersion }) {
      try {
        const { data, error } = await client
          .from(NEWS_TABLE.ITEMS)
          .select("content_id,row_version")
          .eq("content_id", contentId)
          .maybeSingle();
        if (error) {
          throw mapSupabaseNewsError(error, {
            contentId,
            operation: "detectVersionConflict",
          });
        }
        if (!data) return null;
        if (data.row_version === expectedVersion) return null;
        return Object.freeze({
          contentId,
          expectedVersion,
          actualVersion: data.row_version,
        });
      } catch (err) {
        if (err instanceof NewsPublicContentError) throw err;
        throw mapSupabaseNewsError(err, {
          contentId,
          operation: "detectVersionConflict",
        });
      }
    },
  };

  if (!matchesContentRepositoryPort(repository)) {
    throw new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
      "Supabase adapter does not satisfy ContentRepositoryPort",
      {}
    );
  }

  return Object.freeze(repository);
}

async function loadRefs(client, table, contentId, revisionId) {
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq("content_id", contentId)
    .eq("revision_id", revisionId)
    .order("sort_order", { ascending: true });
  if (error) throw mapSupabaseNewsError(error, { contentId, operation: "loadRefs" });
  return Array.isArray(data) ? data : [];
}

async function loadLatestDecision(client, table, contentId) {
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq("content_id", contentId)
    .order("decided_at", { ascending: false })
    .limit(1);
  if (error) {
    throw mapSupabaseNewsError(error, { contentId, operation: "loadLatestDecision" });
  }
  const rows = Array.isArray(data) ? data : [];
  return rows[0] || null;
}

async function saveViaTables(client, content, expectedPrevious) {
  const contentId = content.contentId;
  const item = domainToItemRow(content);
  const revision = domainToRevisionRow(content);

  const { data: existing, error: existingError } = await client
    .from(NEWS_TABLE.ITEMS)
    .select("content_id,row_version")
    .eq("content_id", contentId)
    .maybeSingle();
  if (existingError) {
    throw mapSupabaseNewsError(existingError, { contentId, operation: "save" });
  }

  if (!existing) {
    if (content.version !== 1) {
      throw new NewsPublicContentError(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.VERSION_CONFLICT,
        "Create requires version=1",
        { contentId, expectedVersion: 1, actualVersion: content.version }
      );
    }
    const insertItem = { ...item, current_revision_id: null };
    const { error: insertError } = await client
      .from(NEWS_TABLE.ITEMS)
      .insert(insertItem);
    if (insertError) {
      throw mapSupabaseNewsError(insertError, { contentId, operation: "save" });
    }
  } else {
    if (
      expectedPrevious != null &&
      existing.row_version !== expectedPrevious
    ) {
      throw new NewsPublicContentError(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.VERSION_CONFLICT,
        "Stale expected version",
        {
          contentId,
          expectedVersion: expectedPrevious,
          actualVersion: existing.row_version,
        }
      );
    }
    const { data: updated, error: updateError } = await client
      .from(NEWS_TABLE.ITEMS)
      .update({ ...item, current_revision_id: null })
      .eq("content_id", contentId)
      .eq("row_version", existing.row_version)
      .select("*");
    if (updateError) {
      throw mapSupabaseNewsError(updateError, {
        contentId,
        operation: "save",
        expectedVersion: expectedPrevious ?? undefined,
        actualVersion: existing.row_version,
      });
    }
    if (!updated || (Array.isArray(updated) && updated.length === 0)) {
      throw new NewsPublicContentError(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.VERSION_CONFLICT,
        "CAS update matched zero rows",
        {
          contentId,
          expectedVersion: expectedPrevious ?? undefined,
          actualVersion: existing.row_version,
        }
      );
    }
  }

  const { error: revError } = await client
    .from(NEWS_TABLE.REVISIONS)
    .insert(revision);
  if (revError) {
    // Same revision re-save is allowed (immutable already present)
    const isDup =
      revError.code === "23505" ||
      String(revError.message || "")
        .toLowerCase()
        .includes("duplicate");
    if (!isDup) {
      throw mapSupabaseNewsError(revError, { contentId, operation: "save" });
    }
  }

  await client
    .from(NEWS_TABLE.ITEMS)
    .update({ current_revision_id: content.revisionId })
    .eq("content_id", contentId);

  await replaceRefs(client, content);

  const review = domainToReviewRow(content);
  if (review) {
    await client.from(NEWS_TABLE.REVIEWS).insert(review);
  }
  const approval = domainToApprovalRow(content);
  if (approval) {
    if (
      approval.revision_id !== content.revisionId ||
      approval.revision_version !== content.version
    ) {
      throw new NewsPublicContentError(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.APPROVAL_REVISION_MISMATCH,
        "Approval must bind to current revision",
        { contentId }
      );
    }
    await client.from(NEWS_TABLE.APPROVALS).insert(approval);
  }

  return content;
}

async function replaceRefs(client, content) {
  const contentId = content.contentId;
  const revisionId = content.revisionId;
  for (const table of [
    NEWS_TABLE.CATEGORY_REFS,
    NEWS_TABLE.TAG_REFS,
    NEWS_TABLE.MEDIA_REFS,
  ]) {
    await client
      .from(table)
      .delete()
      .eq("content_id", contentId)
      .eq("revision_id", revisionId);
  }
  const categories = domainToCategoryRefRows(content);
  const tags = domainToTagRefRows(content);
  const media = domainToMediaRefRows(content);
  if (categories.length) {
    await client.from(NEWS_TABLE.CATEGORY_REFS).insert(categories);
  }
  if (tags.length) {
    await client.from(NEWS_TABLE.TAG_REFS).insert(tags);
  }
  if (media.length) {
    await client.from(NEWS_TABLE.MEDIA_REFS).insert(media);
  }
}
