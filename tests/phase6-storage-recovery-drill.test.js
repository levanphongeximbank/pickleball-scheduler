import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scriptUrl = new URL('../scripts/phase6-storage-recovery-drill.ps1', import.meta.url);
const readScript = async () => (await readFile(scriptUrl, 'utf8')).toLowerCase();

test('storage drill is fixed to Production source and exact two-bucket allowlist', async () => {
  const script = await readScript();
  assert.match(script, /sourceprojectref = 'expuvcohlcjzvrrauvud'/);
  assert.match(script, /allowedbuckets = @\('user-avatars', 'tournament-broadcast-vods'\)/);
  assert.match(script, /destination project must not be production/);
  assert.doesNotMatch(script, /remove-item.*phase6_source|rclone.*\bsync\b|rclone.*\bdelete\b|rclone.*\bpurge\b/);
});

test('copy is fail-closed behind execute switch and exact Owner GO token', async () => {
  const script = await readScript();
  assert.match(script, /\$mode -eq 'copy'.*\(-not \$execute.*ownergotoken/s);
  assert.match(script, /owner_go_storage_restore_drill/);
  assert.match(script, /'copy', "phase6_source:\$bucket", "phase6_dest:\$bucket"/);
  assert.match(script, /'--size-only', '--no-traverse'/);
  assert.doesNotMatch(script, /'--metadata'/);
});

test('evidence excludes credentials and verifies count, bytes, and one-way object size', async () => {
  const script = await readScript();
  for (const contract of ['sourcecount', 'sourcebytes', 'destinationcountafter', 'destinationbytesafter', 'elapsedseconds', "'check'", "'--one-way'", "'--size-only'"]) {
    assert.ok(script.includes(contract), `missing ${contract}`);
  }
  const evidenceBlock = script.slice(script.indexOf('$evidence ='));
  assert.doesNotMatch(evidenceBlock, /access_key|secret_access|secretaccess/);
  assert.match(script, /remove-item -literalpath \$tempconfig -force/);
});

test('storage drill supports a gitignored local credential file', async () => {
  const script = await readScript();
  assert.match(script, /\.env\.phase6-storage\.local/);
  assert.match(script, /phase6_storage_dest_project_ref/);
});

test('successful rclone stderr notices do not fail verification', async () => {
  const script = await readScript();
  assert.match(script, /\$erroractionpreference = 'continue'/);
  assert.match(script, /\$exitcode = \$lastexitcode/);
  assert.match(script, /if \(\$exitcode -ne 0\)/);
});

test('committed Storage evidence does not overstate empty-destination RTO', async () => {
  const evidence = JSON.parse(await readFile(new URL('../docs/v6/storage-recovery-drill-01/COPY_RECONCILIATION_RESULT.json', import.meta.url), 'utf8'));
  assert.equal(evidence.copyResult, 'PASS');
  assert.equal(evidence.contentEquivalence, 'PASS');
  assert.equal(evidence.productionMutation, 0);
  assert.match(evidence.fullEmptyDestinationRestoreRto, /^NOT_PROVEN_/);
});
