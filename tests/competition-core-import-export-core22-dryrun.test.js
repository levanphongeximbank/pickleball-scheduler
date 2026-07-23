/**
 * CORE-22 — dry-run, partial policy, stale-plan tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCompetitionExport,
  runDryRunImport,
  detectStaleImportPlan,
  createImportPlan,
  PARTIAL_IMPORT_POLICY,
  ADAPTER_REGISTRY_VERSION,
  createDefaultAdapterRegistry,
  sha256Canonical,
} from "../src/features/competition-core/import-export/index.js";

function samplePackage() {
  return buildCompetitionExport({
    sourceCompetitionId: "comp-dry-1",
    modules: {
      workflow: {
        definitions: [{ id: "wf-1" }],
        references: [{ id: "wf-1", entityType: "workflow" }],
      },
      matches: {
        entities: [{ id: "m1", entityType: "match" }],
      },
      scoring: {
        entities: [{ id: "s1", entityType: "score" }],
      },
    },
    moduleVersions: {
      workflow: "1.0.0",
      matches: "1.0.0",
      scoring: "1.0.0",
    },
  });
}

describe("CORE-22 Phase 1E — Dry-run & partial policy", () => {
  it("01. dry-run does not mutate target; deterministic importPlanFingerprint", () => {
    const pkg = samplePackage();
    const targetContext = { revision: "r1", entities: { m1: { id: "m1" } } };
    const before = sha256Canonical(targetContext);

    const a = runDryRunImport({
      package: pkg,
      targetContext,
      targetRevisionFingerprint: "tgt-rev-1",
      adapterRegistry: createDefaultAdapterRegistry(),
    });
    const b = runDryRunImport({
      package: pkg,
      targetContext,
      targetRevisionFingerprint: "tgt-rev-1",
      adapterRegistry: createDefaultAdapterRegistry(),
    });

    assert.equal(sha256Canonical(targetContext), before);
    assert.equal(a.mutationApplied, false);
    assert.equal(a.importPlanFingerprint, b.importPlanFingerprint);
    assert.equal(a.packageFingerprint, b.packageFingerprint);
    assert.ok(Array.isArray(a.selectedModules));
    assert.ok(Array.isArray(a.omittedModules));
    assert.ok(Array.isArray(a.appliedCandidateIds));
    assert.ok(Array.isArray(a.pendingCandidateIds));
    assert.ok(Array.isArray(a.rejectedCandidateIds));
  });

  it("02. stale target revision / selected modules / adapter version", () => {
    const pkg = samplePackage();
    const dry = runDryRunImport({
      package: pkg,
      targetRevisionFingerprint: "tgt-rev-1",
    });
    const plan = dry.importPlan;
    assert.ok(plan);

    const staleTarget = detectStaleImportPlan(plan, {
      packageFingerprint: plan.packageFingerprint,
      targetRevisionFingerprint: "tgt-rev-CHANGED",
      selectedModulesFingerprint: plan.selectedModulesFingerprint,
      adapterRegistryVersion: plan.adapterRegistryVersion,
      policyVersion: plan.policyVersion,
      mappingPlanFingerprint: plan.mappingPlanFingerprint,
    });
    assert.equal(staleTarget.stale, true);
    assert.ok(staleTarget.reasons.some((r) => r.includes("targetRevision")));

    const staleSelected = detectStaleImportPlan(plan, {
      packageFingerprint: plan.packageFingerprint,
      targetRevisionFingerprint: plan.targetRevisionFingerprint,
      selectedModulesFingerprint: "changed-selected",
      adapterRegistryVersion: plan.adapterRegistryVersion,
      policyVersion: plan.policyVersion,
      mappingPlanFingerprint: plan.mappingPlanFingerprint,
    });
    assert.equal(staleSelected.stale, true);

    const staleAdapter = detectStaleImportPlan(plan, {
      packageFingerprint: plan.packageFingerprint,
      targetRevisionFingerprint: plan.targetRevisionFingerprint,
      selectedModulesFingerprint: plan.selectedModulesFingerprint,
      adapterRegistryVersion: "core22.adapter-registry.CHANGED",
      policyVersion: plan.policyVersion,
      mappingPlanFingerprint: plan.mappingPlanFingerprint,
    });
    assert.equal(staleAdapter.stale, true);

    const fresh = detectStaleImportPlan(plan, {
      packageFingerprint: plan.packageFingerprint,
      targetRevisionFingerprint: plan.targetRevisionFingerprint,
      selectedModulesFingerprint: plan.selectedModulesFingerprint,
      adapterRegistryVersion: plan.adapterRegistryVersion,
      policyVersion: plan.policyVersion,
      mappingPlanFingerprint: plan.mappingPlanFingerprint,
    });
    assert.equal(fresh.stale, false);
    assert.equal(ADAPTER_REGISTRY_VERSION, "core22.adapter-registry.v1");
  });

  it("03. ALL_OR_NOTHING rejection on validation/conflict", () => {
    const pkg = samplePackage();
    const raw = JSON.parse(JSON.stringify(pkg));
    raw.modules.workflow.definitions[0].id = "tampered";
    const dry = runDryRunImport({
      package: raw,
      targetRevisionFingerprint: "tgt",
      partialPolicy: { policy: PARTIAL_IMPORT_POLICY.ALL_OR_NOTHING },
    });
    assert.equal(dry.applyEligible, false);
    assert.equal(dry.validationResult.valid, false);
  });

  it("04. SELECTED_MODULES dependency closure enforcement", () => {
    const pkg = samplePackage();
    const dry = runDryRunImport({
      package: pkg,
      targetRevisionFingerprint: "tgt",
      partialPolicy: {
        policy: PARTIAL_IMPORT_POLICY.SELECTED_MODULES,
        selectedModules: ["scoring"],
        dependencyClosure: ["scoring"],
        omittedModules: ["workflow", "matches"],
        moduleDependencies: undefined,
      },
      moduleDependencies: {
        scoring: ["matches"],
      },
    });
    assert.equal(dry.applyEligible, false);
    assert.ok(
      dry.conflicts.some(
        (c) =>
          c.conflictType === "PARTIAL_IMPORT_DENIED" ||
          c.conflictType === "MISSING_DEPENDENCY"
      )
    );

    const closed = runDryRunImport({
      package: pkg,
      targetRevisionFingerprint: "tgt",
      partialPolicy: {
        policy: PARTIAL_IMPORT_POLICY.SELECTED_MODULES,
        selectedModules: ["scoring", "matches"],
        dependencyClosure: ["scoring", "matches"],
        omittedModules: ["workflow"],
      },
      moduleDependencies: {
        scoring: ["matches"],
      },
    });
    assert.ok(closed.selectedModules.includes("scoring"));
    assert.ok(closed.selectedModules.includes("matches"));
    assert.ok(closed.omittedModules.includes("workflow"));
  });

  it("05. createImportPlan CORE-23 handoff fields", () => {
    const plan = createImportPlan({
      packageFingerprint: "p".repeat(64).slice(0, 64),
      targetRevisionFingerprint: "t1",
      selectedModulesFingerprint: "s1",
      mappingPlanFingerprint: "m1",
      conflictReportFingerprint: "c1",
      applyEligible: false,
    });
    assert.equal(plan.checkpointPersisted, false);
    assert.equal(plan.resumeToken, null);
    assert.equal(plan.recoveryExecutable, false);
    assert.ok(plan.importPlanFingerprint);
  });
});
