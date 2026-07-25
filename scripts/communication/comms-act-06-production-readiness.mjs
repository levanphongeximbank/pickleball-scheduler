/**
 * COMMS-ACT-06 — static Production readiness (no remote mutation).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCommsAct06Preflight } from "../../src/features/communication/activation/commsAct06Gates.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const backupScriptPath =
  "C:\\Users\\Le Phong\\PICK_VN-Backups\\create-comms-act-07-production-logical-backup.ps1";

const result = evaluateCommsAct06Preflight({
  repoRoot: root,
  backupScriptPath,
  requireBackupScript: true,
});

console.log(
  JSON.stringify(
    {
      act: result.act,
      pass: result.pass,
      verdict: result.verdict,
      mutationCount: result.mutationCount,
      productionUntouched: result.productionUntouched,
      hostFamily: result.host?.hostFamily,
      backupScriptOk: result.backupScriptOk,
      remediationCount: result.remediations?.length ?? 0,
      findingCodes: (result.findings || []).map((f) => f.code),
      secretsPrinted: result.secretsPrinted,
    },
    null,
    2
  )
);

if (!result.pass) process.exitCode = 1;
