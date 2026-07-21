import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FEATURE_STATUS } from "../src/config/v5Menu/menuBuilders.js";
import { CRM_MENU_ROOT } from "../src/config/v5Menu/crmMenu.js";

import * as crm from "../src/features/crm/index.js";
import { deriveEffectiveConsent } from "../src/features/crm/models/consentRecord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const phase1gDir = path.join(root, "docs", "crm", "phase-1g");

const SCOPE_A = Object.freeze({ tenantId: "tenant-a", venueId: "venue-a" });
const SCOPE_B = Object.freeze({ tenantId: "tenant-b", venueId: "venue-b" });
const FIXED_NOW = "2026-07-21T12:00:00.000Z";

const MIGRATION_FILES = [
  "10_CRM_PHASE_1G_TABLES.sql",
  "20_CRM_PHASE_1G_INDEXES.sql",
  "30_CRM_PHASE_1G_RLS.sql",
  "40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS.sql",
  "50_CRM_PHASE_1G_GRANTS.sql",
  "60_CRM_PHASE_1G_CONSENT_IMMUTABLE.sql",
];

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function readMigration(name) {
  return readFileSync(path.join(phase1gDir, name), "utf8");
}

function allSql() {
  return MIGRATION_FILES.map(readMigration).join("\n\n");
}

/**
 * Deterministic in-test database fake. NOT exported from CRM public facade.
 */
function createFakeCrmDatabaseClient() {
  /** @type {Map<string, Map<string, object>>} */
  const tables = new Map([
    ["crm_tags", new Map()],
    ["crm_tag_assignments", new Map()],
    ["crm_consent_records", new Map()],
    ["crm_pending_events", new Map()],
  ]);

  function pkFor(table, row) {
    if (table === "crm_tags") return row.tag_id;
    if (table === "crm_tag_assignments") return row.assignment_id;
    if (table === "crm_consent_records") return row.consent_id;
    if (table === "crm_pending_events") return row.pending_event_id;
    throw new Error(`Unknown table ${table}`);
  }

  function cloneRow(row) {
    return JSON.parse(JSON.stringify(row));
  }

  function matches(row, filters = {}) {
    for (const [key, value] of Object.entries(filters || {})) {
      if (row[key] !== value) return false;
    }
    return true;
  }

  function uniqueConflict(table, row) {
    const store = tables.get(table);
    for (const existing of store.values()) {
      if (table === "crm_tags") {
        if (
          existing.tenant_id === row.tenant_id &&
          existing.venue_id === row.venue_id &&
          existing.normalized_code === row.normalized_code &&
          existing.tag_id !== row.tag_id
        ) {
          const err = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          throw err;
        }
      }
      if (table === "crm_tag_assignments") {
        if (
          existing.tenant_id === row.tenant_id &&
          existing.venue_id === row.venue_id &&
          existing.tag_id === row.tag_id &&
          existing.target_type === row.target_type &&
          existing.target_id === row.target_id &&
          existing.assignment_id !== row.assignment_id
        ) {
          const err = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          throw err;
        }
      }
      if (table === "crm_pending_events") {
        if (
          existing.tenant_id === row.tenant_id &&
          existing.venue_id === row.venue_id &&
          existing.event_id === row.event_id &&
          existing.pending_event_id !== row.pending_event_id
        ) {
          const err = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          throw err;
        }
      }
    }
  }

  function sortRows(rows, order = []) {
    const copy = rows.slice();
    copy.sort((a, b) => {
      for (const rule of order) {
        const av = a[rule.column];
        const bv = b[rule.column];
        const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
        if (cmp !== 0) return rule.ascending === false ? -cmp : cmp;
      }
      return 0;
    });
    return copy;
  }

  return {
    async select({ table, filters, order, limit }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      let rows = [...store.values()].filter((row) => matches(row, filters)).map(cloneRow);
      rows = sortRows(rows, order);
      if (limit != null) rows = rows.slice(0, limit);
      return rows;
    },

    async insert({ table, rows, returning = true }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      const list = Array.isArray(rows) ? rows : [rows];
      // Atomic: validate all first, then insert all
      for (const row of list) {
        const pk = pkFor(table, row);
        if (store.has(pk)) {
          const err = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          throw err;
        }
        uniqueConflict(table, row);
      }
      const inserted = [];
      for (const row of list) {
        const saved = cloneRow(row);
        store.set(pkFor(table, saved), saved);
        inserted.push(cloneRow(saved));
      }
      return returning ? inserted : [];
    },

    async update({ table, values, filters, returning = true }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      const updated = [];
      for (const [pk, row] of store.entries()) {
        if (!matches(row, filters)) continue;
        const next = { ...row, ...values };
        uniqueConflict(table, next);
        store.set(pk, cloneRow(next));
        updated.push(cloneRow(next));
      }
      return returning ? updated : [];
    },

    async delete({ table, filters }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      let count = 0;
      for (const [pk, row] of [...store.entries()]) {
        if (!matches(row, filters)) continue;
        store.delete(pk);
        count += 1;
      }
      return count;
    },

    async rpc({ fn, args = {} }) {
      const store = tables.get("crm_pending_events");
      if (fn === crm.CRM_PHASE_1G_RPC.CLAIM_PENDING_EVENTS) {
        const {
          p_tenant_id,
          p_venue_id,
          p_worker_id,
          p_claim_limit,
          p_now_at,
          p_claim_ttl_seconds,
        } = args;
        if (!p_tenant_id || !p_venue_id || !p_worker_id || !p_now_at) {
          throw new Error("scope denied");
        }
        if (p_claim_limit < 1 || p_claim_limit > 100) {
          throw new Error("claim_limit invalid");
        }
        if (p_claim_ttl_seconds < 1 || p_claim_ttl_seconds > 3600) {
          throw new Error("ttl invalid");
        }
        const expires = new Date(
          new Date(p_now_at).getTime() + p_claim_ttl_seconds * 1000
        ).toISOString();
        const candidates = [...store.values()]
          .filter(
            (row) =>
              row.tenant_id === p_tenant_id &&
              row.venue_id === p_venue_id &&
              row.status === "PENDING" &&
              String(row.available_at) <= String(p_now_at)
          )
          .sort((a, b) => {
            const a1 = String(a.available_at).localeCompare(String(b.available_at));
            if (a1) return a1;
            const a2 = String(a.created_at).localeCompare(String(b.created_at));
            if (a2) return a2;
            return String(a.pending_event_id).localeCompare(String(b.pending_event_id));
          })
          .slice(0, p_claim_limit);

        const claimed = [];
        for (const row of candidates) {
          const next = {
            ...row,
            status: "CLAIMED",
            claimed_by: p_worker_id,
            claimed_at: p_now_at,
            claim_expires_at: expires,
            attempt_count: Number(row.attempt_count || 0) + 1,
            updated_at: p_now_at,
            acknowledged_at: null,
            failed_at: null,
            failure_reason: null,
          };
          store.set(row.pending_event_id, next);
          claimed.push(cloneRow(next));
        }
        return claimed;
      }

      if (fn === crm.CRM_PHASE_1G_RPC.RELEASE_EXPIRED_CLAIMS) {
        const { p_tenant_id, p_venue_id, p_now_at } = args;
        if (!p_tenant_id || !p_venue_id || !p_now_at) {
          throw new Error("scope denied");
        }
        const released = [];
        for (const row of [...store.values()]) {
          if (
            row.tenant_id !== p_tenant_id ||
            row.venue_id !== p_venue_id ||
            row.status !== "CLAIMED" ||
            !row.claim_expires_at ||
            String(row.claim_expires_at) > String(p_now_at)
          ) {
            continue;
          }
          const next = {
            ...row,
            status: "PENDING",
            claimed_by: null,
            claimed_at: null,
            claim_expires_at: null,
            updated_at: p_now_at,
          };
          store.set(row.pending_event_id, next);
          released.push({
            pending_event_id: next.pending_event_id,
            event_id: next.event_id,
            attempt_count: next.attempt_count,
          });
        }
        return released;
      }

      throw new Error(`Unknown rpc ${fn}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Schema / migration static checks
// ---------------------------------------------------------------------------

test("Phase 1G migration files exist in approved docs/crm/phase-1g location", () => {
  for (const name of MIGRATION_FILES) {
    assert.ok(statSync(path.join(phase1gDir, name)).isFile(), name);
  }
});

test("Phase 1G SQL declares required tables and columns", () => {
  const sql = allSql();
  for (const table of [
    "crm_tags",
    "crm_tag_assignments",
    "crm_consent_records",
    "crm_pending_events",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  }
  for (const col of [
    "tag_id",
    "normalized_code",
    "assignment_id",
    "target_type",
    "consent_id",
    "policy_version",
    "pending_event_id",
    "payload_json",
    "claim_expires_at",
  ]) {
    assert.match(sql, new RegExp(`\\b${col}\\b`));
  }
});

test("Phase 1G SQL declares required constraints and indexes", () => {
  const sql = allSql();
  assert.match(sql, /crm_tags_tenant_venue_normalized_code_uq/);
  assert.match(sql, /crm_tag_assignments_unique_target_tag_uq/);
  assert.match(sql, /crm_pending_events_tenant_venue_event_id_uq/);
  assert.match(sql, /ON DELETE RESTRICT/);
  assert.match(sql, /crm_tags_tenant_venue_active_idx/);
  assert.match(sql, /crm_pending_events_claim_queue_idx/);
  assert.match(sql, /crm_consent_effective_at_desc_idx/);
});

test("Phase 1G SQL enables RLS and denies anonymous / public grants", () => {
  const sql = allSql();
  for (const table of [
    "crm_tags",
    "crm_tag_assignments",
    "crm_consent_records",
    "crm_pending_events",
  ]) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM anon`));
    assert.match(sql, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC`));
  }
  assert.doesNotMatch(sql, /TO anon;/i);
  assert.doesNotMatch(sql, /GRANT ALL[\s\S]*TO PUBLIC/i);
});

test("Phase 1G claim RPC is hardened and deterministic", () => {
  const rpc = readMigration("40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS.sql");
  assert.match(rpc, /SET search_path = public, pg_temp/);
  assert.match(rpc, /SKIP LOCKED/);
  assert.match(
    rpc,
    /ORDER BY pe\.available_at ASC, pe\.created_at ASC, pe\.pending_event_id ASC/
  );
  assert.match(rpc, /attempt_count = pe\.attempt_count \+ 1/);
  assert.match(rpc, /crm_phase1g_scope_allows/);
  assert.match(rpc, /user_has_permission\('crm\.audit\.view'\)/);
});

test("Phase 1G release RPC preserves attempt_count", () => {
  const rpc = readMigration("40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS.sql");
  assert.match(rpc, /attempt_count preserved intentionally/);
  assert.doesNotMatch(
    rpc,
    /crm_release_expired_pending_event_claims[\s\S]*attempt_count\s*=\s*0/
  );
});

test("Phase 1G consent append-only enforcement is present", () => {
  const sql = readMigration("60_CRM_PHASE_1G_CONSENT_IMMUTABLE.sql");
  assert.match(sql, /BEFORE UPDATE OR DELETE ON public\.crm_consent_records/);
  assert.match(sql, /append-only/);
});

test("Phase 1G SQL has no destructive cascade, production IDs, secrets, or apply commands", () => {
  const sql = allSql();
  assert.doesNotMatch(sql, /ON DELETE CASCADE/i);
  assert.doesNotMatch(sql, /password\s*=/i);
  assert.doesNotMatch(sql, /service_role_key/i);
  assert.doesNotMatch(sql, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  assert.doesNotMatch(sql, /psql\s|supabase\s+db\s+push|APPLY TO PRODUCTION/i);
  assert.doesNotMatch(sql, /venue-staging-[ab]|tenant-demo|production-found/i);
});

test("Phase 1G RLS uses verified helpers only (no invented unsafe tenant resolver)", () => {
  const rls = readMigration("30_CRM_PHASE_1G_RLS.sql");
  assert.match(rls, /user_venue_id\(\)/);
  assert.match(rls, /user_has_permission\(/);
  assert.match(rls, /is_super_admin\(\)/);
  assert.match(rls, /auth\.uid\(\)/);
  assert.doesNotMatch(rls, /first_venue|first_club/i);
  assert.doesNotMatch(rls, /coalesce\(\s*public\.user_venue_id/i);
});

// ---------------------------------------------------------------------------
// Public facade + adapters
// ---------------------------------------------------------------------------

test("Phase 1G public facade exports durable adapters and mapping utilities", () => {
  assert.equal(typeof crm.createDurableTagRepository, "function");
  assert.equal(typeof crm.createDurableTagAssignmentRepository, "function");
  assert.equal(typeof crm.createDurableConsentRepository, "function");
  assert.equal(typeof crm.createDurablePendingEventRepository, "function");
  assert.equal(typeof crm.requireCrmDatabaseClientPort, "function");
  assert.equal(typeof crm.mapTagDomainToRow, "function");
  assert.equal(typeof crm.mapTagRowToDomain, "function");
  assert.equal(typeof crm.mapConsentDomainToRow, "function");
  assert.equal(typeof crm.mapPendingEventDomainToRow, "function");
  assert.equal(typeof crm.createMemoryTagRepository, "function");
  assert.ok(!Object.keys(crm).includes("createFakeCrmDatabaseClient"));
});

test("Durable adapters require TenantVenueScope and injectable db client", async () => {
  assert.throws(() => crm.createDurableTagRepository({}), /CrmDatabaseClientPort/);
  const db = createFakeCrmDatabaseClient();
  const tags = crm.createDurableTagRepository({ db });
  await assert.rejects(() => tags.create({}, { tagId: "t1", name: "A" }), /tenantId/);
});

test("Tag create/get/list mapping and duplicate code conflict", async () => {
  const db = createFakeCrmDatabaseClient();
  const tags = crm.createDurableTagRepository({ db });
  const created = await tags.create(SCOPE_A, {
    tagId: "tag_1",
    name: "VIP Guest",
    code: "VIP",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  assert.equal(created.tagId, "tag_1");
  assert.equal(created.code, "vip");
  assert.equal(created.name, "VIP Guest");

  const byId = await tags.getById(SCOPE_A, "tag_1");
  assert.equal(byId.code, "vip");
  const byCode = await tags.getByCode(SCOPE_A, "VIP");
  assert.equal(byCode.tagId, "tag_1");

  const listed = await tags.list(SCOPE_A, { active: true });
  assert.equal(listed.length, 1);

  await assert.rejects(
    () =>
      tags.create(SCOPE_A, {
        tagId: "tag_2",
        name: "Other",
        code: "vip",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      }),
    (err) => err.code === crm.CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT
  );

  // Cross-scope does not leak
  assert.equal(await tags.getById(SCOPE_B, "tag_1"), null);
});

test("Tag assignment create/list/remove mapping; no tag definition delete", async () => {
  const db = createFakeCrmDatabaseClient();
  const tags = crm.createDurableTagRepository({ db });
  const assignments = crm.createDurableTagAssignmentRepository({ db });

  await tags.create(SCOPE_A, {
    tagId: "tag_1",
    name: "Hot",
    code: "hot",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });

  const assignment = await assignments.create(SCOPE_A, {
    assignmentId: "asg_1",
    tagId: "tag_1",
    targetType: crm.TAG_TARGET_TYPE.LEAD,
    targetId: "lead_1",
    assignedByActorId: "user-1",
    assignedAt: FIXED_NOW,
  });
  assert.equal(assignment.assignmentId, "asg_1");

  const again = await assignments.create(SCOPE_A, {
    assignmentId: "asg_2",
    tagId: "tag_1",
    targetType: crm.TAG_TARGET_TYPE.LEAD,
    targetId: "lead_1",
    assignedByActorId: "user-1",
    assignedAt: FIXED_NOW,
  });
  assert.equal(again.assignmentId, "asg_1");

  const byTarget = await assignments.listByTarget(
    SCOPE_A,
    crm.TAG_TARGET_TYPE.LEAD,
    "lead_1"
  );
  assert.equal(byTarget.length, 1);

  assert.equal(await assignments.remove(SCOPE_A, "asg_1"), true);
  assert.equal(await assignments.remove(SCOPE_A, "asg_1"), false);
  assert.ok(await tags.getById(SCOPE_A, "tag_1"));
});

test("Consent create/history/effective-state; update/delete unavailable", async () => {
  const db = createFakeCrmDatabaseClient();
  const consentRepo = crm.createDurableConsentRepository({ db });

  const granted = await consentRepo.create(SCOPE_A, {
    consentId: "c1",
    contactRefId: "cref_1",
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    status: crm.CONSENT_STATUS.GRANTED,
    policyVersion: "v1",
    effectiveAt: FIXED_NOW,
    recordedByActorId: "user-1",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  assert.equal(granted.status, "GRANTED");

  const revoked = await consentRepo.create(SCOPE_A, {
    consentId: "c2",
    contactRefId: "cref_1",
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    status: crm.CONSENT_STATUS.REVOKED,
    policyVersion: "v1",
    effectiveAt: "2026-07-21T13:00:00.000Z",
    revokedAt: "2026-07-21T13:00:00.000Z",
    recordedByActorId: "user-1",
    createdAt: "2026-07-21T13:00:00.000Z",
    updatedAt: "2026-07-21T13:00:00.000Z",
  });
  assert.equal(revoked.status, "REVOKED");

  const history = await consentRepo.list(SCOPE_A, {
    contactRefId: "cref_1",
    channel: "EMAIL",
    purpose: "MARKETING",
  });
  assert.equal(history.length, 2);
  assert.equal(history[0].consentId, "c2");

  const effective = deriveEffectiveConsent(
    history,
    SCOPE_A,
    "cref_1",
    "EMAIL",
    "MARKETING",
    "2026-07-21T14:00:00.000Z"
  );
  assert.equal(effective.consentId, "c2");
  assert.equal(effective.status, "REVOKED");

  assert.throws(() => consentRepo.update(SCOPE_A, granted), /append-only/);
  assert.throws(() => consentRepo.delete(SCOPE_A, "c1"), /append-only/);
});

test("Pending event batch enqueue is atomic; claim/ack/fail/release work", async () => {
  const db = createFakeCrmDatabaseClient();
  const pending = crm.createDurablePendingEventRepository({ db });

  const saved = await pending.enqueue(SCOPE_A, [
    {
      pendingEventId: "pe_1",
      eventId: "evt_1",
      eventType: "crm.audit.tag.created",
      aggregateType: "CrmTag",
      aggregateId: "tag_1",
      payload: { tagId: "tag_1" },
      status: "PENDING",
      availableAt: FIXED_NOW,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    {
      pendingEventId: "pe_2",
      eventId: "evt_2",
      eventType: "crm.audit.tag.created",
      aggregateType: "CrmTag",
      aggregateId: "tag_2",
      payload: { tagId: "tag_2" },
      status: "PENDING",
      availableAt: "2026-07-21T11:00:00.000Z",
      createdAt: "2026-07-21T11:00:00.000Z",
      updatedAt: "2026-07-21T11:00:00.000Z",
    },
  ]);
  assert.equal(saved.length, 2);

  await assert.rejects(
    () =>
      pending.enqueue(SCOPE_A, [
        {
          pendingEventId: "pe_3",
          eventId: "evt_1",
          eventType: "crm.audit.tag.created",
          aggregateType: "CrmTag",
          aggregateId: "tag_x",
          payload: {},
          status: "PENDING",
          availableAt: FIXED_NOW,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        },
        {
          pendingEventId: "pe_4",
          eventId: "evt_4",
          eventType: "crm.audit.tag.created",
          aggregateType: "CrmTag",
          aggregateId: "tag_y",
          payload: {},
          status: "PENDING",
          availableAt: FIXED_NOW,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        },
      ]),
    (err) => err.code === crm.CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT
  );
  assert.equal(await pending.getById(SCOPE_A, "pe_3"), null);
  assert.equal(await pending.getById(SCOPE_A, "pe_4"), null);

  const claimed = await pending.claim(SCOPE_A, {
    claimedBy: "worker-1",
    nowIso: FIXED_NOW,
    limit: 1,
    claimTtlMs: 60_000,
  });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].pendingEventId, "pe_2");
  assert.equal(claimed[0].status, "CLAIMED");
  assert.equal(claimed[0].attemptCount, 1);

  const acked = await pending.update(SCOPE_A, {
    ...claimed[0],
    status: "ACKNOWLEDGED",
    acknowledgedAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  assert.equal(acked.status, "ACKNOWLEDGED");

  await assert.rejects(
    () =>
      pending.update(SCOPE_A, {
        ...acked,
        status: "FAILED",
        failedAt: FIXED_NOW,
        failureReason: "nope",
        updatedAt: FIXED_NOW,
      }),
    (err) => err.code === crm.CRM_ERROR_CODES.INVALID_TRANSITION
  );

  const claimed2 = await pending.claim(SCOPE_A, {
    claimedBy: "worker-1",
    nowIso: FIXED_NOW,
    limit: 1,
    claimTtlMs: 1,
  });
  assert.equal(claimed2[0].pendingEventId, "pe_1");

  const failed = await pending.update(SCOPE_A, {
    ...claimed2[0],
    status: "FAILED",
    failedAt: FIXED_NOW,
    failureReason: "provider unavailable",
    updatedAt: FIXED_NOW,
  });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.failureReason, "provider unavailable");
});

test("Release expired claims preserves attempt_count", async () => {
  const db = createFakeCrmDatabaseClient();
  const pending = crm.createDurablePendingEventRepository({ db });
  await pending.enqueue(SCOPE_A, [
    {
      pendingEventId: "pe_r1",
      eventId: "evt_r1",
      eventType: "crm.audit.tag.created",
      aggregateType: "CrmTag",
      aggregateId: "tag_r",
      payload: {},
      status: "PENDING",
      availableAt: FIXED_NOW,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
  ]);
  const claimed = await pending.claim(SCOPE_A, {
    claimedBy: "worker-1",
    nowIso: FIXED_NOW,
    limit: 1,
    claimTtlMs: 1000,
  });
  assert.equal(claimed[0].attemptCount, 1);

  // Force expiry by rewriting claim_expires_at via guarded update path to PENDING release RPC
  const released = await pending.releaseExpiredClaims(SCOPE_A, {
    nowIso: "2026-07-21T12:00:02.000Z",
  });
  assert.equal(released.length, 1);
  assert.equal(released[0].status, "PENDING");
  assert.equal(released[0].attemptCount, 1);
  assert.equal(released[0].claimedBy, null);
});

test("Tenant and venue isolation + missing row fail-closed", async () => {
  const db = createFakeCrmDatabaseClient();
  const tags = crm.createDurableTagRepository({ db });
  await tags.create(SCOPE_A, {
    tagId: "tag_iso",
    name: "Iso",
    code: "iso",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  assert.equal(await tags.getById(SCOPE_B, "tag_iso"), null);
  assert.equal(
    await tags.getById({ tenantId: "tenant-a", venueId: "venue-other" }, "tag_iso"),
    null
  );
  assert.equal(await tags.getById(SCOPE_A, "missing"), null);
});

test("Domain-row mapping is explicit and defensive", () => {
  const row = crm.mapTagDomainToRow({
    tagId: "tag_m",
    tenantId: SCOPE_A.tenantId,
    venueId: SCOPE_A.venueId,
    name: "Alpha",
    code: "Alpha",
    active: true,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  assert.equal(row.tag_id, "tag_m");
  assert.equal(row.normalized_code, "alpha");
  assert.equal(row.tenant_id, SCOPE_A.tenantId);
  assert.ok(!("tagId" in row));

  const domain = crm.mapTagRowToDomain(row);
  assert.equal(domain.tagId, "tag_m");
  assert.ok(Object.isFrozen(domain));

  const payloadRow = crm.mapPendingEventDomainToRow({
    pendingEventId: "pe_m",
    tenantId: SCOPE_A.tenantId,
    venueId: SCOPE_A.venueId,
    eventId: "e1",
    eventType: "crm.audit.tag.created",
    aggregateType: "CrmTag",
    aggregateId: "tag_m",
    payload: { a: 1 },
    status: "PENDING",
    availableAt: FIXED_NOW,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  payloadRow.payload_json.a = 99;
  const mappedBack = crm.mapPendingEventRowToDomain({
    ...payloadRow,
    payload_json: { a: 1 },
  });
  assert.equal(mappedBack.payload.a, 1);
});

test("CRM menu remains PARTIAL; Phase 1G docs present; no live supabase imports in durable adapters", () => {
  const crmPathItems = CRM_MENU_ROOT.children.filter((item) =>
    String(item.path || "").startsWith("/crm/")
  );
  assert.ok(crmPathItems.length > 0);
  for (const item of crmPathItems) {
    assert.equal(item.featureStatus, FEATURE_STATUS.PARTIAL, item.key);
  }

  for (const name of [
    "01_DURABLE_PERSISTENCE_ARCHITECTURE.md",
    "02_DATABASE_SCHEMA_AND_CONSTRAINTS.md",
    "03_RLS_AND_AUTHORIZATION_DESIGN.md",
    "04_PENDING_EVENT_CLAIMING_PROTOCOL.md",
    "05_REPOSITORY_ADAPTER_MAPPING.md",
    "06_MIGRATION_ROLLOUT_AND_ROLLBACK_PLAN.md",
    "07_PHASE_1G_ACCEPTANCE_CRITERIA.md",
  ]) {
    assert.ok(statSync(path.join(phase1gDir, name)).isFile());
  }

  const durableDir = path.join(root, "src", "features", "crm", "persistence");
  for (const file of walkFiles(durableDir)) {
    if (!file.endsWith(".js")) continue;
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /createClient\(|@supabase\/supabase-js/);
    assert.doesNotMatch(text, /process\.env\.SUPABASE|process\.env\.VITE_SUPABASE/);
  }
});

test("Static secret scan across Phase 1G artifacts", () => {
  const files = [
    ...MIGRATION_FILES.map((n) => path.join(phase1gDir, n)),
    ...walkFiles(path.join(root, "src", "features", "crm", "persistence")),
  ];
  const secretPatterns = [
    /-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----/,
    /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\./,
    /password\s*[:=]\s*['"][^'"]{8,}/i,
    /service_role_key\s*[:=]/i,
  ];
  for (const file of files) {
    if (!file.endsWith(".js") && !file.endsWith(".sql") && !file.endsWith(".md")) continue;
    const text = readFileSync(file, "utf8");
    for (const pattern of secretPatterns) {
      assert.doesNotMatch(text, pattern, file);
    }
  }
});
