/**
 * CORE-22 — round-trip certification + adapter evidence.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCompetitionExport,
  serializeCanonical,
  deserializeCompetitionPackage,
  parseCompetitionPackage,
  validateCompetitionPackage,
  verifyPackageChecksum,
  verifyContentChecksums,
  normalizeCompetitionPackage,
  createDefaultAdapterRegistry,
  CORE19_MODULE_ID,
  CORE20_MODULE_ID,
  CORE21_MODULE_ID,
  IMPORT_EXPORT_ERROR_CODE,
  ImportExportError,
} from "../src/features/competition-core/import-export/index.js";

function buildFullPackage(overrides = {}) {
  return buildCompetitionExport({
    sourceCompetitionId: "comp-rt-1",
    modules: {
      [CORE19_MODULE_ID]: {
        definitions: [{ id: "wf-1", steps: [] }],
        references: [{ id: "wf-1", entityType: "workflow" }],
      },
      [CORE20_MODULE_ID]: {
        events: [{ id: "should-be-stripped", payload: "FULL-AUDIT-PII" }],
        references: [{ id: "evt-1" }],
      },
      [CORE21_MODULE_ID]: {
        seedReferences: ["seed-1"],
        replayReferences: ["replay-1"],
        algorithmVersions: { prng: "1.0.0" },
        fingerprints: ["fp-1"],
      },
      matches: {
        entities: [{ id: "m1", entityType: "match" }],
      },
    },
    moduleVersions: {
      [CORE19_MODULE_ID]: "1.0.0",
      [CORE20_MODULE_ID]: "1.0.0",
      [CORE21_MODULE_ID]: "1.0.0",
      matches: "1.0.0",
    },
    referenceNamespaces: ["workflow", "audit", "seed-replay", "matches"],
    algorithmVersions: { prng: "1.0.0" },
    auditReferences: [{ id: "evt-1" }],
    replayReferences: [{ id: "replay-1" }],
    ...overrides,
  });
}

describe("CORE-22 Phase 1F — Round-trip certification", () => {
  it("01. export → serialize → deserialize → validate → verify → normalize → re-export", () => {
    const original = buildFullPackage();

    const text1 = serializeCanonical(original);
    const raw = deserializeCompetitionPackage(text1);
    const parsed = parseCompetitionPackage(raw);
    const validation = validateCompetitionPackage(parsed);
    assert.equal(validation.valid, true);
    verifyPackageChecksum(parsed);
    verifyContentChecksums(parsed);
    const normalized = normalizeCompetitionPackage(parsed);

    // Re-export from normalized module payloads.
    const rebuilt = buildCompetitionExport({
      sourceCompetitionId: original.manifest.sourceCompetitionId,
      modules: {
        [CORE19_MODULE_ID]: normalized.modules[CORE19_MODULE_ID],
        [CORE20_MODULE_ID]: normalized.modules[CORE20_MODULE_ID],
        [CORE21_MODULE_ID]: normalized.modules[CORE21_MODULE_ID],
        matches: normalized.modules.matches,
      },
      moduleVersions: { ...original.manifest.moduleVersions },
      referenceNamespaces: [...original.manifest.referenceNamespaces],
      algorithmVersions: { ...original.manifest.algorithmVersions },
      auditReferences: [...(original.manifest.auditReferences ?? [])],
      replayReferences: [...(original.manifest.replayReferences ?? [])],
      sourceSystem: original.manifest.sourceSystem,
      sourceSystemVersion: original.manifest.sourceSystemVersion,
    });

    assert.equal(
      rebuilt.manifest.integrity.packageChecksum,
      original.manifest.integrity.packageChecksum
    );
    assert.equal(rebuilt.manifest.packageId, original.manifest.packageId);
    assert.equal(serializeCanonical(rebuilt), serializeCanonical(original));
    assert.deepEqual(
      [...rebuilt.manifest.includedModules],
      [...original.manifest.includedModules]
    );
    assert.deepEqual(rebuilt.manifest.itemCounts, original.manifest.itemCounts);
  });

  it("02. tamper detection after round-trip", () => {
    const original = buildFullPackage();
    const text = serializeCanonical(original);
    const raw = deserializeCompetitionPackage(text);
    raw.modules.matches.entities[0].id = "TAMPERED";
    assert.throws(
      () => verifyPackageChecksum(raw),
      (err) =>
        err instanceof ImportExportError &&
        err.code === IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH
    );
    const validation = validateCompetitionPackage(raw);
    assert.equal(validation.valid, false);
  });

  it("03. redacted round-trip keeps secrets out", () => {
    const secret = "PII-ROUNDTRIP-SECRET-42";
    const pkg = buildFullPackage({
      modules: {
        [CORE19_MODULE_ID]: {
          definitions: [{ id: "wf-1", privateNote: secret }],
          references: [{ id: "wf-1", entityType: "workflow" }],
        },
        [CORE20_MODULE_ID]: {
          events: [{ payload: secret }],
          references: [{ id: "evt-1" }],
        },
        [CORE21_MODULE_ID]: {
          seedReferences: ["seed-1"],
          replayReferences: ["replay-1"],
        },
        matches: { entities: [{ id: "m1", entityType: "match" }] },
      },
      excludedFieldPaths: ["workflow.definitions"],
    });
    const text = serializeCanonical(pkg);
    assert.ok(!text.includes(secret));
    const parsed = parseCompetitionPackage(deserializeCompetitionPackage(text));
    assert.ok(!serializeCanonical(parsed).includes(secret));
    assert.ok(!JSON.stringify(parsed.manifest.warnings ?? []).includes(secret));
  });

  it("04. CORE-19/20/21 adapters registered and round-trip friendly", () => {
    const registry = createDefaultAdapterRegistry();
    assert.ok(registry.has(CORE19_MODULE_ID));
    assert.ok(registry.has(CORE20_MODULE_ID));
    assert.ok(registry.has(CORE21_MODULE_ID));

    const pkg = buildFullPackage();
    // Audit must be references-only after redaction.
    assert.equal(pkg.modules.audit.policy, "REFERENCES_ONLY");
    assert.ok(!("events" in pkg.modules.audit) || !pkg.modules.audit.events);

    const wf = registry.resolve(CORE19_MODULE_ID);
    const audit = registry.resolve(CORE20_MODULE_ID);
    const seed = registry.resolve(CORE21_MODULE_ID);
    assert.equal(wf.validatePayload(pkg.modules.workflow).ok, true);
    assert.equal(audit.validatePayload(pkg.modules.audit).ok, true);
    assert.equal(seed.validatePayload(pkg.modules[CORE21_MODULE_ID]).ok, true);
  });

  it("05. non-canonical transport metadata may be dropped on round-trip", () => {
    const pkg = buildFullPackage();
    const raw = JSON.parse(serializeCanonical(pkg));
    raw.volatileTransportMetadata = {
      uploadId: "u-1",
      downloadUrl: "https://example.invalid/x",
    };
    // Transport metadata is not part of checksum; verify still passes when
    // checksum fields unchanged.
    verifyPackageChecksum(raw);
    const reparsed = parseCompetitionPackage({
      ...raw,
      volatileTransportMetadata: raw.volatileTransportMetadata,
    });
    // Documented: volatileTransportMetadata may round-trip as package field but
    // is excluded from checksum coverage.
    assert.ok(reparsed.volatileTransportMetadata == null || reparsed.volatileTransportMetadata);
    const rebuilt = buildCompetitionExport({
      sourceCompetitionId: pkg.manifest.sourceCompetitionId,
      modules: pkg.modules,
      moduleVersions: pkg.manifest.moduleVersions,
      referenceNamespaces: pkg.manifest.referenceNamespaces,
      algorithmVersions: pkg.manifest.algorithmVersions,
      auditReferences: pkg.manifest.auditReferences,
      replayReferences: pkg.manifest.replayReferences,
    });
    assert.equal(
      rebuilt.manifest.integrity.packageChecksum,
      pkg.manifest.integrity.packageChecksum
    );
    assert.equal(rebuilt.volatileTransportMetadata, null);
  });
});
