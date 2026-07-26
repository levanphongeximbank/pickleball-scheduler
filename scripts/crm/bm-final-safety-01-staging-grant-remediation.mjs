#!/usr/bin/env node
/**
 * BM-FINAL-SAFETY-01 — Staging-only grant remediation runner (DCL only).
 *
 * Hard constraints enforced here, not by convention:
 *   - Staging ref allowlist only; Production ref is absolutely blocked.
 *   - Executes the approved SQL file byte-for-byte; no inline/edited SQL.
 *   - SQL SHA-256 must match the hash the Owner authorized.
 *   - Statement whitelist: BEGIN / DO(guard) / REVOKE|GRANT / COMMIT only.
 *   - Requires a valid, unexpired, unconsumed one-time authorization bound to
 *     the operation, the Staging ref and the SQL fingerprint.
 *   - Default mode is plan-only; mutation requires --execute.
 *   - Never prints credentials.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "../load-env.mjs";
import {
  CRM_BM_FINAL_SAFETY_01_GRANT_REMEDIATION_OPERATION,
  buildCrmPhase1hBOneTimeAuthorization,
  consumeCrmPhase1hBOneTimeAuthorization,
  detectCrmPhase1hBNonMutationContext,
  evaluateCrmPhase1hBOneTimeAuthorization,
  writeCrmPhase1hBOneTimeAuthorizationFile,
} from "../../src/features/crm/staging/phase1hBOneTimeAuthorization.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const REMEDIATION_SQL_PATH = path.join(
  root,
  "docs/crm/bm-final-safety-01/STAGING_GRANT_REMEDIATION.sql"
);
const ROLLBACK_SQL_PATH = path.join(
  root,
  "docs/crm/bm-final-safety-01/STAGING_GRANT_REMEDIATION_ROLLBACK.sql"
);

function parseArgs(argv) {
  const args = {
    execute: false,
    rollback: false,
    issueAuthorization: false,
    ttlMinutes: 30,
    authorizationPath: null,
    expectSha256: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--execute") args.execute = true;
    else if (token === "--rollback") args.rollback = true;
    else if (token === "--issue-authorization") args.issueAuthorization = true;
    else if (token === "--ttl-minutes") args.ttlMinutes = Number(argv[++i]);
    else if (token === "--authorization") args.authorizationPath = argv[++i];
    else if (token === "--expect-sql-sha256") args.expectSha256 = argv[++i];
  }
  return args;
}

/**
 * Replace dollar-quoted bodies with a placeholder so statement splitting is safe.
 * Returns the stripped SQL plus the extracted bodies for separate inspection.
 */
function extractDollarQuotedBodies(sql) {
  const bodies = [];
  const stripped = sql.replace(/\$\$([\s\S]*?)\$\$/g, (_match, body) => {
    bodies.push(body);
    return "$$GUARD_BODY$$";
  });
  return { stripped, bodies };
}

const GUARD_BODY_FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|COPY|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|SET\s+ROLE)\b/i;

/**
 * Validate that the approved file contains only the authorized statement kinds.
 * @param {string} sql
 * @param {"revoke"|"grant"} dclKind
 */
function assertApprovedDclSql(sql, dclKind) {
  // Production ref appears only inside the file's "blocked ref" documentation
  // header, so the executable SQL is what must be checked.
  const withoutComments = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");
  if (withoutComments.includes(PRODUCTION_REF)) {
    throw new Error("Production project ref present in executable SQL; refused.");
  }

  const { stripped, bodies } = extractDollarQuotedBodies(withoutComments);

  for (const body of bodies) {
    if (GUARD_BODY_FORBIDDEN.test(body)) {
      throw new Error("Guard block contains a non-authorized statement; refused.");
    }
  }

  const statements = stripped
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter((statement) => statement.length > 0);

  if (statements.length < 3) {
    throw new Error("Approved SQL must contain an explicit transaction block.");
  }
  if (!/^BEGIN$/i.test(statements[0])) {
    throw new Error("Approved SQL must open with an explicit BEGIN.");
  }
  if (!/^COMMIT$/i.test(statements[statements.length - 1])) {
    throw new Error("Approved SQL must close with an explicit COMMIT.");
  }

  const dclPattern = dclKind === "grant" ? /^GRANT\s/i : /^REVOKE\s/i;
  const body = statements.slice(1, -1);
  let dclCount = 0;
  for (const statement of body) {
    if (/^DO\s/i.test(statement)) continue;
    if (dclPattern.test(statement)) {
      dclCount += 1;
      continue;
    }
    throw new Error("Non-authorized statement detected in approved SQL; refused.");
  }
  if (dclCount === 0) {
    throw new Error("Approved SQL contains no DCL statement; refused.");
  }

  return { statementCount: statements.length, dclStatementCount: dclCount };
}

function emit(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (STAGING_REF === PRODUCTION_REF) {
    throw new Error("Project identity collision; refused.");
  }

  const sqlPath = args.rollback ? ROLLBACK_SQL_PATH : REMEDIATION_SQL_PATH;
  const dclKind = args.rollback ? "grant" : "revoke";
  const sql = readFileSync(sqlPath, "utf8");
  const sqlSha256 = createHash("sha256").update(sql, "utf8").digest("hex");

  if (!args.expectSha256) {
    throw new Error("--expect-sql-sha256 is required (Owner-recorded hash).");
  }
  if (String(args.expectSha256).trim().toLowerCase() !== sqlSha256) {
    throw new Error("Approved SQL hash mismatch; refused (possible drift).");
  }

  const shape = assertApprovedDclSql(sql, dclKind);

  if (args.issueAuthorization) {
    if (!args.authorizationPath) {
      throw new Error("--authorization <absolute path> is required to issue.");
    }
    if (!path.isAbsolute(args.authorizationPath)) {
      throw new Error("Authorization path must be absolute and untracked.");
    }
    if (!path.relative(root, args.authorizationPath).startsWith("..")) {
      throw new Error("Authorization file must live outside the Git worktree.");
    }
    const issued = buildCrmPhase1hBOneTimeAuthorization({
      operation: CRM_BM_FINAL_SAFETY_01_GRANT_REMEDIATION_OPERATION,
      stagingProjectRef: STAGING_REF,
      migrationPlanFingerprint: sqlSha256,
      ttlMs: Math.round(args.ttlMinutes * 60 * 1000),
    });
    writeCrmPhase1hBOneTimeAuthorizationFile(args.authorizationPath, issued);
    emit({
      artifact: "BM_FINAL_SAFETY_01_STAGING_GRANT_REMEDIATION",
      ok: true,
      verdict: "BM_FINAL_SAFETY_01_ONE_TIME_AUTHORIZATION_ISSUED",
      mode: "issue-authorization",
      operation: issued.operation,
      stagingProjectRef: issued.stagingProjectRef,
      sqlPath: path.relative(root, sqlPath).replace(/\\/g, "/"),
      sqlSha256,
      operationId: issued.operationId,
      noncePresent: Boolean(issued.nonce),
      issuedAt: issued.issuedAt,
      expiresAt: issued.expiresAt,
      status: issued.status,
      storedOutsideWorktree: true,
      databaseWrites: 0,
      sqlApplied: false,
      secretsPrinted: false,
    });
    return;
  }

  const executionContext = detectCrmPhase1hBNonMutationContext(process.env);
  const authorization = evaluateCrmPhase1hBOneTimeAuthorization({
    authorizationPath: args.authorizationPath,
    expectedOperation: CRM_BM_FINAL_SAFETY_01_GRANT_REMEDIATION_OPERATION,
    expectedProjectRef: STAGING_REF,
    expectedFingerprint: sqlSha256,
  });

  const preflight = {
    artifact: "BM_FINAL_SAFETY_01_STAGING_GRANT_REMEDIATION",
    mode: args.execute ? "execute" : "plan-only",
    direction: args.rollback ? "rollback" : "remediation",
    stagingProjectRef: STAGING_REF,
    productionProjectRefBlocked: PRODUCTION_REF,
    productionTouched: false,
    sqlPath: path.relative(root, sqlPath).replace(/\\/g, "/"),
    sqlSha256,
    sqlShape: shape,
    executionContextBlocked: executionContext.blocked,
    executionContextReasons: executionContext.reasons,
    authorization: {
      ok: authorization.ok,
      verdict: authorization.verdict,
      errors: authorization.errors,
      operationId: authorization.operationId || null,
      noncePresent: authorization.noncePresent === true,
      status: authorization.status || null,
      issuedAt: authorization.issuedAt || null,
      expiresAt: authorization.expiresAt || null,
      stagingProjectRef: authorization.stagingProjectRef || null,
      sqlFingerprintMatched: authorization.ok,
    },
    secretsPrinted: false,
  };

  if (executionContext.blocked) {
    emit({
      ...preflight,
      ok: false,
      verdict: "BM_FINAL_SAFETY_01_STAGING_REMEDIATION_PRECONDITION_DRIFT",
      databaseWrites: 0,
      sqlApplied: false,
    });
    process.exitCode = 1;
    return;
  }

  if (!authorization.ok) {
    emit({
      ...preflight,
      ok: false,
      verdict: "BM_FINAL_SAFETY_01_STAGING_REMEDIATION_PRECONDITION_DRIFT",
      databaseWrites: 0,
      sqlApplied: false,
    });
    process.exitCode = 1;
    return;
  }

  if (!args.execute) {
    emit({
      ...preflight,
      ok: true,
      verdict: "BM_FINAL_SAFETY_01_STAGING_REMEDIATION_PLAN_ONLY",
      databaseWrites: 0,
      sqlApplied: false,
    });
    return;
  }

  loadProjectEnv();
  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required but will not be printed.");
  }

  const startedAt = new Date().toISOString();
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const finishedAt = new Date().toISOString();

  if (!response.ok) {
    emit({
      ...preflight,
      ok: false,
      verdict: "BM_FINAL_SAFETY_01_STAGING_REMEDIATION_FAILED",
      transaction: { committed: false, httpStatus: response.status },
      startedAt,
      finishedAt,
      databaseWrites: 0,
      sqlApplied: false,
    });
    process.exitCode = 1;
    return;
  }

  const consumed = consumeCrmPhase1hBOneTimeAuthorization(
    args.authorizationPath
  );

  emit({
    ...preflight,
    ok: true,
    verdict: "BM_FINAL_SAFETY_01_STAGING_REMEDIATION_EXECUTED",
    transaction: { committed: true, httpStatus: response.status },
    startedAt,
    finishedAt,
    sqlApplied: true,
    dclStatementsExecuted: shape.dclStatementCount,
    dataRowsMutated: 0,
    schemaObjectsChanged: 0,
    authorizationConsumed: {
      consumedAt: consumed.consumedAt,
      consumedMarker: path
        .relative(root, consumed.consumedPath)
        .replace(/\\/g, "/"),
    },
  });
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        artifact: "BM_FINAL_SAFETY_01_STAGING_GRANT_REMEDIATION",
        ok: false,
        verdict: "BM_FINAL_SAFETY_01_STAGING_REMEDIATION_PRECONDITION_DRIFT",
        databaseWrites: 0,
        sqlApplied: false,
        secretsPrinted: false,
        error: String(error?.message || error).slice(0, 200),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
