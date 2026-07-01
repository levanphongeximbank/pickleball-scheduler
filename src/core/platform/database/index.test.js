import test from "node:test";
import assert from "node:assert/strict";

import { V5_PLATFORM_SCHEMA } from "./schema.js";
import { migrationSql, rollbackSql } from "./index.js";

test("phase 3 schema exposes the canonical v5 tables", () => {
  assert.equal(V5_PLATFORM_SCHEMA.version, 1);
  assert.ok(V5_PLATFORM_SCHEMA.tables.tenants);
  assert.ok(V5_PLATFORM_SCHEMA.tables.audit_logs);
});

test("phase 3 migration and rollback SQL are available", () => {
  assert.match(migrationSql, /create table if not exists v5_tenants/i);
  assert.match(rollbackSql, /drop table if exists v5_settings/i);
});
