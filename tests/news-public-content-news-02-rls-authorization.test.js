/**
 * NEWS-02 — Editorial authorization + static RLS security matrix tests.
 * No live database. Live RLS execution belongs to NEWS-03.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as news from "../src/features/news-public-content/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RLS = path.join(
  ROOT,
  "docs/news-public-content/news-02/30_NEWS_PHASE_02_RLS.sql"
);
const RPC = path.join(
  ROOT,
  "docs/news-public-content/news-02/40_NEWS_PHASE_02_SAVE_RPC.sql"
);
const GRANTS = path.join(
  ROOT,
  "docs/news-public-content/news-02/50_NEWS_PHASE_02_GRANTS.sql"
);

function strip(sql) {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

test("NEWS-02 capability matrix covers required actors and deny cases", () => {
  const matrix = news.getNews02CapabilityMatrix();
  assert.equal(matrix.authoredSqlApplied, false);
  assert.equal(matrix.actors[news.NEWS_AUTH_ACTOR_KIND.ANON].editorialRead, "DENY");
  assert.equal(matrix.actors[news.NEWS_AUTH_ACTOR_KIND.ANON].publicRead, "ALLOW");
  assert.equal(
    matrix.actors[news.NEWS_AUTH_ACTOR_KIND.TENANT_MEMBER_NO_EDITORIAL].editorialRead,
    "DENY"
  );
  assert.equal(
    matrix.actors[news.NEWS_AUTH_ACTOR_KIND.TRUSTED_BACKEND].editorialWrite,
    "ALLOW"
  );
  for (const deny of [
    "cross_tenant_read",
    "anon_editorial_read",
    "unauthorized_approval",
    "unauthorized_publish",
    "actor_spoofing",
    "stale_version_write",
  ]) {
    assert.ok(matrix.denyCases.includes(deny), deny);
  }
});

test("NEWS-02 authorize: public read allow; editorial deny without auth", () => {
  const pub = news.authorizeNewsEditorialCapability({
    capability: news.NEWS_EDITORIAL_CAPABILITY.PUBLIC_READ,
  });
  assert.equal(pub.decision, news.NEWS_AUTH_DECISION.ALLOW);

  const denied = news.authorizeNewsEditorialCapability({
    capability: news.NEWS_EDITORIAL_CAPABILITY.APPROVE,
    authContext: {},
  });
  assert.equal(denied.decision, news.NEWS_AUTH_DECISION.DENY);
});

test("NEWS-02 authorize: editor can edit; cannot approve/publish", () => {
  const authContext = {
    actorId: "user-editor",
    tenantId: "tenant-1",
    venueId: "tenant-1",
    permissions: [news.NEWS_PERMISSION.EDIT],
  };
  const edit = news.authorizeNewsEditorialCapability({
    capability: news.NEWS_EDITORIAL_CAPABILITY.EDIT_DRAFT,
    authContext,
    contentScope: news.CONTENT_SCOPE.TENANT,
    tenantId: "tenant-1",
  });
  assert.equal(edit.decision, news.NEWS_AUTH_DECISION.ALLOW);

  const approve = news.authorizeNewsEditorialCapability({
    capability: news.NEWS_EDITORIAL_CAPABILITY.APPROVE,
    authContext,
    contentScope: news.CONTENT_SCOPE.TENANT,
    tenantId: "tenant-1",
  });
  assert.equal(approve.decision, news.NEWS_AUTH_DECISION.DENY);

  const publish = news.authorizeNewsEditorialCapability({
    capability: news.NEWS_EDITORIAL_CAPABILITY.PUBLISH,
    authContext,
    contentScope: news.CONTENT_SCOPE.TENANT,
    tenantId: "tenant-1",
  });
  assert.equal(publish.decision, news.NEWS_AUTH_DECISION.DENY);
});

test("NEWS-02 authorize: cross-tenant and actor spoofing denied", () => {
  const cross = news.authorizeNewsEditorialCapability({
    capability: news.NEWS_EDITORIAL_CAPABILITY.READ_EDITORIAL,
    authContext: {
      actorId: "user-a",
      tenantId: "tenant-a",
      permissions: [news.NEWS_PERMISSION.VIEW],
    },
    contentScope: news.CONTENT_SCOPE.TENANT,
    tenantId: "tenant-b",
  });
  assert.equal(cross.decision, news.NEWS_AUTH_DECISION.DENY);
  assert.equal(cross.reason, "scope_denied");

  assert.throws(
    () =>
      news.rejectActorSpoofing({
        claimedActorId: "attacker",
        authContext: { actorId: "real-user" },
      }),
    (err) => err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.FORBIDDEN
  );
});

test("NEWS-02 authorize: platform admin + trusted backend allow", () => {
  const platform = news.authorizeNewsEditorialCapability({
    capability: news.NEWS_EDITORIAL_CAPABILITY.PUBLISH,
    authContext: { isPlatformAdmin: true, actorId: "admin-1" },
    contentScope: news.CONTENT_SCOPE.PLATFORM,
  });
  assert.equal(platform.decision, news.NEWS_AUTH_DECISION.ALLOW);

  const backend = news.authorizeNewsEditorialCapability({
    capability: news.NEWS_EDITORIAL_CAPABILITY.ARCHIVE,
    authContext: { isTrustedBackend: true },
  });
  assert.equal(backend.decision, news.NEWS_AUTH_DECISION.ALLOW);
});

test("NEWS-02 static RLS SQL encodes actor matrix boundaries", () => {
  const rls = strip(fs.readFileSync(RLS, "utf8"));
  const rpc = strip(fs.readFileSync(RPC, "utf8"));
  const grants = strip(fs.readFileSync(GRANTS, "utf8"));

  // anon: no base table policies; public via RPC only
  assert.doesNotMatch(rls, /to\s+anon/i);
  assert.match(rpc, /grant\s+execute[\s\S]*news_public_content_query_public[\s\S]*to\s+anon/i);
  assert.match(grants, /from\s+anon/i);

  // authenticated without membership/capability: scope helper + permission required
  assert.match(rls, /news_phase02_editorial_scope_allows/i);
  assert.match(rls, /news_phase02_has_editorial_read/i);

  // writes trusted backend only
  assert.match(grants, /grant\s+execute[\s\S]*news_public_content_save_aggregate[\s\S]*to\s+service_role/i);
  assert.match(grants, /revoke\s+all[\s\S]*news_public_content_save_aggregate[\s\S]*from\s+authenticated/i);

  // public filters deny draft/preview/mock/archived via LIVE-only query contract
  assert.match(rpc, /editorial_status\s*=\s*'PUBLISHED'/i);
  assert.match(rpc, /public_visibility\s*=\s*'PUBLIC'/i);
  assert.match(rpc, /archived_at\s+is\s+null/i);
  assert.match(rpc, /provenance\s*=\s*'LIVE'/i);
  assert.doesNotMatch(rpc, /provenance\s*<>\s*'MOCK'/i);
  assert.match(rpc, /publish_at\s+is\s+null\s+or\s+i\.publish_at\s*<=\s*p_now/i);
  assert.match(rpc, /unpublish_at\s+is\s+null\s+or\s+i\.unpublish_at\s*>\s*p_now/i);

  // stale version encoded in save RPC
  assert.match(rpc, /NEWS_VERSION_CONFLICT/i);
  assert.match(rpc, /NEWS_APPROVAL_REVISION_MISMATCH/i);
});
