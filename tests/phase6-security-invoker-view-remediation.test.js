import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../docs/v6/security-invoker-view-remediation-01/', import.meta.url);

const readSql = async (name) => (await readFile(new URL(name, root), 'utf8')).toLowerCase();

test('forward package changes exactly two views to security_invoker', async () => {
  const sql = await readSql('10_SECURITY_INVOKER_VIEW_FORWARD.sql');

  assert.match(sql, /alter view public\.tenants\s+set \(security_invoker = true\)/);
  assert.match(sql, /alter view public\.club_data_v3_safe\s+set \(security_invoker = true\)/);
  assert.equal((sql.match(/alter view/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|drop|create table|alter table|grant|revoke)\b/);
});

test('rollback resets only the two security_invoker reloptions', async () => {
  const sql = await readSql('90_SECURITY_INVOKER_VIEW_ROLLBACK.sql');

  assert.match(sql, /alter view public\.tenants\s+reset \(security_invoker\)/);
  assert.match(sql, /alter view public\.club_data_v3_safe\s+reset \(security_invoker\)/);
  assert.equal((sql.match(/alter view/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|drop|create|alter table|grant|revoke)\b/);
});

test('verification is read-only and covers views, ACL visibility, and base-table RLS', async () => {
  const sql = await readSql('99_SECURITY_INVOKER_VIEW_VERIFY.sql');

  for (const required of [
    'security_invoker=true',
    "has_table_privilege('anon'",
    "has_table_privilege('authenticated'",
    "has_table_privilege('service_role'",
    "'venues'",
    "'subscriptions'",
    "'club_data_v3'",
    'relrowsecurity',
  ]) {
    assert.ok(sql.includes(required), `missing verification contract: ${required}`);
  }

  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|drop|create|alter|grant|revoke)\s+(table|view|policy|on|into|from|public\.)/);
});
