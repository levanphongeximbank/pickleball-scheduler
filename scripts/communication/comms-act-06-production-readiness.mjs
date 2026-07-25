/**
 * COMMS-ACT-06 — static Production readiness (no remote mutation).
 * CI verifies repository backup contract; Owner-local script is optional.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCommsAct06Preflight } from "../../src/features/communication/activation/commsAct06Gates.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const result = evaluateCommsAct06Preflight({
  repoRoot: root,
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
      backupContractOk: result.backupContract?.pass === true,
      ownerLocalBackupClassification: result.ownerLocalBackup?.classification,
      ownerLocalBackupAvailable: result.ownerLocalBackup?.available === true,
      ciExternalFileExistenceRequired:
        result.backupEvidence?.CI_EXTERNAL_FILE_EXISTENCE_REQUIRED,
      productionLogicalBackupVerified:
        result.backupEvidence?.PRODUCTION_LOGICAL_BACKUP_VERIFIED,
      remediationCount: result.remediations?.length ?? 0,
      findingCodes: (result.findings || []).map((f) => f.code),
      secretsPrinted: result.secretsPrinted,
    },
    null,
    2
  )
);

if (!result.pass) process.exitCode = 1;
