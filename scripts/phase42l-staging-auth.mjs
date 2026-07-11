/**
 * Phase 42L — reset Staging QA passwords via Admin API (no key logging).
 * Usage: node scripts/phase42l-staging-auth.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

const QA_ACCOUNTS = [
  "qa42l.nomember@staging.local",
  "player.nomember@staging.local",
  "player@staging.local",
  "owner@staging.local",
  "owner-b@staging.local",
  "manager@staging.local",
  "club@staging.local",
  "superadmin.nomember@staging.local",
  "admin@staging.local",
  "cashier@staging.local",
];

function getStagingAdmin() {
  loadProjectEnv();
  const url = String(
    process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
  ).trim();
  const serviceKey = String(process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anonKey = String(
    process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
  ).trim();

  if (!url.includes(STAGING_REF)) {
    throw new Error(`Refusing non-staging URL (expected ${STAGING_REF})`);
  }
  if (!serviceKey) {
    throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const anon =
    anonKey.length > 20
      ? createClient(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : admin;

  return { url, anonKey, admin, anon };
}

async function findUserIdByEmail(admin, email) {
  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = (data?.users || []).find(
      (u) => String(u.email || "").toLowerCase() === email.toLowerCase()
    );
    if (hit) return hit.id;
    if ((data?.users || []).length < perPage) break;
    page += 1;
  }
  return null;
}

async function resetPassword(admin, email) {
  const userId = await findUserIdByEmail(admin, email);
  if (!userId) {
    return { email, reset: "SKIP", signIn: "SKIP", reason: "user_not_found" };
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    password: QA_PASSWORD,
  });
  if (updErr) {
    return { email, reset: "FAIL", signIn: "SKIP", reason: updErr.message };
  }

  return { email, reset: "PASS", signIn: "PENDING", userId };
}

async function verifySignIn(anon, email) {
  const { data, error } = await anon.auth.signInWithPassword({
    email,
    password: QA_PASSWORD,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  await anon.auth.signOut();
  return { ok: true, userId: data.user?.id || null };
}

async function ensureQaNoMemberProfile(admin, email) {
  const userId = await findUserIdByEmail(admin, email);
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: QA_PASSWORD,
      email_confirm: true,
    });
    if (error) {
      return { email, reset: "FAIL", signIn: "SKIP", reason: error.message };
    }
    const newId = data.user?.id;
    if (!newId) {
      return { email, reset: "FAIL", signIn: "SKIP", reason: "create_user_no_id" };
    }
    const { error: profErr } = await admin.from("profiles").upsert({
      id: newId,
      email,
      role: "PLAYER",
      full_name: "QA42L No Member",
    });
    if (profErr) {
      return { email, reset: "PARTIAL", signIn: "PENDING", reason: profErr.message };
    }
    return { email, reset: "PASS", signIn: "PENDING", userId: newId, created: true };
  }

  const { error: profErr } = await admin.from("profiles").upsert({
    id: userId,
    email,
    role: "PLAYER",
    full_name: "QA42L No Member",
  });
  if (profErr) {
    return { email, reset: "PARTIAL", signIn: "PENDING", reason: profErr.message };
  }
  return null;
}

async function run() {
  const { admin, anon } = getStagingAdmin();
  const results = [];

  const qaNomember = QA_ACCOUNTS[0];
  const bootstrap = await ensureQaNoMemberProfile(admin, qaNomember);
  if (bootstrap) {
    if (bootstrap.reset === "PASS") {
      const signIn = await verifySignIn(anon, qaNomember);
      bootstrap.signIn = signIn.ok ? "PASS" : "FAIL";
      if (!signIn.ok) bootstrap.reason = signIn.reason;
    }
    results.push(bootstrap);
    const tag =
      bootstrap.signIn === "PASS" ? "PASS" : bootstrap.reset === "SKIP" ? "SKIP" : "FAIL";
    console.log(
      `[${tag}] ${qaNomember} reset=${bootstrap.reset} signIn=${bootstrap.signIn}${bootstrap.reason ? ` (${bootstrap.reason})` : ""}`
    );
  }

  for (const email of QA_ACCOUNTS) {
    if (email === qaNomember && bootstrap?.signIn === "PASS") {
      continue;
    }
    const row = await resetPassword(admin, email);
    if (row.reset === "PASS") {
      const signIn = await verifySignIn(anon, email);
      row.signIn = signIn.ok ? "PASS" : "FAIL";
      if (!signIn.ok) row.reason = signIn.reason;
    }
    results.push(row);
    const tag = row.signIn === "PASS" ? "PASS" : row.reset === "SKIP" ? "SKIP" : "FAIL";
    console.log(
      `[${tag}] ${email} reset=${row.reset} signIn=${row.signIn}${row.reason ? ` (${row.reason})` : ""}`
    );
  }

  const fails = results.filter((r) => r.signIn === "FAIL" || r.reset === "FAIL").length;
  process.exit(fails > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
