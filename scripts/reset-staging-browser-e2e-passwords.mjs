#!/usr/bin/env node
/**
 * Reset Browser E2E staging passwords (STAGING ONLY).
 * Evidence: docs/v5/qa-evidence/phase-v5d41/
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import { D41_OUT_DIR } from "./referee-v5-staging-harness.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const OUT_DIR = join(process.cwd(), D41_OUT_DIR);

const TARGETS = Object.freeze([
  { email: "player@staging.local", passwordEnv: "STAGING_PLAYER_NEW_PASSWORD", label: "player" },
  { email: "owner-b@staging.local", passwordEnv: "STAGING_NON_COHORT_NEW_PASSWORD", label: "non_cohort" },
]);

function assertStagingOnly(url) {
  if (!url || !url.includes(STAGING_REF)) {
    throw new Error(`STOP — expected staging ref ${STAGING_REF}`);
  }
  if (url.includes(PRODUCTION_REF)) {
    throw new Error("STOP — production ref detected");
  }
}

async function findUserIdByEmail(admin, email) {
  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`listUsers failed: ${error.message}`);
    }
    const hit = (data?.users || []).find(
      (u) => String(u.email || "").toLowerCase() === email.toLowerCase(),
    );
    if (hit) {
      return hit.id;
    }
    if ((data?.users || []).length < perPage) {
      break;
    }
    page += 1;
  }
  return null;
}

async function resetAndVerify({ admin, anon, email, password }) {
  const userId = await findUserIdByEmail(admin, email);
  if (!userId) {
    return { email, reset: "FAIL", signIn: "SKIP", reason: "user_not_found" };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (updateError) {
    return { email, reset: "FAIL", signIn: "SKIP", reason: updateError.message };
  }

  const { data, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    return { email, reset: "PASS", signIn: "FAIL", reason: signInError.message, userId };
  }

  await anon.auth.signOut();
  return { email, reset: "PASS", signIn: "PASS", userId: data.user?.id || userId };
}

async function main() {
  loadProjectEnv();
  const { url, anonKey, serviceKey } = getStagingSupabaseEnv();
  assertStagingOnly(url);

  if (!serviceKey) {
    throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");
  }

  const apiKey = anonKey?.length > 20 ? anonKey : null;
  if (!apiKey) {
    throw new Error("Missing STAGING_SUPABASE_ANON_KEY for sign-in verification");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Staging ref: ${STAGING_REF}`);
  console.log(`Production ref blocked: ${PRODUCTION_REF}\n`);

  const results = [];
  let failures = 0;

  for (const target of TARGETS) {
    const password = String(process.env[target.passwordEnv] || "").trim();
    if (!password) {
      console.log(`[FAIL] ${target.email} reset=SKIP signIn=SKIP (missing ${target.passwordEnv})`);
      results.push({
        email: target.email,
        label: target.label,
        reset: "SKIP",
        signIn: "SKIP",
        pass: false,
        reason: `missing_${target.passwordEnv}`,
      });
      failures += 1;
      continue;
    }

    const result = await resetAndVerify({
      admin,
      anon,
      email: target.email,
      password,
    });
    const pass = result.reset === "PASS" && result.signIn === "PASS";
    const tag = pass ? "PASS" : "FAIL";
    console.log(
      `[${tag}] ${result.email} reset=${result.reset} signIn=${result.signIn}${result.reason ? ` (${result.reason})` : ""}`,
    );
    results.push({ ...result, label: target.label, pass });
    if (!pass) {
      failures += 1;
    }
  }

  const resetReport = {
    stagingRef: STAGING_REF,
    productionBlocked: PRODUCTION_REF,
    allPass: failures === 0,
    results: results.map(({ email, label, reset, signIn, pass, reason, userId }) => ({
      email,
      label,
      reset,
      signIn,
      pass,
      reason: reason || null,
      userId: userId || null,
    })),
  };

  const authReport = {
    playerLogin: results.find((r) => r.label === "player")?.signIn === "PASS" ? "PASS" : "FAIL",
    nonCohortLogin: results.find((r) => r.label === "non_cohort")?.signIn === "PASS" ? "PASS" : "FAIL",
    secretsProtected: true,
    results: resetReport.results,
  };

  writeFileSync(join(OUT_DIR, "PASSWORD_RESET_REPORT.json"), JSON.stringify(resetReport, null, 2));
  writeFileSync(join(OUT_DIR, "AUTH_LOGIN_REPORT.json"), JSON.stringify(authReport, null, 2));

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
