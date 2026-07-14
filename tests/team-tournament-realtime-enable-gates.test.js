import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MULTI_DEVICE_SMOKE_ROWS,
  REALTIME_DEPLOY_STAGE,
  buildRealtimeEnableGatesReport,
  evaluateCaptainIsolationGates,
  evaluateRealtimeFlagMatrix,
  evaluateReconnectPollGates,
  resolveRealtimeDeployStage,
} from "../src/features/team-tournament/engines/teamRealtimeEnableGatesEngine.js";
import { isTeamTournamentRealtimeEnabled } from "../src/features/team-tournament/realtime/realtimeFlags.js";

test("T-S2-G01 staging recommended ON is compliant", () => {
  const matrix = evaluateRealtimeFlagMatrix({
    stage: REALTIME_DEPLOY_STAGE.STAGING,
    env: { VITE_TT_REALTIME_ENABLED: "true" },
  });
  assert.equal(matrix.ok, true);
  assert.equal(matrix.compliance, "COMPLIANT_ON");
});

test("T-S2-G02 production ON without Owner override is blocked", () => {
  const matrix = evaluateRealtimeFlagMatrix({
    stage: REALTIME_DEPLOY_STAGE.PRODUCTION,
    env: { VITE_TT_REALTIME_ENABLED: "true" },
  });
  assert.equal(matrix.ok, false);
  assert.equal(matrix.compliance, "PRODUCTION_BLOCKED");
  assert.equal(matrix.productionSqlOrFlagApplyAllowed, false);
});

test("T-S2-G03 production OFF is gated compliant", () => {
  const report = buildRealtimeEnableGatesReport({
    stage: REALTIME_DEPLOY_STAGE.PRODUCTION,
    env: { VITE_TT_REALTIME_ENABLED: "false" },
  });
  assert.equal(report.verdict, "PRODUCTION_GATED_OFF");
  assert.equal(report.productionFlagApplyAllowed, false);
});

test("T-S2-G04 reconnect/poll contract passes", () => {
  const gates = evaluateReconnectPollGates();
  assert.equal(gates.ok, true);
  assert.equal(gates.failed.length, 0);
  assert.equal(gates.intervals.CRITICAL_MS, 4000);
});

test("T-S2-G05 captain isolation + multi-device smoke rows", () => {
  const isolation = evaluateCaptainIsolationGates({
    captainSecurityVerdict: "PASS",
  });
  assert.equal(isolation.ok, true);
  assert.equal(MULTI_DEVICE_SMOKE_ROWS.length, 5);
  assert.ok(MULTI_DEVICE_SMOKE_ROWS.some((row) => row.id === "MD-03"));
});

test("T-S2-G06 stage resolve + panel + default flag false", () => {
  assert.equal(
    resolveRealtimeDeployStage({ Vercel_ENV: "x", VITE_VERCEL_ENV: "preview" }),
    REALTIME_DEPLOY_STAGE.PREVIEW
  );
  assert.equal(
    resolveRealtimeDeployStage({
      VITE_SUPABASE_URL: "https://qyewbxjsiiyufanzcjcq.supabase.co",
    }),
    REALTIME_DEPLOY_STAGE.STAGING
  );
  assert.equal(isTeamTournamentRealtimeEnabled(), false);

  const panel = path.join(
    process.cwd(),
    "src/components/tournament/team/TeamRealtimeEnableGatesPanel.jsx"
  );
  assert.equal(fs.existsSync(panel), true);

  const evidence = path.join(
    process.cwd(),
    "docs/v5/qa-evidence/phase-tt6/TT6C_CAPTAIN_SECURITY_REPORT.json"
  );
  assert.equal(fs.existsSync(evidence), true);
});
