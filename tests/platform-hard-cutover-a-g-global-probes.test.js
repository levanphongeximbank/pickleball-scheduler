import test from "node:test";
import assert from "node:assert/strict";

import {
  probeOneCanonicalWriterPerDomain,
  probeNoLegacyWriter,
  probeNoLocalStorageAuthority,
  probeNoMockPersistence,
  probeNoSilentFallback,
  probeNoHybridRuntime,
  runOperatorAcceptanceGlobalProbes,
  GLOBAL_PROBE_CODE,
} from "../src/features/platform-hard-cutover/operatorAcceptanceGlobalProbes.js";

const HC_ON = {
  VITE_PLATFORM_HARD_CUTOVER_ENABLED: "true",
  VITE_COMPETITION_REMOTE_SSOT_ENABLED: "true",
};

const HC_OFF = {
  VITE_PLATFORM_HARD_CUTOVER_ENABLED: "false",
  VITE_COMPETITION_REMOTE_SSOT_ENABLED: "false",
};

test("A-G probes fail closed when hard cutover is off", () => {
  const probes = runOperatorAcceptanceGlobalProbes(HC_OFF);
  assert.equal(probes.length, 6);
  for (const probe of probes) {
    assert.equal(probe.status, "FAIL", probe.id);
    assert.equal(probe.code, GLOBAL_PROBE_CODE.HARD_CUTOVER_REQUIRED, probe.id);
  }
});

test("A-G1..G6 pass under hard cutover + competition SSOT using matrix/policy evidence", () => {
  assert.equal(probeOneCanonicalWriterPerDomain(HC_ON).status, "PASS");
  assert.equal(probeNoLegacyWriter(HC_ON).status, "PASS");
  assert.equal(probeNoLocalStorageAuthority(HC_ON).status, "PASS");
  assert.equal(probeNoMockPersistence(HC_ON).status, "PASS");
  assert.equal(probeNoSilentFallback(HC_ON).status, "PASS");
  assert.equal(probeNoHybridRuntime(HC_ON).status, "PASS");
});

test("A-G probes never hardcode PASS without criterion details", () => {
  const probes = runOperatorAcceptanceGlobalProbes(HC_ON);
  for (const probe of probes) {
    assert.equal(probe.status, "PASS", probe.id);
    assert.ok(probe.details?.criterion, probe.id);
    assert.doesNotMatch(JSON.stringify(probe), /access[_-]?token|Bearer\s+[A-Za-z0-9._-]+/i);
  }
});
