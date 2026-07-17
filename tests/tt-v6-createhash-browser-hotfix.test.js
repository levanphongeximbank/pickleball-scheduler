import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

import fixture from "../src/features/team-tournament/canonical/teamTournamentCanonicalVectors.fixture.json" with { type: "json" };
import {
  hashUtf8Sha256Sync,
} from "../src/features/team-tournament/canonical/teamTournamentCanonicalDigest.js";
import {
  hashTeamTournamentCanonicalValue,
  stableStringifyTeamTournamentValue,
} from "../src/features/team-tournament/repositories/teamTournamentCanonical.js";
import { annotateShowcaseSessionEngineHashes } from "../src/features/team-tournament/setup/buildShowcasePreviewHashes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function withBrowserRuntimePolyfill(run) {
  const originalWindow = globalThis.window;
  const versions = process.versions;
  const originalNode = versions.node;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
    writable: true,
  });
  Object.defineProperty(versions, "node", {
    configurable: true,
    get: () => "24.0.0",
  });
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: webcrypto,
      writable: true,
    });
  }
  try {
    return await run();
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
        writable: true,
      });
    }
    Object.defineProperty(versions, "node", {
      configurable: true,
      value: originalNode,
      writable: true,
    });
  }
}

describe("createHash browser hotfix", () => {
  it("legacy + digest modules do not import node:crypto", () => {
    for (const rel of [
      "src/features/team-tournament/canonical/teamTournamentCanonicalDigest.js",
      "src/features/team-tournament/canonical/teamTournamentCanonicalLegacy.js",
    ]) {
      const src = readFileSync(path.join(ROOT, rel), "utf8");
      assert.equal(src.includes('from "node:crypto"'), false, rel);
      assert.equal(src.includes("from 'node:crypto'"), false, rel);
      assert.equal(/\bcreateHash\s*\(/.test(src), false, rel);
    }
  });

  it("sync hash helper runs in browser runtime without Node crypto", () => {
    withBrowserRuntimePolyfill(() => {
      const text = stableStringifyTeamTournamentValue({ a: 1, b: 2, nested: { x: 1, y: 2 } });
      const hash = hashUtf8Sha256Sync(text);
      assert.match(hash, /^[a-f0-9]{64}$/);
      assert.equal(hash, hashUtf8Sha256Sync(text));
      const nodeRef = createHash("sha256").update(text, "utf8").digest("hex");
      assert.equal(hash, nodeRef);
    });
  });

  it("legacy idempotency hash runs in browser runtime without Node crypto", () => {
    withBrowserRuntimePolyfill(() => {
      const payload = { teams: [{ id: "t1", name: "A" }], version: 2 };
      const hash = hashTeamTournamentCanonicalValue(payload);
      assert.match(hash, /^[a-f0-9]{64}$/);
      const nodeRef = createHash("sha256")
        .update(stableStringifyTeamTournamentValue(payload), "utf8")
        .digest("hex");
      assert.equal(hash, nodeRef);
    });
  });

  it("golden vector hashes stay deterministic under browser runtime", () => {
    withBrowserRuntimePolyfill(() => {
      for (const vector of fixture.vectors) {
        if (!vector.expectedHash) continue;
        if (vector.id === "rating-rounding") continue;
        const canonical = vector.expectedCanonical
          || stableStringifyTeamTournamentValue(vector.input);
        assert.equal(hashUtf8Sha256Sync(canonical), vector.expectedHash, vector.id);
      }
    });
  });

  it("showcase engine hash annotation works in browser runtime", async () => {
    await withBrowserRuntimePolyfill(async () => {
      const session = {
        players: [{ id: "p1" }],
        rulesVersion: "rules@v1",
        teamData: { teams: [{ id: "t1", playerIds: ["p1"] }] },
        waitingPlayerIds: [],
      };
      const annotated = await annotateShowcaseSessionEngineHashes(session, {
        selectedPlayerIds: ["p1"],
        teamCount: 1,
        rulesVersion: "rules@v1",
      });
      assert.match(annotated.engineInputHash, /^[a-f0-9]{64}$/);
      assert.match(annotated.engineOutputHash, /^[a-f0-9]{64}$/);
      const again = await annotateShowcaseSessionEngineHashes(session, {
        selectedPlayerIds: ["p1"],
        teamCount: 1,
        rulesVersion: "rules@v1",
      });
      assert.equal(annotated.engineInputHash, again.engineInputHash);
      assert.equal(annotated.engineOutputHash, again.engineOutputHash);
    });
  });
});
