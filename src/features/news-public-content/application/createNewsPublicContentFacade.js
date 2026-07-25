/**
 * Single public facade for News & Public Content (NEWS-01).
 * Canonical factory: createNewsPublicContentFacade / newsPublicContentFacade.
 */

import { EDITORIAL_STATUS } from "../constants/editorialLifecycle.js";
import { createDraftContent } from "../domain/contentAggregate.js";
import { applyLifecycleTransition } from "../domain/lifecyclePolicy.js";
import { evaluatePublicationEligibility } from "../domain/publicationEligibility.js";
import {
  assertVersionMatch,
  createContentRevision,
} from "../domain/revisionVersion.js";
import { createReviewDecision } from "../contracts/reviewDecision.js";
import {
  APPROVAL_DECISION,
  createApprovalDecision,
} from "../contracts/approvalDecision.js";
import { createPublicationWindow } from "../contracts/publicationWindow.js";
import { deepFreeze } from "../contracts/shared.js";
import {
  tryProjectPublicContent,
  projectPublicContent,
} from "../projections/publicContentProjection.js";
import {
  matchesClockPort,
  matchesContentRepositoryPort,
  matchesIdProviderPort,
} from "../ports/index.js";
import {
  newsFailFromCaught,
  newsOk,
  projectNewsOperationInstant,
} from "../platform/newsPlatformAdoption.js";
import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import { NewsPublicContentError } from "../errors/NewsPublicContentError.js";

/**
 * @typedef {Object} NewsPublicContentFacadeDeps
 * @property {{ getByContentId: Function, save: Function, queryPublicCandidates?: Function, findSlugCollision?: Function, detectVersionConflict?: Function }} repository
 * @property {{ now: () => string }} clock
 * @property {{ nextId: (prefix?: string) => string }} idProvider
 */

/**
 * @param {NewsPublicContentFacadeDeps} deps
 */
export function createNewsPublicContentFacade(deps) {
  if (!deps || !matchesContentRepositoryPort(deps.repository)) {
    throw new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
      "createNewsPublicContentFacade requires a ContentRepositoryPort",
      { field: "repository" }
    );
  }
  if (!matchesClockPort(deps.clock)) {
    throw new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
      "createNewsPublicContentFacade requires a ClockPort",
      { field: "clock" }
    );
  }
  if (!matchesIdProviderPort(deps.idProvider)) {
    throw new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
      "createNewsPublicContentFacade requires an IdProviderPort",
      { field: "idProvider" }
    );
  }

  const { repository, clock, idProvider } = deps;

  /**
   * @returns {string}
   */
  function nowOrThrow() {
    const instant = clock.now();
    const parsed = projectNewsOperationInstant(instant);
    if (!parsed.ok) {
      throw new NewsPublicContentError(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_PUBLICATION_WINDOW,
        "ClockPort.now must return a strict ISO instant",
        { value: instant }
      );
    }
    return /** @type {string} */ (parsed.value);
  }

  /**
   * @param {string} contentId
   */
  async function loadRequired(contentId) {
    const found = await repository.getByContentId(contentId);
    if (!found) {
      throw new NewsPublicContentError(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.CONTENT_NOT_FOUND,
        "Content not found",
        { contentId }
      );
    }
    return found;
  }

  /**
   * @param {Record<string, unknown>} content
   */
  async function persist(content) {
    await repository.save(content);
    return content;
  }

  const api = {
    /**
     * @param {Record<string, unknown>} input
     */
    async createDraft(input) {
      try {
        const now = nowOrThrow();
        const content = createDraftContent(input || {}, {
          contentSeed: idProvider.nextId("cnt"),
          revisionSeed: idProvider.nextId("rev"),
          createdAt: now,
        });
        if (typeof repository.findSlugCollision === "function") {
          const collision = await repository.findSlugCollision({
            slug: content.slug,
            locale: content.locale,
            contentScope: content.contentScope,
            tenantId: content.tenantId,
            excludeContentId: null,
          });
          if (collision) {
            throw new NewsPublicContentError(
              NEWS_PUBLIC_CONTENT_ERROR_CODE.VERSION_CONFLICT,
              "Slug collision detected",
              { slug: content.slug, locale: content.locale }
            );
          }
        }
        await persist(content);
        return newsOk(content);
      } catch (err) {
        return newsFailFromCaught(err);
      }
    },

    /**
     * @param {{ contentId: string, expectedVersion: number, patch: Record<string, unknown> }} input
     */
    async createRevision(input) {
      try {
        const now = nowOrThrow();
        const current = await loadRequired(input.contentId);
        assertVersionMatch(current, input.expectedVersion);
        if (current.editorialStatus === EDITORIAL_STATUS.ARCHIVED) {
          throw new NewsPublicContentError(
            NEWS_PUBLIC_CONTENT_ERROR_CODE.ARCHIVED_CONTENT,
            "Cannot revise archived content",
            { contentId: current.contentId }
          );
        }
        // Do not silently mutate approved/published revision in place — always new revision.
        let next = createContentRevision(current, input.patch || {}, {
          revisionSeed: idProvider.nextId("rev"),
          updatedAt: now,
        });
        // After content edit of published/approved/scheduled, return to DRAFT for re-review.
        if (
          [
            EDITORIAL_STATUS.APPROVED,
            EDITORIAL_STATUS.SCHEDULED,
            EDITORIAL_STATUS.PUBLISHED,
            EDITORIAL_STATUS.IN_REVIEW,
          ].includes(current.editorialStatus)
        ) {
          next = deepFreeze({
            ...next,
            editorialStatus: EDITORIAL_STATUS.DRAFT,
          });
        }
        await persist(next);
        return newsOk(next);
      } catch (err) {
        return newsFailFromCaught(err);
      }
    },

    /**
     * @param {{ contentId: string, expectedVersion: number }} input
     */
    async submitForReview(input) {
      return transition(input, EDITORIAL_STATUS.IN_REVIEW, {});
    },

    /**
     * @param {{ contentId: string, expectedVersion: number, reviewerId: string, reason?: string }} input
     */
    async requestChanges(input) {
      try {
        const now = nowOrThrow();
        const current = await loadRequired(input.contentId);
        assertVersionMatch(current, input.expectedVersion);
        const review = createReviewDecision({
          reviewerId: input.reviewerId,
          decision: "REQUEST_CHANGES",
          decidedAt: now,
          reason: input.reason,
          revisionId: current.revisionId,
          version: current.version,
        });
        const next = applyLifecycleTransition(
          current,
          EDITORIAL_STATUS.DRAFT,
          { now, review, updatedAt: now }
        );
        await persist(next);
        return newsOk(next);
      } catch (err) {
        return newsFailFromCaught(err);
      }
    },

    /**
     * @param {{ contentId: string, expectedVersion: number, approverId: string, reason?: string }} input
     */
    async approve(input) {
      try {
        const now = nowOrThrow();
        const current = await loadRequired(input.contentId);
        assertVersionMatch(current, input.expectedVersion);
        const approval = createApprovalDecision({
          approverId: input.approverId,
          decision: APPROVAL_DECISION.APPROVED,
          decidedAt: now,
          reason: input.reason,
          revisionId: current.revisionId,
          version: current.version,
        });
        const next = applyLifecycleTransition(
          current,
          EDITORIAL_STATUS.APPROVED,
          { now, approval, updatedAt: now }
        );
        await persist(next);
        return newsOk(next);
      } catch (err) {
        return newsFailFromCaught(err);
      }
    },

    /**
     * @param {{ contentId: string, expectedVersion: number, publicationWindow: Record<string, unknown> }} input
     */
    async schedule(input) {
      try {
        const now = nowOrThrow();
        const current = await loadRequired(input.contentId);
        assertVersionMatch(current, input.expectedVersion);
        const publicationWindow = createPublicationWindow(
          input.publicationWindow || {}
        );
        const next = applyLifecycleTransition(
          current,
          EDITORIAL_STATUS.SCHEDULED,
          { now, publicationWindow, updatedAt: now }
        );
        await persist(next);
        return newsOk(next);
      } catch (err) {
        return newsFailFromCaught(err);
      }
    },

    /**
     * @param {{ contentId: string, expectedVersion: number, publicationWindow?: Record<string, unknown>, now?: string }} input
     */
    async publish(input) {
      try {
        const now = input.now || nowOrThrow();
        const parsed = projectNewsOperationInstant(now);
        if (!parsed.ok) return parsed;
        const current = await loadRequired(input.contentId);
        assertVersionMatch(current, input.expectedVersion);
        const publicationWindow = input.publicationWindow
          ? createPublicationWindow(input.publicationWindow)
          : current.publicationWindow;
        const next = applyLifecycleTransition(
          current,
          EDITORIAL_STATUS.PUBLISHED,
          {
            now: /** @type {string} */ (parsed.value),
            publicationWindow,
            updatedAt: /** @type {string} */ (parsed.value),
          }
        );
        // NEWS-01: published domain objects keep PREVIEW/MOCK provenance; LIVE deferred to NEWS-02+.
        await persist(next);
        return newsOk(next);
      } catch (err) {
        return newsFailFromCaught(err);
      }
    },

    /**
     * @param {{ contentId: string, expectedVersion: number }} input
     */
    async unpublish(input) {
      return transition(input, EDITORIAL_STATUS.UNPUBLISHED, {});
    },

    /**
     * @param {{ contentId: string, expectedVersion: number }} input
     */
    async archive(input) {
      return transition(input, EDITORIAL_STATUS.ARCHIVED, {});
    },

    /**
     * Cancel schedule → APPROVED.
     * @param {{ contentId: string, expectedVersion: number }} input
     */
    async cancelSchedule(input) {
      return transition(input, EDITORIAL_STATUS.APPROVED, {});
    },

    /**
     * Re-approve unpublished content when approval still bound (policy path).
     * @param {{ contentId: string, expectedVersion: number }} input
     */
    async restoreApproved(input) {
      return transition(input, EDITORIAL_STATUS.APPROVED, {});
    },

    /**
     * @param {{ contentId: string, now?: string }} input
     */
    async evaluatePublicationEligibility(input) {
      try {
        const now = input.now || nowOrThrow();
        const current = await loadRequired(input.contentId);
        const result = evaluatePublicationEligibility(current, { now });
        return newsOk(deepFreeze(result));
      } catch (err) {
        return newsFailFromCaught(err);
      }
    },

    /**
     * @param {{ contentId: string, now?: string, allowLive?: boolean }} input
     */
    async projectPublicContent(input) {
      try {
        const now = input.now || nowOrThrow();
        const current = await loadRequired(input.contentId);
        const projected = projectPublicContent(current, {
          now,
          allowLive: Boolean(input.allowLive),
        });
        return newsOk(projected);
      } catch (err) {
        return newsFailFromCaught(err);
      }
    },

    /**
     * @param {{ contentId: string, now?: string }} input
     */
    async tryProjectPublicContent(input) {
      try {
        const now = input.now || nowOrThrow();
        const current = await loadRequired(input.contentId);
        return newsOk(tryProjectPublicContent(current, { now }));
      } catch (err) {
        return newsFailFromCaught(err);
      }
    },

    /**
     * @param {{ contentId: string }} input
     */
    async getByContentId(input) {
      try {
        const current = await loadRequired(input.contentId);
        return newsOk(current);
      } catch (err) {
        return newsFailFromCaught(err);
      }
    },

    /**
     * Query public candidates via repository port (no durable adapter in NEWS-01).
     * @param {Record<string, unknown>} [query]
     */
    async queryPublicCandidates(query = {}) {
      try {
        if (typeof repository.queryPublicCandidates !== "function") {
          throw new NewsPublicContentError(
            NEWS_PUBLIC_CONTENT_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
            "queryPublicCandidates is not available on repository",
            {}
          );
        }
        const rows = await repository.queryPublicCandidates(query);
        return newsOk(Object.freeze([...(rows || [])]));
      } catch (err) {
        return newsFailFromCaught(err);
      }
    },
  };

  /**
   * @param {{ contentId: string, expectedVersion: number }} input
   * @param {string} toStatus
   * @param {Record<string, unknown>} extra
   */
  async function transition(input, toStatus, extra) {
    try {
      const now = nowOrThrow();
      const current = await loadRequired(input.contentId);
      assertVersionMatch(current, input.expectedVersion);
      const next = applyLifecycleTransition(current, toStatus, {
        now,
        updatedAt: now,
        ...extra,
      });
      await persist(next);
      return newsOk(next);
    } catch (err) {
      return newsFailFromCaught(err);
    }
  }

  return Object.freeze(api);
}

/** Canonical facade factory alias preferred by NEWS-01 workstream. */
export const newsPublicContentFacade = createNewsPublicContentFacade;

export const NEWS_PUBLIC_CONTENT_FACADE_METHODS = Object.freeze([
  "createDraft",
  "createRevision",
  "submitForReview",
  "requestChanges",
  "approve",
  "schedule",
  "publish",
  "unpublish",
  "archive",
  "cancelSchedule",
  "restoreApproved",
  "evaluatePublicationEligibility",
  "projectPublicContent",
  "tryProjectPublicContent",
  "getByContentId",
  "queryPublicCandidates",
]);
