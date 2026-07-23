/**
 * CORE-22 — deterministic export, integrity, redaction tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCompetitionExport,
  serializeCanonical,
  computePackageChecksum,
  buildPackageId,
  verifyPackageChecksum,
  applyRedaction,
  MASK_TOKEN,
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
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

function baseExportInput(overrides = {}) {
  return {
    sourceCompetitionId: "comp-export-1",
    modules: {
      workflow: { definitions: [{ id: "wf-1", steps: [] }] },
      scoring: { entities: [{ id: "s1", entityType: "score" }] },
    },
    moduleVersions: { workflow: "1.0.0", scoring: "1.0.0" },
    referenceNamespaces: ["competition", "participant"],
    sourceSystem: "PICK_VN",
    sourceSystemVersion: "5.3.36",
    ...overrides,
  };
}

describe("CORE-22 Phase 1C — Deterministic export & redaction", () => {
  it("01. insertion-order independence of modules", () => {
    const a = buildCompetitionExport(
      baseExportInput({
        modules: {
          workflow: { definitions: [{ id: "wf-1" }] },
          scoring: { entities: [{ id: "s1" }] },
        },
      })
    );
    const b = buildCompetitionExport(
      baseExportInput({
        modules: {
          scoring: { entities: [{ id: "s1" }] },
          workflow: { definitions: [{ id: "wf-1" }] },
        },
      })
    );
    assert.equal(a.manifest.integrity.packageChecksum, b.manifest.integrity.packageChecksum);
    assert.equal(a.manifest.packageId, b.manifest.packageId);
    assert.equal(serializeCanonical(a), serializeCanonical(b));
  });

  it("02. repeated-build stability", () => {
    const input = baseExportInput();
    const builds = Array.from({ length: 5 }, () => buildCompetitionExport(input));
    for (let i = 1; i < builds.length; i++) {
      assert.equal(
        builds[i].manifest.integrity.packageChecksum,
        builds[0].manifest.integrity.packageChecksum
      );
      assert.equal(serializeCanonical(builds[i]), serializeCanonical(builds[0]));
    }
  });

  it("03. stable package checksum and packageId format", () => {
    const pkg = buildCompetitionExport(baseExportInput());
    const checksum = pkg.manifest.integrity.packageChecksum;
    assert.match(checksum, /^[0-9a-f]{64}$/);
    assert.equal(pkg.manifest.packageId, buildPackageId(checksum));
    assert.match(pkg.manifest.packageId, /^core22pkg:sha256:[0-9a-f]{64}$/);
    assert.equal(computePackageChecksum(pkg), checksum);
    verifyPackageChecksum(pkg);
  });

  it("04. changed payload changes checksum; no circular checksum", () => {
    const a = buildCompetitionExport(baseExportInput());
    const b = buildCompetitionExport(
      baseExportInput({
        modules: {
          workflow: { definitions: [{ id: "wf-CHANGED" }] },
          scoring: { entities: [{ id: "s1", entityType: "score" }] },
        },
      })
    );
    assert.notEqual(
      a.manifest.integrity.packageChecksum,
      b.manifest.integrity.packageChecksum
    );
    // packageId derived from checksum, not included in checksum input.
    assert.notEqual(a.manifest.packageId, a.manifest.integrity.packageChecksum);
  });

  it("05. no clock/random usage in module sources", () => {
    const files = listJsFiles(MODULE_ROOT);
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

  it("06. no input mutation; immutable output", () => {
    const modules = {
      workflow: { definitions: [{ id: "wf-1" }] },
      scoring: { entities: [{ id: "s1" }] },
    };
    const snapshot = serializeCanonical(modules);
    const pkg = buildCompetitionExport(
      baseExportInput({ modules })
    );
    assert.equal(serializeCanonical(modules), snapshot);
    assert.throws(() => {
      pkg.manifest.packageId = "mutated";
    });
    assert.throws(() => {
      pkg.modules.workflow = {};
    });
  });

  it("07. redaction before checksum; excluded values absent; no re-leak", () => {
    const secret = "SECRET-PHONE-555-9999";
    const pkg = buildCompetitionExport(
      baseExportInput({
        modules: {
          workflow: {
            definitions: [{ id: "wf-1", contact: secret }],
          },
          scoring: { entities: [{ id: "s1" }] },
        },
        excludedFieldPaths: ["workflow.definitions"],
        omittedModules: [],
      })
    );
    const text = serializeCanonical(pkg);
    assert.ok(!text.includes(secret));
    for (const w of pkg.manifest.warnings ?? []) {
      assert.ok(!JSON.stringify(w).includes(secret));
    }
    // Checksum after redaction: rebuilding without secret path differs.
    const unredacted = buildCompetitionExport(
      baseExportInput({
        modules: {
          workflow: {
            definitions: [{ id: "wf-1", contact: secret }],
          },
          scoring: { entities: [{ id: "s1" }] },
        },
      })
    );
    assert.notEqual(
      pkg.manifest.integrity.packageChecksum,
      unredacted.manifest.integrity.packageChecksum
    );
  });

  it("08. masked values deterministic; omitted modules deterministic", () => {
    const redacted = applyRedaction({
      modules: {
        scoring: { phone: "111", note: "keep" },
        audit: { events: [{ payload: "PII-FULL" }], references: [{ id: "a1" }] },
      },
      maskedFieldPaths: ["scoring.phone"],
      omittedModules: ["scoring"],
    });
    assert.ok(!("scoring" in redacted.modules));
    assert.equal(redacted.modules.audit.policy, "REFERENCES_ONLY");
    assert.ok(!JSON.stringify(redacted.modules).includes("PII-FULL"));
    assert.equal(redacted.maskToken, MASK_TOKEN);

    const a = buildCompetitionExport(
      baseExportInput({
        omittedModules: ["scoring"],
        modules: {
          workflow: { definitions: [{ id: "wf-1" }] },
          scoring: { entities: [{ id: "s1" }] },
        },
        moduleVersions: { workflow: "1.0.0", scoring: "1.0.0" },
      })
    );
    const b = buildCompetitionExport(
      baseExportInput({
        omittedModules: ["scoring"],
        modules: {
          scoring: { entities: [{ id: "s1" }] },
          workflow: { definitions: [{ id: "wf-1" }] },
        },
        moduleVersions: { scoring: "1.0.0", workflow: "1.0.0" },
      })
    );
    assert.equal(a.manifest.integrity.packageChecksum, b.manifest.integrity.packageChecksum);
    assert.ok(a.manifest.excludedModules.includes("scoring"));
    assert.ok(!("scoring" in a.modules));
  });

  it("09. tamper detection via checksum mismatch", () => {
    const pkg = buildCompetitionExport(baseExportInput());
    const tampered = {
      ...pkg,
      manifest: {
        ...pkg.manifest,
        modules: undefined,
        sourceCompetitionId: "comp-TAMPERED",
        integrity: { ...pkg.manifest.integrity },
      },
      modules: pkg.modules,
    };
    // Rebuild a mutable clone for tamper.
    const raw = JSON.parse(serializeCanonical(pkg));
    raw.modules.workflow.definitions[0].id = "TAMPERED";
    assert.throws(
      () => verifyPackageChecksum(raw),
      (err) =>
        err instanceof ImportExportError &&
        err.code === IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH
    );
    void tampered;
  });
});
