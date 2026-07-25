/**
 * TEST-HYGIENE-01 — Staging evidence isolation.
 * Proves override env redirects evidence writes away from tracked docs paths.
 * No Staging/Production apply. No database writes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import {
  PICK_VN_STAGING_EVIDENCE_DIR_ENV,
  resolveStagingEvidenceDir,
} from "../scripts/shared/resolve-staging-evidence-dir.mjs";
import { COACHING_03_EVIDENCE_DIR } from "../src/features/coaching/staging/index.js";
import { PM_ID_01_EVIDENCE_DIR } from "../scripts/player-management/pm-id-01-activation-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const COACHING_TRACKED = path.join(
  root,
  COACHING_03_EVIDENCE_DIR,
  "APPLY_REFUSED.json"
);
const PM_TRACKED = path.join(
  root,
  PM_ID_01_EVIDENCE_DIR,
  "APPLY_REFUSED_NO_GO.json"
);

function sha256FileOrNull(absPath) {
  if (!existsSync(absPath)) return null;
  return createHash("sha256").update(readFileSync(absPath)).digest("hex");
}

function withTempDir(prefix, fn) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return fn(tempDir);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function spawnApply(scriptRel, tempEvidenceDir) {
  return spawnSync(process.execPath, [scriptRel], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      [PICK_VN_STAGING_EVIDENCE_DIR_ENV]: tempEvidenceDir,
    },
  });
}

test("resolver: unset / empty / whitespace → canonical coaching path", () => {
  const canonical = path.join(root, COACHING_03_EVIDENCE_DIR);
  assert.equal(
    resolveStagingEvidenceDir({
      repoRoot: root,
      canonicalRelativeDir: COACHING_03_EVIDENCE_DIR,
      env: {},
    }),
    canonical
  );
  assert.equal(
    resolveStagingEvidenceDir({
      repoRoot: root,
      canonicalRelativeDir: COACHING_03_EVIDENCE_DIR,
      env: { [PICK_VN_STAGING_EVIDENCE_DIR_ENV]: "" },
    }),
    canonical
  );
  assert.equal(
    resolveStagingEvidenceDir({
      repoRoot: root,
      canonicalRelativeDir: COACHING_03_EVIDENCE_DIR,
      env: { [PICK_VN_STAGING_EVIDENCE_DIR_ENV]: "   \t  " },
    }),
    canonical
  );
});

test("resolver: unset → canonical PM-ID-01 path", () => {
  assert.equal(
    resolveStagingEvidenceDir({
      repoRoot: root,
      canonicalRelativeDir: PM_ID_01_EVIDENCE_DIR,
      env: {},
    }),
    path.join(root, PM_ID_01_EVIDENCE_DIR)
  );
});

test("resolver: absolute override used as-is (normalized)", () => {
  const abs = path.join(os.tmpdir(), "pick-vn-evidence-abs");
  const resolved = resolveStagingEvidenceDir({
    repoRoot: root,
    canonicalRelativeDir: COACHING_03_EVIDENCE_DIR,
    env: { [PICK_VN_STAGING_EVIDENCE_DIR_ENV]: abs },
  });
  assert.equal(resolved, path.normalize(abs));
  assert.notEqual(resolved, path.join(root, COACHING_03_EVIDENCE_DIR));
});

test("resolver: relative override resolves against cwd", () => {
  withTempDir("pick-vn-cwd-", (cwdDir) => {
    const resolved = resolveStagingEvidenceDir({
      repoRoot: root,
      canonicalRelativeDir: COACHING_03_EVIDENCE_DIR,
      env: { [PICK_VN_STAGING_EVIDENCE_DIR_ENV]: "evidence-out" },
      cwd: cwdDir,
    });
    assert.equal(resolved, path.resolve(cwdDir, "evidence-out"));
  });
});

test("resolver: requires repoRoot and canonicalRelativeDir", () => {
  assert.throws(() =>
    resolveStagingEvidenceDir({
      repoRoot: "",
      canonicalRelativeDir: COACHING_03_EVIDENCE_DIR,
    })
  );
  assert.throws(() =>
    resolveStagingEvidenceDir({
      repoRoot: root,
      canonicalRelativeDir: "",
    })
  );
});

test("coaching-03 apply with override writes temp APPLY_REFUSED.json only", () => {
  const beforeHash = sha256FileOrNull(COACHING_TRACKED);
  withTempDir("hygiene01-coaching-", (tempDir) => {
    const result = spawnApply(
      "scripts/coaching/coaching-03-staging-apply.mjs",
      tempDir
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /APPLY_MODE=REFUSED/);

    const evidencePath = path.join(tempDir, "APPLY_REFUSED.json");
    assert.equal(existsSync(evidencePath), true);
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    assert.equal(evidence.phase, "COACHING-03");
    assert.equal(evidence.APPLY_MODE, "REFUSED");
    assert.equal(evidence.sqlApplied, false);
    assert.equal(evidence.databaseWrites, 0);
    assert.equal(evidence.stagingConnected, false);
    assert.equal(evidence.productionConnected, false);
  });
  assert.equal(sha256FileOrNull(COACHING_TRACKED), beforeHash);
});

test("pm-id-01 apply with override writes temp APPLY_REFUSED_NO_GO.json only", () => {
  const beforeHash = sha256FileOrNull(PM_TRACKED);
  withTempDir("hygiene01-pmid-", (tempDir) => {
    const result = spawnApply(
      "scripts/player-management/pm-id-01-staging-apply.mjs",
      tempDir
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /APPLY_MODE=REFUSED/);
    assert.match(
      result.stdout,
      /PM_ID_01_APPLY_REFUSED_OWNER_GO_NOT_GRANTED/
    );

    const evidencePath = path.join(tempDir, "APPLY_REFUSED_NO_GO.json");
    assert.equal(existsSync(evidencePath), true);
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    assert.equal(evidence.ownerGoGranted, false);
    assert.equal(evidence.databaseConnectionOpened, false);
    assert.equal(evidence.databaseWrites, 0);
    assert.equal(evidence.sqlApplied, false);
    assert.equal(evidence.productionTouched, false);
  });
  assert.equal(sha256FileOrNull(PM_TRACKED), beforeHash);
});

test("isolation: independent temp dirs; child env does not leak to parent", () => {
  const parentHad = Object.prototype.hasOwnProperty.call(
    process.env,
    PICK_VN_STAGING_EVIDENCE_DIR_ENV
  );
  const parentValue = process.env[PICK_VN_STAGING_EVIDENCE_DIR_ENV];

  withTempDir("hygiene01-a-", (dirA) => {
    withTempDir("hygiene01-b-", (dirB) => {
      assert.notEqual(dirA, dirB);

      const coaching = spawnApply(
        "scripts/coaching/coaching-03-staging-apply.mjs",
        dirA
      );
      const pmid = spawnApply(
        "scripts/player-management/pm-id-01-staging-apply.mjs",
        dirB
      );
      assert.equal(coaching.status, 0);
      assert.equal(pmid.status, 0);

      assert.equal(existsSync(path.join(dirA, "APPLY_REFUSED.json")), true);
      assert.equal(existsSync(path.join(dirB, "APPLY_REFUSED_NO_GO.json")), true);
      assert.equal(existsSync(path.join(dirA, "APPLY_REFUSED_NO_GO.json")), false);
      assert.equal(existsSync(path.join(dirB, "APPLY_REFUSED.json")), false);
    });
  });

  if (parentHad) {
    assert.equal(process.env[PICK_VN_STAGING_EVIDENCE_DIR_ENV], parentValue);
  } else {
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        process.env,
        PICK_VN_STAGING_EVIDENCE_DIR_ENV
      ),
      false
    );
  }
});

test("cleanup runs when assertion fails (finally)", () => {
  let captured = null;
  let failed = false;
  try {
    withTempDir("hygiene01-cleanup-", (tempDir) => {
      captured = tempDir;
      mkdirSync(tempDir, { recursive: true });
      writeFileSync(path.join(tempDir, "marker.txt"), "x");
      assert.equal(true, false, "forced failure");
    });
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.ok(captured);
  assert.equal(existsSync(captured), false);
});

test("override creates missing directory safely", () => {
  const parent = mkdtempSync(path.join(os.tmpdir(), "hygiene01-mkdir-"));
  const nested = path.join(parent, "nested", "evidence");
  try {
    assert.equal(existsSync(nested), false);
    const result = spawnApply(
      "scripts/coaching/coaching-03-staging-apply.mjs",
      nested
    );
    assert.equal(result.status, 0);
    assert.equal(existsSync(path.join(nested, "APPLY_REFUSED.json")), true);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
