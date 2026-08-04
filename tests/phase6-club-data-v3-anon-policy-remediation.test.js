import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../docs/v6/club-data-v3-anon-policy-remediation-02/', import.meta.url);
const readSql = async (name) => (await readFile(new URL(name, root), 'utf8')).toLowerCase();

const policyNames = [
  'club_data_v3_anon_select',
  'club_data_v3_anon_insert',
  'club_data_v3_anon_update',
];

test('forward removes exactly the three legacy anon policies without data mutation', async () => {
  const sql = await readSql('10_CLUB_DATA_V3_ANON_POLICY_FORWARD.sql');

  for (const name of policyNames) {
    assert.match(sql, new RegExp(`drop policy ${name} on public\\.club_data_v3`));
  }
  assert.equal((sql.match(/drop policy/g) ?? []).length, 3);
  assert.doesNotMatch(sql, /\b(insert into|update public\.|delete from|truncate|alter table|grant|revoke)\b/);
});

test('rollback restores exactly the observed SELECT, INSERT, and UPDATE policies', async () => {
  const sql = await readSql('90_CLUB_DATA_V3_ANON_POLICY_ROLLBACK.sql');

  for (const name of policyNames) {
    assert.match(sql, new RegExp(`create policy ${name}`));
  }
  assert.equal((sql.match(/create policy/g) ?? []).length, 3);
  assert.match(sql, /for select\s+to anon\s+using \(true\)/);
  assert.match(sql, /for insert\s+to anon\s+with check \(true\)/);
  assert.match(sql, /for update\s+to anon\s+using \(true\)\s+with check \(true\)/);
  assert.doesNotMatch(sql, /\b(insert into|update public\.|delete from|truncate|alter table|grant|revoke)\b/);
});

test('verification is read-only and covers metadata plus anon base/view reads', async () => {
  const sql = await readSql('99_CLUB_DATA_V3_ANON_POLICY_VERIFY.sql');

  for (const required of [
    'relrowsecurity',
    'legacy_anon_policies_absent',
    'begin read only',
    'set local role anon',
    'from public.club_data_v3)',
    'from public.club_data_v3_safe)',
    'rollback',
  ]) {
    assert.ok(sql.includes(required), `missing verification contract: ${required}`);
  }
  assert.doesNotMatch(sql, /\b(insert into|update public\.|delete from|truncate|drop policy|create policy|alter table|grant|revoke)\b/);
});
