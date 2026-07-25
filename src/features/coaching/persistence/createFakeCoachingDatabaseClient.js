/**
 * In-process durable contract harness (COACHING-02).
 * Simulates CoachingDatabaseClientPort + atomic RPCs.
 * NOT a live database. NOT for Production. No network. No secrets.
 */

import { COACHING_02_RPC, COACHING_02_TABLES } from "./databaseClientPort.js";

const TABLE_PK = Object.freeze({
  [COACHING_02_TABLES.PROGRAMS]: "program_id",
  [COACHING_02_TABLES.COACH_REFERENCES]: "coach_reference_id",
  [COACHING_02_TABLES.RELATIONSHIPS]: "relationship_id",
  [COACHING_02_TABLES.ENROLLMENTS]: "enrollment_id",
  [COACHING_02_TABLES.CURRICULA]: "curriculum_id",
  [COACHING_02_TABLES.LESSONS]: "lesson_id",
  [COACHING_02_TABLES.SESSIONS]: "session_id",
  [COACHING_02_TABLES.ATTENDANCE]: "attendance_id",
  [COACHING_02_TABLES.ATTENDANCE_CORRECTIONS]: "correction_id",
  [COACHING_02_TABLES.PACKAGES]: "package_id",
  [COACHING_02_TABLES.ENTITLEMENTS]: "entitlement_id",
  [COACHING_02_TABLES.USAGE_EVENTS]: "usage_event_id",
  [COACHING_02_TABLES.EVALUATIONS]: "evaluation_id",
});

/**
 * @returns {import('./databaseClientPort.js').CoachingDatabaseClientPort & {
 *   resetAllForTests: () => void,
 *   _tables: Map<string, Map<string, object>>,
 * }}
 */
export function createFakeCoachingDatabaseClient() {
  /** @type {Map<string, Map<string, object>>} */
  const tables = new Map();
  for (const name of Object.values(COACHING_02_TABLES)) {
    tables.set(name, new Map());
  }

  function cloneRow(row) {
    return JSON.parse(JSON.stringify(row));
  }

  function pkFor(table, row) {
    const col = TABLE_PK[table];
    if (!col) throw new Error(`Unknown table ${table}`);
    return row[col];
  }

  function scopeKey(tenantId, clubId, id) {
    return `${tenantId}\u0000${clubId}\u0000${id}`;
  }

  function matches(row, filters = {}) {
    for (const [key, value] of Object.entries(filters || {})) {
      if (row[key] !== value) return false;
    }
    return true;
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

  function assertUnique(table, row, excludingKey = null) {
    const store = tables.get(table);
    for (const [key, existing] of store.entries()) {
      if (excludingKey != null && key === excludingKey) continue;
      if (
        existing.tenant_id === row.tenant_id &&
        existing.club_id === row.club_id &&
        pkFor(table, existing) === pkFor(table, row)
      ) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        err.name = "CoachingUniqueViolation";
        throw err;
      }
      if (
        table === COACHING_02_TABLES.USAGE_EVENTS &&
        existing.tenant_id === row.tenant_id &&
        existing.club_id === row.club_id &&
        existing.idempotency_key === row.idempotency_key
      ) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        err.name = "CoachingUniqueViolation";
        throw err;
      }
      if (
        table === COACHING_02_TABLES.ATTENDANCE &&
        existing.tenant_id === row.tenant_id &&
        existing.club_id === row.club_id &&
        existing.session_id === row.session_id &&
        existing.player_id === row.player_id
      ) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        err.name = "CoachingUniqueViolation";
        throw err;
      }
    }
  }

  function applyAttendanceCorrection(args = {}) {
    const tenantId = String(args.p_tenant_id || "").trim();
    const clubId = String(args.p_club_id || "").trim();
    const attendanceId = String(args.p_attendance_id || "").trim();
    const expectedVersion = Number(args.p_expected_version);
    const correctedStatus = String(args.p_corrected_status || "");
    const reason = String(args.p_reason || "").trim();
    const actorId = String(args.p_actor_id || "").trim();
    const correctionId = String(args.p_correction_id || "").trim();
    const correctedAt = args.p_corrected_at || new Date().toISOString();
    const notes = args.p_notes;

    if (!tenantId || !clubId) {
      const err = new Error("COACHING_MISSING_SCOPE");
      err.code = "42501";
      throw err;
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      const err = new Error("COACHING_INVALID_INPUT: expectedVersion required");
      err.code = "22023";
      throw err;
    }

    const store = tables.get(COACHING_02_TABLES.ATTENDANCE);
    const key = scopeKey(tenantId, clubId, attendanceId);
    const current = store.get(key);
    if (!current) {
      const err = new Error("COACHING_NOT_FOUND");
      err.code = "P0002";
      err.name = "CoachingNotFound";
      throw err;
    }
    if (Number(current.version) !== expectedVersion) {
      const err = new Error("COACHING_VERSION_CONFLICT");
      err.code = "40001";
      err.name = "CoachingVersionConflict";
      throw err;
    }
    if (current.status === correctedStatus) {
      const err = new Error("COACHING_INVALID_INPUT: correction must change status");
      err.code = "22023";
      throw err;
    }
    if (!reason || !actorId || !correctionId) {
      const err = new Error("COACHING_INVALID_INPUT");
      err.code = "22023";
      throw err;
    }

    const previousStatus = current.status;
    const now = new Date().toISOString();
    const updated = cloneRow(current);
    updated.status = correctedStatus;
    if (notes != null) updated.notes = notes;
    updated.version = Number(current.version) + 1;
    updated.updated_at = now;
    store.set(key, updated);

    const correction = {
      correction_id: correctionId,
      tenant_id: tenantId,
      club_id: clubId,
      venue_id: current.venue_id ?? null,
      attendance_id: attendanceId,
      previous_status: previousStatus,
      corrected_status: correctedStatus,
      reason,
      actor_id: actorId,
      corrected_at: correctedAt,
      created_at: now,
      version: 1,
    };
    const corrStore = tables.get(COACHING_02_TABLES.ATTENDANCE_CORRECTIONS);
    const corrKey = scopeKey(tenantId, clubId, correctionId);
    if (corrStore.has(corrKey)) {
      // rollback attendance
      store.set(key, current);
      const err = new Error("duplicate key value violates unique constraint");
      err.code = "23505";
      err.name = "CoachingUniqueViolation";
      throw err;
    }
    corrStore.set(corrKey, correction);
    return {
      attendance: cloneRow(updated),
      correction: cloneRow(correction),
    };
  }

  function consumeEntitlement(args = {}) {
    const tenantId = String(args.p_tenant_id || "").trim();
    const clubId = String(args.p_club_id || "").trim();
    const entitlementId = String(args.p_entitlement_id || "").trim();
    const expectedVersion = Number(args.p_expected_version);
    const playerId = String(args.p_player_id || "").trim();
    const idempotencyKey = String(args.p_idempotency_key || "").trim();
    const usageEventId = String(args.p_usage_event_id || "").trim();
    const actorId = args.p_actor_id ? String(args.p_actor_id).trim() : null;
    const consumedAt = args.p_consumed_at || new Date().toISOString();

    if (!tenantId || !clubId) {
      const err = new Error("COACHING_MISSING_SCOPE");
      err.code = "42501";
      throw err;
    }

    const usageStore = tables.get(COACHING_02_TABLES.USAGE_EVENTS);
    for (const row of usageStore.values()) {
      if (
        row.tenant_id === tenantId &&
        row.club_id === clubId &&
        row.idempotency_key === idempotencyKey
      ) {
        const entStore = tables.get(COACHING_02_TABLES.ENTITLEMENTS);
        const ent = entStore.get(scopeKey(tenantId, clubId, row.entitlement_id));
        return {
          entitlement: cloneRow(ent),
          usageEvent: cloneRow(row),
          idempotentReplay: true,
        };
      }
    }

    const entStore = tables.get(COACHING_02_TABLES.ENTITLEMENTS);
    const key = scopeKey(tenantId, clubId, entitlementId);
    const ent = entStore.get(key);
    if (!ent) {
      const err = new Error("COACHING_NOT_FOUND");
      err.code = "P0002";
      err.name = "CoachingNotFound";
      throw err;
    }
    if (Number(ent.version) !== expectedVersion) {
      const err = new Error("COACHING_VERSION_CONFLICT");
      err.code = "40001";
      err.name = "CoachingVersionConflict";
      throw err;
    }
    if (ent.player_id !== playerId) {
      const err = new Error("COACHING_FORBIDDEN_SCOPE: cross-player entitlement use");
      err.code = "42501";
      throw err;
    }
    if (ent.status !== "active") {
      const err = new Error("COACHING_INVALID_TRANSITION: entitlement not active");
      err.code = "22023";
      throw err;
    }

    const pkgStore = tables.get(COACHING_02_TABLES.PACKAGES);
    const pkg = pkgStore.get(scopeKey(tenantId, clubId, ent.package_id));
    if (!pkg) {
      const err = new Error("COACHING_NOT_FOUND: package");
      err.code = "P0002";
      throw err;
    }
    if (["draft", "expired", "archived"].includes(pkg.status)) {
      const err = new Error("COACHING_INVALID_TRANSITION: package inactive/cancelled");
      err.code = "22023";
      throw err;
    }
    if (Number(ent.sessions_remaining) < 1) {
      const err = new Error("COACHING_ENTITLEMENT_EXHAUSTED");
      err.code = "22023";
      throw err;
    }
    if (ent.valid_from && Date.parse(consumedAt) < Date.parse(ent.valid_from)) {
      const err = new Error("COACHING_INVALID_TRANSITION: before validFrom");
      err.code = "22023";
      throw err;
    }
    if (ent.valid_to && Date.parse(consumedAt) > Date.parse(ent.valid_to)) {
      const err = new Error("COACHING_INVALID_TRANSITION: after validTo");
      err.code = "22023";
      throw err;
    }

    const nextConsumed = Number(ent.sessions_consumed) + 1;
    const nextRemaining = Number(ent.sessions_granted) - nextConsumed;
    if (nextRemaining < 0) {
      const err = new Error("COACHING_ENTITLEMENT_EXHAUSTED");
      err.code = "22023";
      throw err;
    }

    const updated = cloneRow(ent);
    updated.sessions_consumed = nextConsumed;
    updated.sessions_remaining = nextRemaining;
    if (nextRemaining === 0) updated.status = "exhausted";
    updated.version = Number(ent.version) + 1;
    updated.updated_at = consumedAt;
    entStore.set(key, updated);

    const usage = {
      usage_event_id: usageEventId,
      tenant_id: tenantId,
      club_id: clubId,
      venue_id: ent.venue_id ?? null,
      entitlement_id: entitlementId,
      package_id: ent.package_id,
      player_id: playerId,
      sessions_delta: 1,
      remaining_after: nextRemaining,
      idempotency_key: idempotencyKey,
      actor_id: actorId,
      consumed_at: consumedAt,
      created_at: new Date().toISOString(),
      version: 1,
    };
    usageStore.set(scopeKey(tenantId, clubId, usageEventId), usage);

    return {
      entitlement: cloneRow(updated),
      usageEvent: cloneRow(usage),
      idempotentReplay: false,
    };
  }

  return {
    _tables: tables,

    resetAllForTests() {
      for (const store of tables.values()) store.clear();
    },

    async select({ table, filters = {}, order = [], limit } = {}) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      let rows = [...store.values()].filter((row) => matches(row, filters));
      rows = sortRows(rows, order).map(cloneRow);
      if (Number.isInteger(limit) && limit > 0) rows = rows.slice(0, limit);
      return rows;
    },

    async insert({ table, rows, returning = true } = {}) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      const list = Array.isArray(rows) ? rows : [rows];
      const out = [];
      for (const row of list) {
        const cloned = cloneRow(row);
        const key = scopeKey(cloned.tenant_id, cloned.club_id, pkFor(table, cloned));
        if (store.has(key)) {
          const err = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          err.name = "CoachingUniqueViolation";
          throw err;
        }
        assertUnique(table, cloned);
        store.set(key, cloned);
        out.push(cloneRow(cloned));
      }
      return returning ? out : [];
    },

    async update({ table, values, filters = {}, returning = true } = {}) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      const out = [];
      for (const [key, row] of store.entries()) {
        if (!matches(row, filters)) continue;
        const next = { ...cloneRow(row), ...cloneRow(values) };
        assertUnique(table, next, key);
        store.set(key, next);
        out.push(cloneRow(next));
      }
      return returning ? out : [];
    },

    async delete({ table, filters = {} } = {}) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      let count = 0;
      for (const [key, row] of [...store.entries()]) {
        if (matches(row, filters)) {
          store.delete(key);
          count += 1;
        }
      }
      return count;
    },

    async rpc({ fn, args = {} } = {}) {
      if (fn === COACHING_02_RPC.APPLY_ATTENDANCE_CORRECTION) {
        return applyAttendanceCorrection(args);
      }
      if (fn === COACHING_02_RPC.CONSUME_ENTITLEMENT) {
        return consumeEntitlement(args);
      }
      throw new Error(`Unknown RPC ${fn}`);
    },
  };
}
