/**
 * CORE-22 Competition Import / Export — Phase 1B canonical contract tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CORE22_ENGINE_ID,
  CORE22_ENGINE_VERSION,
  MANIFEST_VERSION,
  COMPETITION_PACKAGE_SCHEMA_VERSION,
  PACKAGE_TYPE,
  INTEGRITY_ALGORITHM,
  CANONICALIZATION_VERSION,
  CANONICAL_SERIALIZATION_CONTRACT,
  PACKAGE_CHECKSUM_EXCLUDED_FIELDS,
  CHECKSUM_MISMATCH_SEVERITY,
  DEFAULT_REDACTION_PROFILE_ID,
  DEFAULT_AUDIT_SECTION_POLICY,
  DEFAULT_PARTIAL_IMPORT_POLICY,
  COMPATIBILITY_STATUS,
  APPLY_ELIGIBLE_COMPATIBILITY_STATUSES,
  ID_MAPPING_ACTION,
  CONFLICT_TYPE,
  PARTIAL_IMPORT_POLICY,
  REDACTION_PROFILE_ID,
  AUDIT_SECTION_POLICY,
  REDACTION_NO_RELEAK_SURFACES,
  MANIFEST_REQUIRED_FIELDS,
  IMPORT_EXPORT_ERROR_CODE,
  ImportExportError,
  createFatalError,
  createValidationError,
  createCompatibilityError,
  createConflictDiagnostic,
  createWarning,
  createInformationalDiagnostic,
  createCompetitionPackageManifest,
  createCompetitionPackage,
  createApplyPlan,
  createIntegrityMetadata,
  createValidationResult,
  createCompatibilityResult,
  deriveApplyEligible,
  createIdMappingEntry,
  createReferenceMappingEntry,
  createConflictReportEntry,
  createConflictReport,
  createDryRunResult,
  createPartialImportPolicy,
  createDefaultPartialImportPolicy,
  createRedactionProfile,
  createDefaultRedactionProfile,
  assertNoRedactionReleak,
} from "../src/features/competition-core/import-export/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(
  ROOT,
  "src/features/competition-core/import-export"
);

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function sampleManifest(overrides = {}) {
  return createCompetitionPackageManifest({
    packageId: "pkg-core22-sample-1",
    sourceCompetitionId: "comp-1001",
    includedModules: ["workflow", "audit"],
    excludedModules: ["recovery"],
    moduleVersions: { workflow: "1.0.0", audit: "1.0.0" },
    referenceNamespaces: ["competition", "participant"],
    itemCounts: { matches: 2, participants: 8 },
    integrity: {
      contentChecksums: { modules: "deadbeef" },
    },
    ...overrides,
  });
}

describe("CORE-22 Phase 1B — Canonical Import/Export Contracts", () => {
  it("01. constants: versions, package type, integrity algorithm", () => {
    assert.equal(CORE22_ENGINE_ID, "competition-core.import-export");
    assert.equal(CORE22_ENGINE_VERSION, "1.0.0");
    assert.equal(MANIFEST_VERSION, 1);
    assert.equal(
      COMPETITION_PACKAGE_SCHEMA_VERSION,
      "core22.competition-package.v1"
    );
    assert.equal(PACKAGE_TYPE, "PICK_VN_COMPETITION_PACKAGE");
    assert.equal(INTEGRITY_ALGORITHM, "sha256-canonical-json-v1");
    assert.equal(CANONICALIZATION_VERSION, "core22.canonicalization.v1");
    assert.equal(CANONICAL_SERIALIZATION_CONTRACT, "core22.canonical-json.v1");
    assert.equal(CHECKSUM_MISMATCH_SEVERITY, "FATAL");
    assert.equal(DEFAULT_REDACTION_PROFILE_ID, "PORTABLE_SAFE_V1");
    assert.equal(DEFAULT_AUDIT_SECTION_POLICY, "REFERENCES_ONLY");
    assert.equal(DEFAULT_PARTIAL_IMPORT_POLICY, "ALL_OR_NOTHING");
    assert.deepEqual([...PACKAGE_CHECKSUM_EXCLUDED_FIELDS], [
      "packageChecksum",
      "packageId",
      "volatileTransportMetadata",
    ]);
  });

  it("02. required manifest fields accepted; optional fields optional", () => {
    const m = sampleManifest({
      sourceSystem: "PICK_VN",
      sourceSystemVersion: "5.3.36",
      ruleSetVersions: { "core-01": "1.0.0" },
      algorithmVersions: { "core-21": "1.0.0" },
    });
    for (const field of MANIFEST_REQUIRED_FIELDS) {
      assert.ok(field in m, `missing required field ${field}`);
    }
    assert.equal(m.manifestVersion, 1);
    assert.equal(m.packageType, PACKAGE_TYPE);
    assert.equal(m.schemaVersion, COMPETITION_PACKAGE_SCHEMA_VERSION);
    assert.equal(m.redactionProfile.profileId, REDACTION_PROFILE_ID.PORTABLE_SAFE_V1);
    assert.equal(m.integrity.algorithm, INTEGRITY_ALGORITHM);
    assert.equal(m.integrity.checksumAfterRedaction, true);
    assert.equal(m.integrity.checksumMismatchSeverity, "FATAL");
    assert.ok(!("packageVersion" in m));
  });

  it("03. invalid manifest rejection", () => {
    assert.throws(
      () => createCompetitionPackageManifest({}),
      (err) =>
        err instanceof ImportExportError &&
        err.code === IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST
    );
    assert.throws(
      () =>
        sampleManifest({
          packageId: "x",
          exportedAt: "2026-01-01T00:00:00Z",
        }),
      (err) => err.code === IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST
    );
    assert.throws(
      () => sampleManifest({ packageVersion: "1.0.0" }),
      (err) =>
        err.code === IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_SCHEMA_VERSION
    );
  });

  it("04. schema/version validation", () => {
    assert.throws(
      () => sampleManifest({ manifestVersion: 99 }),
      (err) =>
        err.code === IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_MANIFEST_VERSION
    );
    assert.throws(
      () => sampleManifest({ schemaVersion: "other.v0" }),
      (err) =>
        err.code === IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_SCHEMA_VERSION
    );
    assert.throws(
      () => sampleManifest({ packageType: "OTHER" }),
      (err) => err.code === IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE
    );
    const pkg = createCompetitionPackage({
      manifest: sampleManifest(),
      modules: { workflow: { steps: [] } },
    });
    assert.equal(pkg.packageType, PACKAGE_TYPE);
    assert.equal(pkg.applyPlan, null);
    assert.equal(createApplyPlan({}).mutationExecutable, false);
  });

  it("05. compatibility statuses + applyEligible consistency", () => {
    for (const status of Object.values(COMPATIBILITY_STATUS)) {
      const eligible = APPLY_ELIGIBLE_COMPATIBILITY_STATUSES.has(status);
      const base = {
        status,
        applyEligible: eligible,
        reasons: status === COMPATIBILITY_STATUS.MISSING_DEPENDENCY
          ? ["missing core-01"]
          : [],
        requiredAdapters:
          status === COMPATIBILITY_STATUS.REQUIRES_ADAPTER
            ? ["adapter.x"]
            : [],
      };
      const result = createCompatibilityResult(base);
      assert.equal(result.applyEligible, deriveApplyEligible(status));
      assert.throws(
        () =>
          createCompatibilityResult({
            ...base,
            applyEligible: !eligible,
          }),
        (err) => err.code === IMPORT_EXPORT_ERROR_CODE.INCOMPATIBLE_PACKAGE
      );
    }
  });

  it("06. ID mapping actions", () => {
    for (const action of Object.values(ID_MAPPING_ACTION)) {
      const needsTarget =
        action === ID_MAPPING_ACTION.PRESERVE ||
        action === ID_MAPPING_ACTION.REMAP ||
        action === ID_MAPPING_ACTION.REUSE_EXISTING;
      const entry = createIdMappingEntry({
        sourceNamespace: "competition",
        sourceId: "s1",
        entityType: "match",
        action,
        targetNamespace: needsTarget || action === ID_MAPPING_ACTION.CREATE_NEW
          ? "competition"
          : null,
        targetId: needsTarget ? "t1" : null,
      });
      assert.equal(entry.action, action);
    }
    assert.throws(
      () =>
        createIdMappingEntry({
          sourceNamespace: "n",
          sourceId: "s",
          entityType: "match",
          action: ID_MAPPING_ACTION.PRESERVE,
        }),
      (err) => err.code === IMPORT_EXPORT_ERROR_CODE.UNRESOLVED_REFERENCE
    );
    const ref = createReferenceMappingEntry({
      sourceNamespace: "audit",
      sourceReference: "evt:1",
      action: ID_MAPPING_ACTION.EXTERNAL_REFERENCE,
    });
    assert.equal(ref.action, ID_MAPPING_ACTION.EXTERNAL_REFERENCE);
  });

  it("07. conflict blocksApply behavior; no silent overwrite", () => {
    const integrity = createConflictReportEntry({
      conflictId: "c-integrity",
      conflictType: CONFLICT_TYPE.INTEGRITY_FAILURE,
      explanation: "checksum mismatch",
    });
    assert.equal(integrity.severity, "FATAL");
    assert.equal(integrity.blocksApply, true);

    assert.throws(
      () =>
        createConflictReportEntry({
          conflictId: "c-bad",
          conflictType: CONFLICT_TYPE.INTEGRITY_FAILURE,
          blocksApply: false,
        }),
      (err) =>
        err.code === IMPORT_EXPORT_ERROR_CODE.APPLY_PRECONDITION_FAILED
    );

    assert.throws(
      () =>
        createConflictReportEntry({
          conflictId: "c-silent",
          conflictType: CONFLICT_TYPE.EXISTING_TARGET,
          resolutionOptions: ["SILENT_OVERWRITE"],
        }),
      (err) =>
        err.code === IMPORT_EXPORT_ERROR_CODE.APPLY_PRECONDITION_FAILED
    );

    const report = createConflictReport({
      conflicts: [
        {
          conflictId: "c1",
          conflictType: CONFLICT_TYPE.DUPLICATE_ENTITY,
          entityType: "match",
          sourceReference: "src:1",
          targetReference: "tgt:1",
        },
      ],
    });
    assert.equal(report.applyBlocked, true);
    assert.equal(report.silentOverwritePermitted, false);
  });

  it("08. default ALL_OR_NOTHING policy; selected-module dependency declarations", () => {
    const def = createDefaultPartialImportPolicy();
    assert.equal(def.policy, PARTIAL_IMPORT_POLICY.ALL_OR_NOTHING);
    assert.equal(def.entityScopedSupported, false);
    assert.equal(def.bestEffortSupported, false);

    assert.throws(
      () => createPartialImportPolicy({ entityScoped: true }),
      (err) => err.code === IMPORT_EXPORT_ERROR_CODE.PARTIAL_IMPORT_DENIED
    );

    const selected = createPartialImportPolicy({
      policy: PARTIAL_IMPORT_POLICY.SELECTED_MODULES,
      selectedModules: ["scoring"],
      dependencyClosure: ["scoring", "matches"],
      omittedModules: ["recovery"],
    });
    assert.equal(selected.requiresDependencyClosure, true);
    assert.deepEqual([...selected.selectedModules], ["scoring"]);
    assert.ok(selected.dependencyClosure.includes("matches"));

    assert.throws(
      () =>
        createPartialImportPolicy({
          policy: PARTIAL_IMPORT_POLICY.SELECTED_MODULES,
          selectedModules: ["scoring"],
          dependencyClosure: ["matches"],
        }),
      (err) => err.code === IMPORT_EXPORT_ERROR_CODE.PARTIAL_IMPORT_DENIED
    );
  });

  it("09. redaction profile contract + no re-leak guard", () => {
    const profile = createDefaultRedactionProfile();
    assert.equal(profile.profileId, "PORTABLE_SAFE_V1");
    assert.equal(profile.auditSectionPolicy, AUDIT_SECTION_POLICY.REFERENCES_ONLY);
    assert.equal(profile.allowsPiiExtraction, false);
    for (const surface of REDACTION_NO_RELEAK_SURFACES) {
      assert.ok(profile.noReleakSurfaces.includes(surface));
    }
    assert.throws(
      () =>
        assertNoRedactionReleak(
          { message: "secret-phone-555" },
          ["secret-phone-555"],
          "errors"
        ),
      (err) => err.code === IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION
    );
    assert.doesNotThrow(() =>
      assertNoRedactionReleak({ message: "ok" }, ["secret-phone-555"], "warnings")
    );
    assert.throws(
      () => createRedactionProfile({ profileId: "UNKNOWN" }),
      (err) => err.code === IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION
    );
  });

  it("10. dry-run contract; no parse/apply flags", () => {
    const dry = createDryRunResult({
      packageFingerprint: "pkg-fp-1",
      targetRevisionFingerprint: "tgt-fp-1",
      importPlanFingerprint: "plan-fp-1",
      validationResult: { status: "VALID" },
      compatibilityResult: {
        status: COMPATIBILITY_STATUS.COMPATIBLE,
        applyEligible: true,
      },
      idMappings: [
        {
          sourceNamespace: "competition",
          sourceId: "m1",
          entityType: "match",
          action: ID_MAPPING_ACTION.PRESERVE,
          targetNamespace: "competition",
          targetId: "m1",
        },
      ],
      referenceMappings: [
        {
          sourceNamespace: "audit",
          sourceReference: "evt:1",
          action: ID_MAPPING_ACTION.EXTERNAL_REFERENCE,
        },
      ],
      selectedModules: ["workflow"],
      itemCounts: { matches: 1 },
    });
    assert.equal(dry.applyEligible, true);
    assert.equal(dry.mutationApplied, false);
    assert.equal(dry.parsingExecuted, false);
    assert.equal(dry.idMappings.length, 1);
    assert.equal(dry.referenceMappings.length, 1);

    assert.throws(
      () =>
        createDryRunResult({
          packageFingerprint: "a",
          targetRevisionFingerprint: "b",
          importPlanFingerprint: "c",
          validationResult: { status: "INVALID", errors: [] },
        }),
      (err) => err.code === IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE
    );
  });

  it("11. immutable returned values", () => {
    const m = sampleManifest();
    assert.throws(() => {
      m.packageId = "mutated";
    });
    assert.throws(() => {
      m.includedModules.push("x");
    });
    const integrity = createIntegrityMetadata({
      contentChecksums: { a: "1" },
    });
    assert.throws(() => {
      integrity.contentChecksums.a = "2";
    });
    const compat = createCompatibilityResult({
      status: COMPATIBILITY_STATUS.COMPATIBLE,
      applyEligible: true,
    });
    assert.throws(() => {
      compat.reasons.push("x");
    });
  });

  it("12. typed error codes + diagnostic constructors", () => {
    const required = [
      "INVALID_PACKAGE",
      "MALFORMED_MANIFEST",
      "UNSUPPORTED_MANIFEST_VERSION",
      "UNSUPPORTED_SCHEMA_VERSION",
      "UNSUPPORTED_MODULE_VERSION",
      "CHECKSUM_MISMATCH",
      "INCOMPATIBLE_PACKAGE",
      "MISSING_DEPENDENCY",
      "UNRESOLVED_REFERENCE",
      "DUPLICATE_ID",
      "TARGET_CONFLICT",
      "REDACTION_VIOLATION",
      "PARTIAL_IMPORT_DENIED",
      "DRY_RUN_REQUIRED",
      "APPLY_PRECONDITION_FAILED",
      "SERIALIZATION_FAILURE",
      "DESERIALIZATION_FAILURE",
    ];
    for (const code of required) {
      assert.equal(IMPORT_EXPORT_ERROR_CODE[code], code);
    }
    assert.equal(
      createFatalError({ code: "CHECKSUM_MISMATCH", message: "bad" }).kind,
      "FATAL_ERROR"
    );
    assert.equal(
      createValidationError({ code: "MALFORMED_MANIFEST", message: "bad" })
        .kind,
      "VALIDATION_ERROR"
    );
    assert.equal(
      createCompatibilityError({
        code: "INCOMPATIBLE_PACKAGE",
        message: "bad",
      }).kind,
      "COMPATIBILITY_ERROR"
    );
    assert.equal(
      createConflictDiagnostic({ code: "TARGET_CONFLICT", message: "bad" })
        .kind,
      "CONFLICT"
    );
    assert.equal(
      createWarning({ code: "W1", message: "warn" }).kind,
      "WARNING"
    );
    assert.equal(
      createInformationalDiagnostic({ code: "I1", message: "info" }).kind,
      "INFO"
    );
  });

  it("13. absence of timestamps/random values in module sources", () => {
    const files = listJsFiles(MODULE_ROOT);
    assert.ok(files.length > 0);
    const forbidden = [
      "Date.now(",
      "Math.random(",
      "crypto.randomUUID(",
      "new Date(",
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const token of forbidden) {
        assert.ok(
          !src.includes(token),
          `${path.relative(ROOT, file)} must not contain ${token}`
        );
      }
    }
  });

  it("14. validation result consistency", () => {
    const valid = createValidationResult({ status: "VALID" });
    assert.equal(valid.valid, true);
    assert.throws(
      () =>
        createValidationResult({
          status: "VALID",
          errors: [{ code: "X", message: "nope" }],
        }),
      (err) => err.code === IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE
    );
    const invalid = createValidationResult({
      status: "INVALID",
      errors: [{ code: "MALFORMED_MANIFEST", message: "bad" }],
    });
    assert.equal(invalid.valid, false);
  });

  it("15. scope: no private CORE-19/20/21 imports; public barrels allowed", () => {
    const files = listJsFiles(MODULE_ROOT);
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Reject deep private imports; allow capability public barrels (.../index.js).
      const privateImport =
        /from\s+["'][^"']*\/(workflow|audit|deterministic-seed-replay)\/(?!index\.js["'])[^"']*["']/.test(
          src
        );
      assert.ok(
        !privateImport,
        `${path.relative(ROOT, file)} must not import CORE-19/20/21 private internals`
      );
    }
    assert.ok(!existsSync(path.join(MODULE_ROOT, "apply")));
  });
});
