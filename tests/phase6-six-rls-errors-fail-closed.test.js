import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../docs/v6/staging-six-rls-errors-remediation-01/', import.meta.url);
const readSql = async (name) => (await readFile(new URL(name, root), 'utf8')).toLowerCase();
const tables = [
  'match_game_states',
  'match_incidents',
  'match_participant_positions',
  'referee_device_sessions',
  'rating_proposals',
  'rating_confidence_events',
];

test('forward fail-closes exactly six audited tables without policies or data mutation', async () => {
  const sql = await readSql('10_SIX_RLS_ERRORS_FAIL_CLOSED_FORWARD.sql');
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke insert, update, delete on table public\\.${table} from anon`));
  }
  assert.equal((sql.match(/enable row level security/g) ?? []).length, 6);
  assert.equal((sql.match(/revoke insert, update, delete/g) ?? []).length, 6);
  assert.doesNotMatch(sql, /\b(create policy|insert into|update public\.|delete from|truncate)\b/);
  assert.match(sql, /target_rows <> 0/);
});

test('rollback restores only audited anon DML ACL and RLS state with safety gates', async () => {
  const sql = await readSql('90_SIX_RLS_ERRORS_FAIL_CLOSED_ROLLBACK.sql');
  for (const table of tables) {
    assert.match(sql, new RegExp(`grant insert, update, delete on table public\\.${table} to anon`));
    assert.match(sql, new RegExp(`alter table public\\.${table} disable row level security`));
  }
  assert.equal((sql.match(/disable row level security/g) ?? []).length, 6);
  assert.equal((sql.match(/grant insert, update, delete/g) ?? []).length, 6);
  assert.match(sql, /rollback refused: public\.% now has policies/);
  assert.match(sql, /target_rows <> 0/);
  assert.doesNotMatch(sql, /\b(create policy|insert into|update public\.|delete from|truncate)\b/);
});

test('verification is read-only and covers metadata plus anon and authenticated reads', async () => {
  const sql = await readSql('99_SIX_RLS_ERRORS_FAIL_CLOSED_VERIFY.sql');
  for (const table of tables) assert.ok(sql.includes(table), `missing ${table}`);
  for (const contract of ['relrowsecurity', 'policy_count', 'begin read only', 'set local role anon', 'set local role authenticated']) {
    assert.ok(sql.includes(contract), `missing verification contract: ${contract}`);
  }
  assert.equal((sql.match(/visible_rows/g) ?? []).length, 12);
  assert.doesNotMatch(sql, /\b(insert into|update public\.|delete from|truncate|create policy|alter table|grant|revoke)\b/);
});
