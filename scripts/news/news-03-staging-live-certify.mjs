#!/usr/bin/env node
/**
 * NEWS-03 — Live Staging certification (RLS / public RPC / OCC / provenance / cleanup).
 *
 * Synthetic NEWS03_TEST_* fixtures only. Secrets never printed.
 * Temporary role_permissions on canonical roles — cleaned after tests.
 */

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  NEWS_03_BACKUP_CLASSIFICATION,
  NEWS_03_EVIDENCE_DIR_RELATIVE,
  NEWS_03_PERMISSION_KEYS,
  NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  NEWS_03_STAGING_PROJECT_REF,
} from "./lib/news03Constants.js";
import {
  getNews03RepoRoot,
  loadNews03StagingEnv,
} from "./lib/news03Env.js";
import {
  inspectNews03EnvironmentIdentity,
  probeNews03GitFacts,
} from "./lib/news03Gates.js";
import { redactNews03SecretLike } from "./lib/news03Redact.js";
import {
  authorizeNewsEditorialCapability,
  rejectActorSpoofing,
  NEWS_EDITORIAL_CAPABILITY,
  NEWS_PERMISSION,
} from "../../src/features/news-public-content/authorization/index.js";
import { NEWS_AUTH_DECISION } from "../../src/features/news-public-content/authorization/capabilityMatrix.js";

const PREFIX = "NEWS03_TEST_";
const VENUE_A = "venue-staging-a";
const VENUE_B = "venue-staging-b";
const QUERY_NOW = "2026-07-25T12:00:00.000Z";
const PAST = "2026-07-01T00:00:00.000Z";
const FUTURE = "2026-08-01T00:00:00.000Z";
const EXPIRED_END = "2026-07-10T00:00:00.000Z";
const FIXTURE_CREATED_AT = "2026-07-25T10:00:00.000Z";
const FIXTURE_UPDATED_AT = "2026-07-25T10:05:00.000Z";
const FIXTURE_UPDATED_AT_2 = "2026-07-25T10:10:00.000Z";

/**
 * Map fixture actors → canonical profile roles + exact temporary news permission grants.
 * Grants are inserted for the test window and deleted in cleanup (exact pairs only).
 */
const ACTOR_SPECS = Object.freeze([
  { key: "viewer", role: "REFEREE", venueId: VENUE_A, perms: [NEWS_PERMISSION.VIEW] },
  { key: "editor", role: "CASHIER", venueId: VENUE_A, perms: [NEWS_PERMISSION.EDIT] },
  { key: "reviewer", role: "ACCOUNTANT", venueId: VENUE_A, perms: [NEWS_PERMISSION.REVIEW] },
  { key: "approver", role: "COURT_MANAGER", venueId: VENUE_A, perms: [NEWS_PERMISSION.APPROVE] },
  { key: "publisher", role: "VENUE_MANAGER", venueId: VENUE_A, perms: [NEWS_PERMISSION.PUBLISH] },
  { key: "admin", role: "CLUB_OWNER", venueId: VENUE_A, perms: [NEWS_PERMISSION.ADMIN] },
  { key: "member_no_news", role: "PLAYER", venueId: VENUE_A, perms: [] },
  { key: "no_membership", role: "PLAYER", venueId: null, perms: [] },
  { key: "cross_tenant", role: "REFEREE", venueId: VENUE_B, perms: [NEWS_PERMISSION.VIEW] },
]);

function sha256Text(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

function check(actor, operation, expected, actual, ok, detail = null) {
  return {
    actor,
    operation,
    expected,
    actual,
    result: ok ? "PASS" : "FAIL",
    detail,
  };
}

function writeEvidence(repoRoot, filename, payload) {
  const dir = path.join(repoRoot, NEWS_03_EVIDENCE_DIR_RELATIVE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  const safe = JSON.parse(redactNews03SecretLike(JSON.stringify(payload)));
  writeFileSync(target, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
  return { path: path.basename(target), sha256: sha256Text(JSON.stringify(safe)) };
}

async function mgmtQuery(accessToken, sql, label = "query") {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${NEWS_03_STAGING_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `${label}: ${redactNews03SecretLike(body.message || body.error || `HTTP ${res.status}`)}`
    );
  }
  return body;
}

function isoNow() {
  return new Date().toISOString();
}

function buildItem(overrides) {
  return {
    content_id: overrides.content_id,
    content_type: "NEWS",
    content_scope: "VENUE",
    tenant_id: VENUE_A,
    venue_id: VENUE_A,
    club_id: null,
    competition_id: null,
    author_id: `${PREFIX}AUTHOR`,
    editorial_owner_id: `${PREFIX}OWNER`,
    editorial_status: "DRAFT",
    public_visibility: "PUBLIC",
    provenance: "LIVE",
    approved_revision_id: null,
    published_revision_id: null,
    publish_at: null,
    unpublish_at: null,
    publication_timezone: "Asia/Ho_Chi_Minh",
    published_at: null,
    unpublished_at: null,
    archived_at: null,
    row_version: 1,
    created_at: FIXTURE_CREATED_AT,
    updated_at: FIXTURE_UPDATED_AT,
    ...overrides,
  };
}

function buildRevision(contentId, revisionId, overrides = {}) {
  const revision = {
    revision_id: revisionId,
    version: 1,
    title: `${contentId}_TITLE`,
    summary: "NEWS03 live cert fixture",
    slug: `${String(contentId).toLowerCase().replace(/_/g, "-")}-slug`,
    locale: "vi-VN",
    body_payload: { blocks: [{ type: "p", text: "fixture" }] },
    seo_metadata: { title: "seo" },
    created_by: `${PREFIX}AUTHOR`,
    created_at: FIXTURE_CREATED_AT,
    ...overrides,
  };
  // Omit null JSON keys — RPC `->` would yield jsonb 'null' and fail object CHECKs.
  if (revision.banner_payload == null) delete revision.banner_payload;
  if (revision.sponsor_payload == null) delete revision.sponsor_payload;
  return revision;
}

async function saveAggregate(serviceClient, item, revision, expectedRowVersion = null, extras = {}) {
  const { data, error } = await serviceClient.rpc("news_public_content_save_aggregate", {
    p_item: item,
    p_revision: revision,
    p_category_refs: extras.category_refs || [],
    p_tag_refs: extras.tag_refs || [],
    p_media_refs: extras.media_refs || [],
    p_review: extras.review || null,
    p_approval: extras.approval || null,
    p_expected_row_version: expectedRowVersion,
  });
  return { data, error };
}

/** @type {{ role_id: string, permission_id: string }[]} */
const temporaryGrants = [];

async function cleanupFixtures(accessToken, serviceClient, userIds) {
  await mgmtQuery(
    accessToken,
    `
UPDATE public.news_public_content_items
SET current_revision_id = NULL,
    approved_revision_id = NULL,
    published_revision_id = NULL
WHERE content_id LIKE '${PREFIX}%';

DELETE FROM public.news_public_content_media_refs WHERE content_id LIKE '${PREFIX}%';
DELETE FROM public.news_public_content_tag_refs WHERE content_id LIKE '${PREFIX}%';
DELETE FROM public.news_public_content_category_refs WHERE content_id LIKE '${PREFIX}%';
DELETE FROM public.news_public_content_approvals WHERE content_id LIKE '${PREFIX}%';
DELETE FROM public.news_public_content_reviews WHERE content_id LIKE '${PREFIX}%';
DELETE FROM public.news_public_content_revisions WHERE content_id LIKE '${PREFIX}%';
DELETE FROM public.news_public_content_items WHERE content_id LIKE '${PREFIX}%';
DELETE FROM public.role_permissions WHERE role_id LIKE '${PREFIX}%';
DELETE FROM public.roles WHERE id LIKE '${PREFIX}%';
DELETE FROM public.profiles WHERE email ILIKE '${PREFIX}%';
DROP FUNCTION IF EXISTS public.news03_live_count_as(uuid, text);
`,
    "cleanup-sql"
  );

  for (const g of temporaryGrants) {
    await mgmtQuery(
      accessToken,
      `
DELETE FROM public.role_permissions
WHERE role_id = '${g.role_id}' AND permission_id = '${g.permission_id}';
`,
      `cleanup-grant-${g.role_id}-${g.permission_id}`
    );
  }

  for (const id of userIds) {
    try {
      await mgmtQuery(
        accessToken,
        `DELETE FROM public.profiles WHERE id = '${id}'::uuid;`,
        "cleanup-profile"
      );
    } catch {
      // continue
    }
    try {
      await serviceClient.auth.admin.deleteUser(id);
    } catch {
      // continue
    }
  }

  // Sweep leftover NEWS03 auth users by email prefix via SQL if table accessible
  try {
    await mgmtQuery(
      accessToken,
      `
DELETE FROM auth.users WHERE email ILIKE '${PREFIX}%@staging.local';
`,
      "cleanup-auth-users"
    );
  } catch {
    // may lack permission; admin deleteUser covers created set
  }
}

async function main() {
  const repoRoot = getNews03RepoRoot();
  loadNews03StagingEnv({ repoRoot });
  const gitFacts = probeNews03GitFacts({ repoRoot });
  const identity = inspectNews03EnvironmentIdentity(process.env);
  const startedAt = isoNow();
  /** @type {ReturnType<typeof check>[]} */
  const matrix = [];
  /** @type {string[]} */
  const createdUserIds = [];
  /** @type {string[]} */
  const createdEmails = [];
  let cleanup = { attempted: false, ok: false, residue: null };

  const base = {
    phase: "NEWS-03",
    script: "news-03-staging-live-certify",
    stagingProjectRef: NEWS_03_STAGING_PROJECT_REF,
    productionProjectRefBlocked: NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST[0],
    environmentClassification: "staging",
    gitHead: gitFacts.head,
    backupClassification: NEWS_03_BACKUP_CLASSIFICATION,
    pitr: false,
    secretsPrinted: false,
    startedAt,
  };

  if (!identity.ok || identity.isProduction || identity.containsProductionRef) {
    const blocked = {
      ...base,
      ok: false,
      verdict: "NEWS_03_LIVE_CERT_BLOCKED_ENVIRONMENT",
      identity,
      finishedAt: isoNow(),
    };
    writeEvidence(repoRoot, "NEWS_03_LIVE_CERTIFICATION.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }

  const url = String(process.env.STAGING_SUPABASE_URL || "").trim();
  const anonKey = String(process.env.STAGING_SUPABASE_ANON_KEY || "").trim();
  const serviceKey = String(process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();

  if (!url.includes(NEWS_03_STAGING_PROJECT_REF) || !anonKey || !serviceKey || !accessToken) {
    const blocked = {
      ...base,
      ok: false,
      verdict: "NEWS_03_LIVE_CERT_BLOCKED_CREDENTIALS",
      finishedAt: isoNow(),
    };
    writeEvidence(repoRoot, "NEWS_03_LIVE_CERTIFICATION.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }

  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Best-effort sweep from prior failed run
  try {
    await cleanupFixtures(accessToken, serviceClient, []);
  } catch {
    // continue
  }

  try {
    const inventory = await mgmtQuery(
      accessToken,
      `
SELECT jsonb_build_object(
  'using_true_policies', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'policy', policyname)), '[]'::jsonb)
    FROM pg_policies
    WHERE tablename LIKE 'news_public_content_%'
      AND (
        lower(coalesce(qual, '')) IN ('true', '(true)')
        OR lower(coalesce(with_check, '')) IN ('true', '(true)')
      )
  ),
  'policy_count', (SELECT count(*)::int FROM pg_policies WHERE tablename LIKE 'news_public_content_%'),
  'permissions', (
    SELECT coalesce(jsonb_agg(id ORDER BY id), '[]'::jsonb)
    FROM public.permissions
    WHERE id IN (${NEWS_03_PERMISSION_KEYS.map((k) => `'${k}'`).join(",")})
  ),
  'permission_dupes', (
    SELECT count(*)::int FROM (
      SELECT id FROM public.permissions
      WHERE id IN (${NEWS_03_PERMISSION_KEYS.map((k) => `'${k}'`).join(",")})
      GROUP BY id HAVING count(*) > 1
    ) d
  ),
  'save_grants', (
    SELECT coalesce(jsonb_agg(grantee ORDER BY grantee), '[]'::jsonb)
    FROM information_schema.routine_privileges
    WHERE routine_schema='public'
      AND routine_name='news_public_content_save_aggregate'
      AND privilege_type='EXECUTE'
  ),
  'public_rpc_grants', (
    SELECT coalesce(jsonb_agg(grantee ORDER BY grantee), '[]'::jsonb)
    FROM information_schema.routine_privileges
    WHERE routine_schema='public'
      AND routine_name='news_public_content_query_public'
      AND privilege_type='EXECUTE'
  )
) AS info;
`,
      "object-inventory"
    );
    const info = Array.isArray(inventory) ? inventory[0]?.info : inventory?.info;

    matrix.push(
      check(
        "system",
        "no_using_true_policies",
        0,
        Array.isArray(info?.using_true_policies) ? info.using_true_policies.length : -1,
        Array.isArray(info?.using_true_policies) && info.using_true_policies.length === 0
      )
    );
    matrix.push(check("system", "policy_count", 7, info?.policy_count, Number(info?.policy_count) === 7));
    matrix.push(
      check(
        "system",
        "permission_keys_exact",
        6,
        (info?.permissions || []).length,
        Array.isArray(info?.permissions) &&
          info.permissions.length === 6 &&
          NEWS_03_PERMISSION_KEYS.every((k) => info.permissions.includes(k))
      )
    );
    matrix.push(
      check("system", "permission_no_dupes", 0, info?.permission_dupes, Number(info?.permission_dupes) === 0)
    );
    const saveGrants = info?.save_grants || [];
    matrix.push(
      check(
        "system",
        "save_rpc_service_role_only",
        "service_role(+postgres)",
        saveGrants.join(","),
        saveGrants.includes("service_role") &&
          !saveGrants.includes("anon") &&
          !saveGrants.includes("authenticated")
      )
    );
    const publicGrants = info?.public_rpc_grants || [];
    matrix.push(
      check(
        "system",
        "public_rpc_grants",
        "anon+authenticated+service_role",
        publicGrants.join(","),
        publicGrants.includes("anon") &&
          publicGrants.includes("authenticated") &&
          publicGrants.includes("service_role")
      )
    );

    // Temporary exact permission grants on canonical roles
    const grantPairs = new Map();
    for (const spec of ACTOR_SPECS) {
      for (const perm of spec.perms) {
        grantPairs.set(`${spec.role}::${perm}`, { role_id: spec.role, permission_id: perm });
      }
    }
    for (const g of grantPairs.values()) {
      const inserted = await mgmtQuery(
        accessToken,
        `
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '${g.role_id}', '${g.permission_id}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = '${g.role_id}' AND rp.permission_id = '${g.permission_id}'
)
RETURNING role_id, permission_id;
`,
        `grant-${g.role_id}-${g.permission_id}`
      );
      if (Array.isArray(inserted) && inserted.length > 0) {
        temporaryGrants.push(g);
      }
    }

    const password = `News03!${randomBytes(12).toString("base64url")}`;
    /** @type {Record<string, { id: string, email: string, role: string, venueId: string|null, perms: string[] }>} */
    const actors = {};

    for (const spec of ACTOR_SPECS) {
      const email = `${PREFIX}${spec.key}.${Date.now()}@staging.local`.toLowerCase();
      const created = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { news03_fixture: true },
      });
      if (created.error || !created.data?.user?.id) {
        throw new Error(`createUser ${spec.key}: ${created.error?.message || "missing id"}`);
      }
      const id = created.data.user.id;
      createdUserIds.push(id);
      createdEmails.push(email);
      await mgmtQuery(
        accessToken,
        `
INSERT INTO public.profiles (id, email, display_name, role, venue_id, status, created_at, updated_at)
VALUES (
  '${id}'::uuid,
  '${email.replace(/'/g, "''")}',
  '${PREFIX}${spec.key}',
  '${spec.role}',
  ${spec.venueId ? `'${spec.venueId}'` : "NULL"},
  'active',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  venue_id = EXCLUDED.venue_id,
  status = 'active',
  updated_at = now();
`,
        `profile-${spec.key}`
      );
      actors[spec.key] = {
        id,
        email,
        role: spec.role,
        venueId: spec.venueId,
        perms: spec.perms,
      };
    }

    const saRows = await mgmtQuery(
      accessToken,
      `
SELECT id::text AS id, email, role::text AS role, venue_id::text AS venue_id
FROM public.profiles
WHERE email = 'admin@staging.local' AND role = 'SUPER_ADMIN' AND status = 'active'
LIMIT 1;
`,
      "super-admin"
    );
    if (Array.isArray(saRows) && saRows[0]?.id) {
      actors.platform_super_admin = {
        id: saRows[0].id,
        email: saRows[0].email,
        role: "SUPER_ADMIN",
        venueId: saRows[0].venue_id,
        perms: [],
        canonical: true,
      };
    }

    const fixtures = [
      {
        item: buildItem({
          content_id: `${PREFIX}LIVE_PUBLIC`,
          editorial_status: "PUBLISHED",
          provenance: "LIVE",
          published_revision_id: `${PREFIX}LIVE_PUBLIC_REV1`,
          current_revision_id: `${PREFIX}LIVE_PUBLIC_REV1`,
          published_at: PAST,
          publish_at: PAST,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}DRAFT`,
          editorial_status: "DRAFT",
          current_revision_id: `${PREFIX}DRAFT_REV1`,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}PREVIEW`,
          editorial_status: "DRAFT",
          provenance: "PREVIEW",
          current_revision_id: `${PREFIX}PREVIEW_REV1`,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}MOCK`,
          editorial_status: "DRAFT",
          provenance: "MOCK",
          current_revision_id: `${PREFIX}MOCK_REV1`,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}UNPUBLISHED`,
          editorial_status: "UNPUBLISHED",
          published_revision_id: `${PREFIX}UNPUBLISHED_REV1`,
          current_revision_id: `${PREFIX}UNPUBLISHED_REV1`,
          published_at: PAST,
          unpublished_at: PAST,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}ARCHIVED`,
          editorial_status: "ARCHIVED",
          published_revision_id: `${PREFIX}ARCHIVED_REV1`,
          current_revision_id: `${PREFIX}ARCHIVED_REV1`,
          published_at: PAST,
          archived_at: PAST,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}EXPIRED`,
          editorial_status: "PUBLISHED",
          published_revision_id: `${PREFIX}EXPIRED_REV1`,
          current_revision_id: `${PREFIX}EXPIRED_REV1`,
          published_at: PAST,
          publish_at: PAST,
          unpublish_at: EXPIRED_END,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}FUTURE`,
          editorial_status: "PUBLISHED",
          published_revision_id: `${PREFIX}FUTURE_REV1`,
          current_revision_id: `${PREFIX}FUTURE_REV1`,
          published_at: FUTURE,
          publish_at: FUTURE,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}CROSS_TENANT`,
          tenant_id: VENUE_B,
          venue_id: VENUE_B,
          editorial_status: "DRAFT",
          current_revision_id: `${PREFIX}CROSS_TENANT_REV1`,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}OCC`,
          editorial_status: "DRAFT",
          current_revision_id: `${PREFIX}OCC_REV1`,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}IMMUTABLE`,
          editorial_status: "PUBLISHED",
          approved_revision_id: `${PREFIX}IMMUTABLE_REV1`,
          published_revision_id: `${PREFIX}IMMUTABLE_REV1`,
          current_revision_id: `${PREFIX}IMMUTABLE_REV1`,
          published_at: PAST,
          publish_at: PAST,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}WRONG_CLUB`,
          content_scope: "CLUB",
          tenant_id: VENUE_A,
          venue_id: null,
          club_id: `${PREFIX}CLUB_X`,
          editorial_status: "DRAFT",
          current_revision_id: `${PREFIX}WRONG_CLUB_REV1`,
        }),
      },
      {
        item: buildItem({
          content_id: `${PREFIX}WRONG_COMP`,
          content_scope: "COMPETITION",
          tenant_id: VENUE_B,
          venue_id: null,
          club_id: null,
          competition_id: `${PREFIX}COMP_B`,
          editorial_status: "DRAFT",
          current_revision_id: `${PREFIX}WRONG_COMP_REV1`,
        }),
      },
    ];

    async function seedFixture(item) {
      const revId = item.current_revision_id || item.published_revision_id;
      const createItem = {
        ...item,
        editorial_status:
          item.editorial_status === "ARCHIVED" || item.editorial_status === "UNPUBLISHED"
            ? "DRAFT"
            : item.editorial_status === "PUBLISHED"
              ? "DRAFT"
              : item.editorial_status,
        approved_revision_id: null,
        published_revision_id: null,
        published_at: null,
        unpublished_at: null,
        archived_at: null,
        publish_at: null,
        unpublish_at: null,
        row_version: 1,
      };
      // Keep MOCK provenance on create (not published).
      const created = await saveAggregate(
        serviceClient,
        createItem,
        buildRevision(item.content_id, revId),
        1
      );
      if (created.error) {
        throw new Error(
          `seed-create ${item.content_id}: ${created.error.message || created.error.code || "save failed"}`
        );
      }

      const needsUpdate =
        item.editorial_status !== createItem.editorial_status ||
        item.published_revision_id ||
        item.approved_revision_id ||
        item.archived_at ||
        item.unpublished_at ||
        item.publish_at ||
        item.unpublish_at;

      if (!needsUpdate) return;

      const updated = await saveAggregate(
        serviceClient,
        {
          ...item,
          current_revision_id: revId,
          row_version: 2,
          created_at: FIXTURE_CREATED_AT,
          updated_at: FIXTURE_UPDATED_AT_2,
        },
        buildRevision(item.content_id, revId),
        1
      );
      if (updated.error) {
        throw new Error(
          `seed-update ${item.content_id}: ${updated.error.message || updated.error.code || "save failed"}`
        );
      }
    }

    for (const fx of fixtures) {
      await seedFixture(fx.item);
    }
    matrix.push(check("service_role", "save_aggregate_seed", "ok", "ok", true, { count: fixtures.length }));

    const { data: publicRows, error: publicErr } = await anonClient.rpc(
      "news_public_content_query_public",
      { p_now: QUERY_NOW, p_locale: null, p_content_scope: null, p_limit: 200 }
    );
    if (publicErr) throw new Error(`public rpc: ${publicErr.message}`);
    const publicIds = new Set((publicRows || []).map((r) => r.content_id));
    const publicCases = [
      [`${PREFIX}LIVE_PUBLIC`, true],
      [`${PREFIX}DRAFT`, false],
      [`${PREFIX}PREVIEW`, false],
      [`${PREFIX}MOCK`, false],
      [`${PREFIX}UNPUBLISHED`, false],
      [`${PREFIX}ARCHIVED`, false],
      [`${PREFIX}EXPIRED`, false],
      [`${PREFIX}FUTURE`, false],
    ];
    for (const [id, expectVisible] of publicCases) {
      const visible = publicIds.has(id);
      matrix.push(
        check(
          "anonymous",
          `public_rpc_${id.replace(PREFIX, "")}`,
          expectVisible ? "visible" : "not_visible",
          visible ? "visible" : "not_visible",
          visible === expectVisible
        )
      );
    }
    const mockAsLive = (publicRows || []).some((r) => r.provenance === "MOCK");
    matrix.push(
      check("anonymous", "mock_not_as_live", "absent", mockAsLive ? "present" : "absent", !mockAsLive)
    );

    {
      const { data: anonSelect, error: anonSelectErr } = await anonClient
        .from("news_public_content_items")
        .select("content_id")
        .eq("content_id", `${PREFIX}LIVE_PUBLIC`);
      const anonDenied =
        Boolean(anonSelectErr) || !anonSelect || anonSelect.length === 0;
      matrix.push(
        check(
          "anonymous",
          "base_table_select_denied",
          "deny",
          anonDenied ? "deny" : "allow",
          anonDenied,
          anonSelectErr ? { code: anonSelectErr.code } : { rows: (anonSelect || []).length }
        )
      );
    }

    async function expectSelect(actorKey, contentId, expectAllow) {
      const actor = actors[actorKey];
      const authed = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const sign = await authed.auth.signInWithPassword({
        email: actor.email,
        password,
      });
      if (sign.error) {
        return check(
          actorKey,
          `editorial_select_${contentId.replace(PREFIX, "")}`,
          expectAllow ? "allow" : "deny",
          "sign_in_failed",
          false,
          { message: sign.error.message }
        );
      }

      const { data, error } = await authed
        .from("news_public_content_items")
        .select("content_id")
        .eq("content_id", contentId);
      const actualAllow = !error && Array.isArray(data) && data.length > 0;
      await authed.auth.signOut();
      return check(
        actorKey,
        `editorial_select_${contentId.replace(PREFIX, "")}`,
        expectAllow ? "allow" : "deny",
        actualAllow ? "allow" : "deny",
        actualAllow === expectAllow
      );
    }

    matrix.push(await expectSelect("no_membership", `${PREFIX}DRAFT`, false));
    matrix.push(await expectSelect("member_no_news", `${PREFIX}DRAFT`, false));
    matrix.push(await expectSelect("viewer", `${PREFIX}DRAFT`, true));
    matrix.push(await expectSelect("viewer", `${PREFIX}CROSS_TENANT`, false));
    matrix.push(await expectSelect("cross_tenant", `${PREFIX}DRAFT`, false));
    matrix.push(await expectSelect("editor", `${PREFIX}DRAFT`, true));
    matrix.push(await expectSelect("reviewer", `${PREFIX}DRAFT`, true));
    matrix.push(await expectSelect("approver", `${PREFIX}DRAFT`, true));
    matrix.push(await expectSelect("publisher", `${PREFIX}DRAFT`, true));
    matrix.push(await expectSelect("admin", `${PREFIX}DRAFT`, true));
    if (actors.platform_super_admin) {
      matrix.push(
        check(
          "platform_super_admin",
          "canonical_fixture_present",
          "present",
          "present",
          true,
          { idPresent: true, email: "admin@staging.local" }
        )
      );
    }
    matrix.push(await expectSelect("viewer", `${PREFIX}WRONG_COMP`, false));
    matrix.push(await expectSelect("viewer", `${PREFIX}WRONG_CLUB`, true));

    {
      const authed = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await authed.auth.signInWithPassword({ email: actors.editor.email, password });
      const { error: insErr } = await authed.from("news_public_content_items").insert({
        content_id: `${PREFIX}DIRECT_INSERT`,
        content_type: "NEWS",
        content_scope: "VENUE",
        tenant_id: VENUE_A,
        venue_id: VENUE_A,
        author_id: actors.editor.id,
        editorial_owner_id: actors.editor.id,
        editorial_status: "DRAFT",
        public_visibility: "PUBLIC",
        provenance: "LIVE",
        row_version: 1,
        created_at: FIXTURE_CREATED_AT,
        updated_at: FIXTURE_UPDATED_AT,
      });
      matrix.push(
        check(
          "editor",
          "direct_insert_base_table",
          "deny",
          insErr ? "deny" : "allow",
          Boolean(insErr),
          insErr ? { code: insErr.code } : null
        )
      );
      const { error: rpcErr } = await authed.rpc("news_public_content_save_aggregate", {
        p_item: buildItem({
          content_id: `${PREFIX}UNAUTH_RPC`,
          current_revision_id: `${PREFIX}UNAUTH_RPC_REV1`,
        }),
        p_revision: buildRevision(`${PREFIX}UNAUTH_RPC`, `${PREFIX}UNAUTH_RPC_REV1`),
        p_expected_row_version: 1,
      });
      matrix.push(
        check(
          "editor",
          "unauthorized_save_rpc",
          "deny",
          rpcErr ? "deny" : "allow",
          Boolean(rpcErr)
        )
      );
      await authed.auth.signOut();
    }

    {
      const stale = await saveAggregate(
        serviceClient,
        buildItem({
          content_id: `${PREFIX}OCC`,
          editorial_status: "DRAFT",
          current_revision_id: `${PREFIX}OCC_REV2`,
          row_version: 99,
          updated_at: FIXTURE_UPDATED_AT_2,
        }),
        buildRevision(`${PREFIX}OCC`, `${PREFIX}OCC_REV2`, {
          version: 2,
          slug: `${PREFIX}occ-rev2-slug`.toLowerCase(),
        }),
        1
      );
      const msg = String(stale.error?.message || stale.error?.details || "");
      const isConflict = /NEWS_VERSION_CONFLICT/i.test(msg);
      matrix.push(
        check(
          "service_role",
          "stale_row_version",
          "NEWS_VERSION_CONFLICT",
          isConflict ? "NEWS_VERSION_CONFLICT" : msg || "ok",
          isConflict
        )
      );

      const okUpdate = await saveAggregate(
        serviceClient,
        buildItem({
          content_id: `${PREFIX}OCC`,
          editorial_status: "DRAFT",
          current_revision_id: `${PREFIX}OCC_REV2`,
          row_version: 2,
          updated_at: FIXTURE_UPDATED_AT_2,
        }),
        buildRevision(`${PREFIX}OCC`, `${PREFIX}OCC_REV2`, {
          version: 2,
          slug: `${PREFIX}occ-rev2-slug`.toLowerCase(),
        }),
        1
      );
      matrix.push(
        check(
          "service_role",
          "expected_row_version_success",
          "ok",
          okUpdate.error ? okUpdate.error.message : "ok",
          !okUpdate.error
        )
      );

      const badApproval = await saveAggregate(
        serviceClient,
        buildItem({
          content_id: `${PREFIX}OCC`,
          editorial_status: "IN_REVIEW",
          current_revision_id: `${PREFIX}OCC_REV2`,
          row_version: 3,
          updated_at: "2026-07-25T10:15:00.000Z",
        }),
        buildRevision(`${PREFIX}OCC`, `${PREFIX}OCC_REV2`, {
          version: 2,
          slug: `${PREFIX}occ-rev2-slug`.toLowerCase(),
        }),
        2,
        {
          approval: {
            approval_id: `${PREFIX}APPR_STALE`,
            revision_id: `${PREFIX}OCC_REV1`,
            revision_version: 1,
            approver_id: `${PREFIX}APPROVER`,
            decision: "APPROVED",
            reason: "stale",
            decided_at: FIXTURE_UPDATED_AT_2,
          },
        }
      );
      const aMsg = String(badApproval.error?.message || "");
      const rejected = /NEWS_APPROVAL_REVISION_MISMATCH/i.test(aMsg);
      matrix.push(
        check(
          "service_role",
          "stale_revision_approval",
          "NEWS_APPROVAL_REVISION_MISMATCH",
          rejected ? "NEWS_APPROVAL_REVISION_MISMATCH" : aMsg || "ok",
          rejected
        )
      );
    }

    {
      const mockPub = await saveAggregate(
        serviceClient,
        buildItem({
          content_id: `${PREFIX}MOCK_PUB`,
          editorial_status: "PUBLISHED",
          provenance: "MOCK",
          published_revision_id: `${PREFIX}MOCK_PUB_REV1`,
          current_revision_id: `${PREFIX}MOCK_PUB_REV1`,
          published_at: PAST,
          publish_at: PAST,
        }),
        buildRevision(`${PREFIX}MOCK_PUB`, `${PREFIX}MOCK_PUB_REV1`),
        1
      );
      const msg = String(mockPub.error?.message || "");
      const rejected = /NEWS_PROVENANCE_MISMATCH/i.test(msg);
      matrix.push(
        check(
          "service_role",
          "mock_publish_rejected",
          "NEWS_PROVENANCE_MISMATCH",
          rejected ? "NEWS_PROVENANCE_MISMATCH" : msg || "ok",
          rejected
        )
      );
    }

    {
      const { data } = await serviceClient
        .from("news_public_content_items")
        .select("content_id,provenance,editorial_status")
        .eq("content_id", `${PREFIX}LIVE_PUBLIC`)
        .maybeSingle();
      matrix.push(
        check(
          "service_role",
          "live_provenance_recorded",
          "LIVE",
          data?.provenance || "missing",
          data?.provenance === "LIVE" && data?.editorial_status === "PUBLISHED"
        )
      );
    }

    {
      let immutableOk = false;
      let detail = null;
      try {
        await mgmtQuery(
          accessToken,
          `
UPDATE public.news_public_content_revisions
SET title = 'mutated'
WHERE revision_id = '${PREFIX}IMMUTABLE_REV1';
`,
          "immutable-update"
        );
        detail = "update_succeeded";
      } catch (err) {
        const msg = String(err?.message || err);
        immutableOk = /NEWS_REVISION_IMMUTABLE/i.test(msg);
        detail = immutableOk ? "NEWS_REVISION_IMMUTABLE" : msg.slice(0, 200);
      }
      matrix.push(
        check(
          "service_role",
          "immutable_revision_mutation",
          "NEWS_REVISION_IMMUTABLE",
          detail,
          immutableOk
        )
      );
    }

    const capCases = [
      ["editor", [NEWS_PERMISSION.EDIT], NEWS_EDITORIAL_CAPABILITY.CREATE_DRAFT, true],
      ["editor", [NEWS_PERMISSION.EDIT], NEWS_EDITORIAL_CAPABILITY.SUBMIT_FOR_REVIEW, true],
      ["editor", [NEWS_PERMISSION.EDIT], NEWS_EDITORIAL_CAPABILITY.APPROVE, false],
      ["editor", [NEWS_PERMISSION.EDIT], NEWS_EDITORIAL_CAPABILITY.PUBLISH, false],
      ["reviewer", [NEWS_PERMISSION.REVIEW], NEWS_EDITORIAL_CAPABILITY.REVIEW, true],
      ["reviewer", [NEWS_PERMISSION.REVIEW], NEWS_EDITORIAL_CAPABILITY.APPROVE, false],
      ["approver", [NEWS_PERMISSION.APPROVE], NEWS_EDITORIAL_CAPABILITY.APPROVE, true],
      ["approver", [NEWS_PERMISSION.APPROVE], NEWS_EDITORIAL_CAPABILITY.PUBLISH, false],
      ["publisher", [NEWS_PERMISSION.PUBLISH], NEWS_EDITORIAL_CAPABILITY.PUBLISH, true],
      ["publisher", [NEWS_PERMISSION.PUBLISH], NEWS_EDITORIAL_CAPABILITY.SCHEDULE, true],
      ["publisher", [NEWS_PERMISSION.PUBLISH], NEWS_EDITORIAL_CAPABILITY.UNPUBLISH, true],
      ["publisher", [NEWS_PERMISSION.PUBLISH], NEWS_EDITORIAL_CAPABILITY.ARCHIVE, true],
      ["admin", [NEWS_PERMISSION.ADMIN], NEWS_EDITORIAL_CAPABILITY.PUBLISH, true],
      ["member", [], NEWS_EDITORIAL_CAPABILITY.READ_EDITORIAL, false],
    ];
    for (const [actorLabel, perms, capability, expectAllow] of capCases) {
      const decision = authorizeNewsEditorialCapability({
        authContext: {
          actorId: actors.editor.id,
          venueId: VENUE_A,
          tenantId: VENUE_A,
          permissions: perms,
        },
        capability,
        contentScope: "VENUE",
        tenantId: VENUE_A,
        venueId: VENUE_A,
      });
      const allowed = decision.decision === NEWS_AUTH_DECISION.ALLOW;
      matrix.push(
        check(
          actorLabel,
          `capability_${capability}`,
          expectAllow ? "ALLOW" : "DENY",
          allowed ? "ALLOW" : "DENY",
          allowed === expectAllow,
          { reason: decision.reason }
        )
      );
    }

    let spoofDenied = false;
    try {
      rejectActorSpoofing({
        claimedActorId: "spoofed-actor",
        authContext: { actorId: actors.editor.id },
      });
    } catch (err) {
      spoofDenied = /actor_spoofing|not authoritative|FORBIDDEN/i.test(
        String(err?.message || err?.code || err)
      );
    }
    matrix.push(
      check("editor", "actor_spoofing", "deny", spoofDenied ? "deny" : "allow", spoofDenied)
    );

    cleanup.attempted = true;
    await cleanupFixtures(accessToken, serviceClient, createdUserIds);

    const residue = await mgmtQuery(
      accessToken,
      `
SELECT jsonb_build_object(
  'content_residue', (SELECT count(*)::int FROM public.news_public_content_items WHERE content_id LIKE '${PREFIX}%'),
  'revision_residue', (SELECT count(*)::int FROM public.news_public_content_revisions WHERE content_id LIKE '${PREFIX}%'),
  'review_residue', (SELECT count(*)::int FROM public.news_public_content_reviews WHERE content_id LIKE '${PREFIX}%'),
  'approval_residue', (SELECT count(*)::int FROM public.news_public_content_approvals WHERE content_id LIKE '${PREFIX}%'),
  'fixture_role_residue', (SELECT count(*)::int FROM public.roles WHERE id LIKE '${PREFIX}%'),
  'temp_grant_residue', (
    SELECT count(*)::int FROM public.role_permissions rp
    WHERE (rp.role_id, rp.permission_id) IN (
      ${temporaryGrants.map((g) => `('${g.role_id}','${g.permission_id}')`).join(",\n      ") || "('__none__','__none__')"}
    )
  ),
  'canonical_news_perms', (
    SELECT count(*)::int FROM public.permissions
    WHERE id IN (${NEWS_03_PERMISSION_KEYS.map((k) => `'${k}'`).join(",")})
  ),
  'tables_remain', (
    SELECT count(*)::int FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'news_public_content_%'
  )
) AS residue;
`,
      "residue"
    );
    cleanup.residue = Array.isArray(residue) ? residue[0]?.residue : residue?.residue;
    const r = cleanup.residue || {};
    cleanup.ok =
      Number(r.content_residue) === 0 &&
      Number(r.revision_residue) === 0 &&
      Number(r.review_residue) === 0 &&
      Number(r.approval_residue) === 0 &&
      Number(r.fixture_role_residue) === 0 &&
      Number(r.temp_grant_residue) === 0 &&
      Number(r.canonical_news_perms) === 6 &&
      Number(r.tables_remain) === 7;

    matrix.push(
      check(
        "cleanup",
        "fixture_residue_zero",
        "0",
        JSON.stringify({
          content: r.content_residue,
          tempGrants: r.temp_grant_residue,
          fixtureRoles: r.fixture_role_residue,
        }),
        cleanup.ok
      )
    );
    matrix.push(
      check(
        "cleanup",
        "canonical_permissions_retained",
        6,
        r.canonical_news_perms,
        Number(r.canonical_news_perms) === 6
      )
    );

    const failed = matrix.filter((m) => m.result === "FAIL");
    const ok = failed.length === 0 && cleanup.ok;
    const report = {
      ...base,
      ok,
      verdict: ok ? "NEWS_03_LIVE_CERT_PASS" : "NEWS_03_LIVE_CERT_FAILED",
      finishedAt: isoNow(),
      objectInventory: info,
      actorsCreatedCount: createdEmails.length,
      canonicalSuperAdminUsed: Boolean(actors.platform_super_admin),
      matrix,
      matrixPass: matrix.filter((m) => m.result === "PASS").length,
      matrixTotal: matrix.length,
      failedOperations: failed.map((f) => `${f.actor}:${f.operation}`),
      cleanup,
      productionConnected: false,
      publicPortalWired: false,
    };
    const evidence = writeEvidence(repoRoot, "NEWS_03_LIVE_CERTIFICATION.json", report);
    report.evidence = evidence;
    console.log(JSON.stringify(report, null, 2));
    process.exit(ok ? 0 : 1);
  } catch (err) {
    try {
      cleanup.attempted = true;
      await cleanupFixtures(accessToken, serviceClient, createdUserIds);
    } catch {
      // best-effort
    }
    const failed = {
      ...base,
      ok: false,
      verdict: "NEWS_03_LIVE_CERT_ERROR",
      error: redactNews03SecretLike(String(err?.message || err)),
      matrix,
      cleanup,
      finishedAt: isoNow(),
    };
    writeEvidence(repoRoot, "NEWS_03_LIVE_CERTIFICATION.json", failed);
    console.log(JSON.stringify(failed, null, 2));
    process.exit(1);
  }
}

main();
