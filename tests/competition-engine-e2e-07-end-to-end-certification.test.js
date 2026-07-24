/**
 * E2E-07 — End-to-End Certification targeted tests.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CERTIFICATION_STAGE,
  CERTIFICATION_VERDICT,
  COMPETITION_ENGINE_END_TO_END_CERTIFICATION,
  buildCertificationSections,
  buildCapabilityTraceability,
  computeCertificationFingerprint,
  createCompetitionEndToEndCertificationHarness,
  createIndividualPoolKnockoutScenarioFixture,
  runCompetitionEndToEndCertification,
  runFailClosedCertification,
  runGovernanceCertification,
  runHappyPathCertification,
  runPublicPrivacyCertification,
  runRecoveryReplayCertification,
  runStructuralCertification,
  runSuspensionCancellationArchiveCertification,
  snapshotInput,
} from "../src/features/competition-engine/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CERT_DIR = path.join(ROOT, "src/features/competition-engine/certification");

test("marker — end-to-end certification metadata", () => {
  assert.equal(COMPETITION_ENGINE_END_TO_END_CERTIFICATION.phase, "E2E-07");
  assert.equal(
    COMPETITION_ENGINE_END_TO_END_CERTIFICATION.wiredToProductionRuntime,
    false
  );
  assert.equal(COMPETITION_ENGINE_END_TO_END_CERTIFICATION.ownsEngines, false);
});

test("structural — exports, markers, architecture bans", () => {
  const result = runStructuralCertification();
  assert.equal(result.ok, true);
  assert.ok(result.fingerprint.startsWith("e2e07:"));
  assert.ok(result.checks.length >= 8);
});

test("happy path — 27 stages + deterministic fingerprint", async () => {
  const a = await runHappyPathCertification();
  const b = await runHappyPathCertification();
  assert.equal(a.ok, true, JSON.stringify(a.blockers));
  assert.equal(a.stages.length, 27);
  assert.equal(a.stages[0].stageId, CERTIFICATION_STAGE.PREPARE_OPERATIONS);
  assert.equal(a.stages[a.stages.length - 1].stageId, CERTIFICATION_STAGE.HAPPY_PATH_CLOSURE);
  assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
  assert.equal(a.verdict, CERTIFICATION_VERDICT.CERTIFIED_LOCAL_MVP);
});

test("fail-closed — sample matrix uses frozen public error codes", async () => {
  const result = await runFailClosedCertification();
  assert.equal(result.ok, true);
  assert.ok(result.matrix.length >= 8);
  assert.ok(result.matrix.every((m) => m.expectedCode.startsWith("E2E0")));
});

test("recovery/replay — deterministic repeat + missing seed/checkpoint", async () => {
  const result = await runRecoveryReplayCertification();
  assert.equal(result.ok, true);
  const again = await runRecoveryReplayCertification();
  assert.equal(result.deterministicFingerprint, again.deterministicFingerprint);
});

test("public privacy — unpublished hidden + forbidden keys stripped", async () => {
  const result = await runPublicPrivacyCertification();
  assert.equal(result.ok, true);
  assert.ok(result.checks.some((c) => c.id === "forbidden-keys-absent" && c.ok));
});

test("governance — READY/BLOCKED/DEGRADED + no platform incident claim", async () => {
  const result = await runGovernanceCertification();
  assert.equal(result.ok, true);
});

test("suspension/archive — suspend/resume + archive gates", async () => {
  const result = await runSuspensionCancellationArchiveCertification();
  assert.equal(result.ok, true);
});

test("capability traceability — all E2E-00 codes mapped", () => {
  const result = buildCapabilityTraceability({ gov08Passed: true });
  assert.equal(result.ok, true);
  assert.equal(result.traceability.rows.length, 59);
  assert.ok(result.traceability.summary.total === 59);
});

test("harness — full certification local MVP verdict", async () => {
  const harness = createCompetitionEndToEndCertificationHarness();
  const full = await harness.runFullCertification();
  assert.equal(full.finalVerdict, CERTIFICATION_VERDICT.CERTIFIED_LOCAL_MVP);
  assert.ok(full.deterministicFingerprint.startsWith("e2e07:"));
  assert.ok(full.deferredChecks.length >= 1);
  assert.ok(full.performanceResults?.gatePassed === true);
  assert.ok(full.evidence.happyPath);
  assert.ok(full.evidence.finalManifest);
});

test("entry — runCompetitionEndToEndCertification thin wrapper", async () => {
  const result = await runCompetitionEndToEndCertification();
  assert.equal(result.certificationVersion, "e2e-07-end-to-end-certification-v1");
  assert.ok(Array.isArray(result.stages));
});

test("presentation — certification sections view-model", async () => {
  const full = await runCompetitionEndToEndCertification();
  const sections = buildCertificationSections(full);
  assert.equal(sections.length, 7);
  assert.equal(sections[0].id, "overview");
  assert.equal(sections[sections.length - 1].id, "verdict");
});

test("deterministic evidence — no secrets + generatedAt null default", async () => {
  const harness = createCompetitionEndToEndCertificationHarness();
  const full = await harness.runFullCertification();
  const json = JSON.stringify(full.evidence).toLowerCase();
  assert.equal(json.includes("secret@"), false);
  assert.equal(json.includes("ref@internal"), false);
  assert.equal(full.evidence.structural.generatedAt, null);
});

test("architecture — no supabase / Date.now / Math.random in certification source", () => {
  /** @type {string[]} */
  const files = [];
  /**
   * @param {string} dir
   */
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) files.push(full);
    }
  }
  walk(CERT_DIR);
  assert.ok(files.length > 10);
  const banListFile = path.join(CERT_DIR, "constants.js");
  for (const file of files) {
    if (file === banListFile) continue;
    const src = readFileSync(file, "utf8");
    assert.equal(/@supabase/.test(src), false, file);
    assert.equal(/Date\.now\s*\(/.test(src), false, file);
    assert.equal(/Math\.random\s*\(/.test(src), false, file);
    assert.equal(/randomUUID\s*\(/.test(src), false, file);
  }
});

test("fixture — deterministic ids + immutability", () => {
  const fixture = createIndividualPoolKnockoutScenarioFixture();
  const before = snapshotInput(fixture);
  assert.equal(fixture.certificationId, "cert-e2e07-ind-pool-ko-v1");
  assert.equal(fixture.templateId, "ce-e2e02-individual-pool-knockout");
  assert.equal(fixture.players.length, 8);
  assert.deepEqual(snapshotInput(fixture), before);
  assert.equal(
    computeCertificationFingerprint(fixture),
    computeCertificationFingerprint(createIndividualPoolKnockoutScenarioFixture())
  );
});
