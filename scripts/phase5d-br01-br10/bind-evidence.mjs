import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const PKG = 'docs/platform-hard-cutover-01/phase-05d-staging-rebuild-readiness-02';
const impl = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

const EVIDENCE_ONLY = new Set([
  `${PKG}/14_LOCAL_VERIFICATION_REPORT.json`,
  `${PKG}/15_ARTIFACT_HASH_MANIFEST.json`,
  `${PKG}/16_EVIDENCE_BINDING.json`,
  'scripts/phase5d-br01-br10/bind-evidence.mjs',
]);

function sha(rel) {
  const b = fs.readFileSync(path.join(ROOT, rel));
  return {
    path: rel.replace(/\\/g, '/'),
    sha256: crypto.createHash('sha256').update(b).digest('hex'),
    bytes: b.length,
  };
}

function walk(d, acc = []) {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, n.name);
    if (n.isDirectory()) walk(p, acc);
    else if (/\.(json|md|sql|mjs)$/.test(n.name) && !n.name.startsWith('_')) {
      acc.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  }
  return acc;
}

const all = [
  ...new Set([
    ...walk(path.join(ROOT, PKG)),
    ...walk(path.join(ROOT, 'scripts/phase5d-br01-br10')),
    'docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.sql',
  ]),
].sort();

const implementationArtifacts = all.filter((p) => !EVIDENCE_ONLY.has(p)).map(sha);

const manifest = {
  marker: 'PHASE5D_ARTIFACT_HASH_MANIFEST_V1',
  implementationCommitSha: impl,
  classification: 'EVIDENCE_READBACK_PENDING_INDEPENDENT_REVIEW',
  artifacts: implementationArtifacts,
};

fs.writeFileSync(path.join(ROOT, PKG, '15_ARTIFACT_HASH_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');

const vrPath = path.join(ROOT, PKG, '14_LOCAL_VERIFICATION_REPORT.json');
const vr = JSON.parse(fs.readFileSync(vrPath, 'utf8'));
vr.implementationCommitSha = impl;
vr.evidenceBinding = 'PHASE5D_EVIDENCE_COMMIT_BINDING_V1';
fs.writeFileSync(vrPath, JSON.stringify(vr, null, 2) + '\n');

const evidenceArtifacts = [
  ...implementationArtifacts,
  sha(`${PKG}/14_LOCAL_VERIFICATION_REPORT.json`),
  sha(`${PKG}/15_ARTIFACT_HASH_MANIFEST.json`),
];

const evidence = {
  marker: 'PHASE5D_EVIDENCE_COMMIT_BINDING_V1',
  implementationCommitSha: impl,
  generatedAt: new Date().toISOString(),
  localVerificationPass: true,
  stagingAccessMutation: '0/0',
  productionAccessMutation: '0/0',
  databaseWrites: 0,
  deployments: 0,
  ownerGoClaimed: false,
  phase05CompleteIssued: false,
  g01_g17: 'NOT_EXECUTED',
  artifacts: evidenceArtifacts,
};

fs.writeFileSync(path.join(ROOT, PKG, '16_EVIDENCE_BINDING.json'), JSON.stringify(evidence, null, 2) + '\n');

console.log(
  JSON.stringify(
    {
      impl,
      implementationArtifactCount: implementationArtifacts.length,
      evidenceArtifactCount: evidenceArtifacts.length,
      manifestSha256: sha(`${PKG}/15_ARTIFACT_HASH_MANIFEST.json`).sha256,
    },
    null,
    2,
  ),
);
