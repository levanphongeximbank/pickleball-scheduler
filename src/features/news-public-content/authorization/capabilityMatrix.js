/**
 * NEWS-02 — Editorial authorization capability matrix.
 *
 * Fail-closed. Maps Platform actor + scope + verified permission names.
 * SQL permissions: news.view | news.edit | news.review | news.approve | news.publish | news.admin
 * Trusted backend / service_role is the durable write path (Customer-03 pattern).
 *
 * Authored SQL is NOT applied. Staging/Production unchanged until NEWS-03.
 */

export const NEWS_EDITORIAL_CAPABILITY = Object.freeze({
  CREATE_DRAFT: "create_draft",
  READ_EDITORIAL: "read_editorial",
  EDIT_DRAFT: "edit_draft",
  SUBMIT_FOR_REVIEW: "submit_for_review",
  REVIEW: "review",
  APPROVE: "approve",
  SCHEDULE: "schedule",
  PUBLISH: "publish",
  UNPUBLISH: "unpublish",
  ARCHIVE: "archive",
  PREVIEW: "preview",
  PUBLIC_READ: "public_read",
});

export const NEWS_EDITORIAL_CAPABILITY_VALUES = Object.freeze(
  Object.values(NEWS_EDITORIAL_CAPABILITY)
);

export const NEWS_PERMISSION = Object.freeze({
  VIEW: "news.view",
  EDIT: "news.edit",
  REVIEW: "news.review",
  APPROVE: "news.approve",
  PUBLISH: "news.publish",
  ADMIN: "news.admin",
});

export const NEWS_AUTH_ACTOR_KIND = Object.freeze({
  ANON: "anon",
  AUTHENTICATED_UNRELATED: "authenticated_unrelated",
  TENANT_MEMBER_NO_EDITORIAL: "tenant_member_without_editorial",
  AUTHOR: "author",
  EDITOR: "editor",
  REVIEWER: "reviewer",
  APPROVER: "approver",
  PUBLISHER: "publisher",
  TENANT_ADMINISTRATOR: "tenant_administrator",
  PLATFORM_ADMINISTRATOR: "platform_administrator",
  TRUSTED_BACKEND: "trusted_backend_service_role",
});

export const NEWS_AUTH_DECISION = Object.freeze({
  ALLOW: "ALLOW",
  DENY: "DENY",
});

/**
 * Permission sets required for each capability (any-of within set).
 */
export const NEWS_CAPABILITY_PERMISSION_MAP = Object.freeze({
  [NEWS_EDITORIAL_CAPABILITY.CREATE_DRAFT]: Object.freeze([
    NEWS_PERMISSION.EDIT,
    NEWS_PERMISSION.ADMIN,
  ]),
  [NEWS_EDITORIAL_CAPABILITY.READ_EDITORIAL]: Object.freeze([
    NEWS_PERMISSION.VIEW,
    NEWS_PERMISSION.EDIT,
    NEWS_PERMISSION.REVIEW,
    NEWS_PERMISSION.APPROVE,
    NEWS_PERMISSION.PUBLISH,
    NEWS_PERMISSION.ADMIN,
  ]),
  [NEWS_EDITORIAL_CAPABILITY.EDIT_DRAFT]: Object.freeze([
    NEWS_PERMISSION.EDIT,
    NEWS_PERMISSION.ADMIN,
  ]),
  [NEWS_EDITORIAL_CAPABILITY.SUBMIT_FOR_REVIEW]: Object.freeze([
    NEWS_PERMISSION.EDIT,
    NEWS_PERMISSION.ADMIN,
  ]),
  [NEWS_EDITORIAL_CAPABILITY.REVIEW]: Object.freeze([
    NEWS_PERMISSION.REVIEW,
    NEWS_PERMISSION.ADMIN,
  ]),
  [NEWS_EDITORIAL_CAPABILITY.APPROVE]: Object.freeze([
    NEWS_PERMISSION.APPROVE,
    NEWS_PERMISSION.ADMIN,
  ]),
  [NEWS_EDITORIAL_CAPABILITY.SCHEDULE]: Object.freeze([
    NEWS_PERMISSION.PUBLISH,
    NEWS_PERMISSION.ADMIN,
  ]),
  [NEWS_EDITORIAL_CAPABILITY.PUBLISH]: Object.freeze([
    NEWS_PERMISSION.PUBLISH,
    NEWS_PERMISSION.ADMIN,
  ]),
  [NEWS_EDITORIAL_CAPABILITY.UNPUBLISH]: Object.freeze([
    NEWS_PERMISSION.PUBLISH,
    NEWS_PERMISSION.ADMIN,
  ]),
  [NEWS_EDITORIAL_CAPABILITY.ARCHIVE]: Object.freeze([
    NEWS_PERMISSION.PUBLISH,
    NEWS_PERMISSION.ADMIN,
  ]),
  [NEWS_EDITORIAL_CAPABILITY.PREVIEW]: Object.freeze([
    NEWS_PERMISSION.VIEW,
    NEWS_PERMISSION.EDIT,
    NEWS_PERMISSION.REVIEW,
    NEWS_PERMISSION.APPROVE,
    NEWS_PERMISSION.PUBLISH,
    NEWS_PERMISSION.ADMIN,
  ]),
  [NEWS_EDITORIAL_CAPABILITY.PUBLIC_READ]: Object.freeze([]),
});

/**
 * Static RLS / capability posture matrix for documentation + tests.
 */
export function getNews02CapabilityMatrix() {
  return Object.freeze({
    phase: "NEWS-02",
    authoredSqlApplied: false,
    remoteActivationAllowed: false,
    writePath: "TRUSTED_BACKEND_SERVICE_ROLE",
    publicReadPath: "news_public_content_query_public",
    verifiedHelpers: Object.freeze([
      "auth.uid()",
      "public.user_venue_id()",
      "public.user_has_permission(text)",
      "public.is_super_admin()",
      "public.news_phase02_editorial_scope_allows(...)",
      "public.news_phase02_has_editorial_read()",
    ]),
    actors: Object.freeze({
      [NEWS_AUTH_ACTOR_KIND.ANON]: Object.freeze({
        editorialRead: NEWS_AUTH_DECISION.DENY,
        editorialWrite: NEWS_AUTH_DECISION.DENY,
        publicRead: NEWS_AUTH_DECISION.ALLOW,
        notes: "Public RPC only; no base-table SELECT.",
      }),
      [NEWS_AUTH_ACTOR_KIND.AUTHENTICATED_UNRELATED]: Object.freeze({
        editorialRead: NEWS_AUTH_DECISION.DENY,
        editorialWrite: NEWS_AUTH_DECISION.DENY,
        publicRead: NEWS_AUTH_DECISION.ALLOW,
      }),
      [NEWS_AUTH_ACTOR_KIND.TENANT_MEMBER_NO_EDITORIAL]: Object.freeze({
        editorialRead: NEWS_AUTH_DECISION.DENY,
        editorialWrite: NEWS_AUTH_DECISION.DENY,
        publicRead: NEWS_AUTH_DECISION.ALLOW,
      }),
      [NEWS_AUTH_ACTOR_KIND.AUTHOR]: Object.freeze({
        createDraft: NEWS_AUTH_DECISION.ALLOW,
        editDraft: NEWS_AUTH_DECISION.ALLOW,
        approve: NEWS_AUTH_DECISION.DENY,
        publish: NEWS_AUTH_DECISION.DENY,
      }),
      [NEWS_AUTH_ACTOR_KIND.EDITOR]: Object.freeze({
        editDraft: NEWS_AUTH_DECISION.ALLOW,
        submitForReview: NEWS_AUTH_DECISION.ALLOW,
        approve: NEWS_AUTH_DECISION.DENY,
      }),
      [NEWS_AUTH_ACTOR_KIND.REVIEWER]: Object.freeze({
        review: NEWS_AUTH_DECISION.ALLOW,
        approve: NEWS_AUTH_DECISION.DENY,
        publish: NEWS_AUTH_DECISION.DENY,
      }),
      [NEWS_AUTH_ACTOR_KIND.APPROVER]: Object.freeze({
        approve: NEWS_AUTH_DECISION.ALLOW,
        publish: NEWS_AUTH_DECISION.DENY,
      }),
      [NEWS_AUTH_ACTOR_KIND.PUBLISHER]: Object.freeze({
        schedule: NEWS_AUTH_DECISION.ALLOW,
        publish: NEWS_AUTH_DECISION.ALLOW,
        unpublish: NEWS_AUTH_DECISION.ALLOW,
      }),
      [NEWS_AUTH_ACTOR_KIND.TENANT_ADMINISTRATOR]: Object.freeze({
        editorialRead: NEWS_AUTH_DECISION.ALLOW,
        editorialWrite: NEWS_AUTH_DECISION.ALLOW,
      }),
      [NEWS_AUTH_ACTOR_KIND.PLATFORM_ADMINISTRATOR]: Object.freeze({
        editorialRead: NEWS_AUTH_DECISION.ALLOW,
        editorialWrite: NEWS_AUTH_DECISION.ALLOW,
        platformScope: NEWS_AUTH_DECISION.ALLOW,
      }),
      [NEWS_AUTH_ACTOR_KIND.TRUSTED_BACKEND]: Object.freeze({
        editorialRead: NEWS_AUTH_DECISION.ALLOW,
        editorialWrite: NEWS_AUTH_DECISION.ALLOW,
        notes: "service_role bypasses RLS; still must not accept caller actor spoofing in app layer.",
      }),
    }),
    denyCases: Object.freeze([
      "cross_tenant_read",
      "cross_tenant_write",
      "wrong_venue_club_competition_scope",
      "anon_editorial_read",
      "draft_public_read",
      "preview_as_live_public",
      "expired_unpublished_archived_public_read",
      "unauthorized_approval",
      "unauthorized_publish",
      "actor_spoofing",
      "stale_version_write",
    ]),
  });
}
