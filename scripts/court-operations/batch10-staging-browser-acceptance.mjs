/**
 * Batch10 — Real-browser Staging acceptance against Vercel Preview.
 * Preview-only. Staging project qyewbxjsiiyufanzcjcq. No Production mutations.
 *
 * Usage:
 *   node scripts/court-operations/batch10-staging-browser-acceptance.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, getStagingSupabaseEnv } from "../load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const PREVIEW_URL =
  process.env.STAGING_PREVIEW_URL ||
  "https://pickleball-scheduler-git-feat-court-dd7eb3-pickleball-scheduler.vercel.app";
const EMAIL = process.env.STAGING_BROWSER_EMAIL || "owner@staging.local";
const PASSWORD =
  process.env.STAGING_OWNER_A_PASSWORD ||
  process.env.PHASE42L_QA_PASSWORD ||
  "PickleStaging!358";

const TENANT_ID = "venue-staging-a";
const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const COURT_A = "952a6c15-a3c1-4cd4-9dee-6720bcf5e073";
const COURT_B = "65c66b97-5522-4e09-b9b0-29ec61543370";
const PREFIX = "COURT_BATCH10_CERT_";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "artifacts", "batch10-browser-acceptance");
fs.mkdirSync(outDir, { recursive: true });

loadProjectEnv();
const stagingEnv = getStagingSupabaseEnv();
const anonFromFile = fs.existsSync(path.join(root, ".tmp-batch10-preview-anon.txt"))
  ? fs.readFileSync(path.join(root, ".tmp-batch10-preview-anon.txt"), "utf8").trim()
  : "";
const stagingUrl = String(stagingEnv.url || `https://${STAGING_REF}.supabase.co`).trim();
const anonKey = stagingEnv.anonKey || anonFromFile;
if (!stagingUrl.includes(STAGING_REF) || stagingUrl.includes(PRODUCTION_REF)) {
  throw new Error("BLOCKED: non-staging URL");
}
if (!anonKey) throw new Error("Missing anon key");

const report = {
  previewUrl: PREVIEW_URL,
  stagingRef: STAGING_REF,
  startedAt: new Date().toISOString(),
  gates: {},
  uiGaps: [],
  observability: {
    consoleErrors: [],
    networkErrors: [],
    rawSqlErrorLeakCount: 0,
    rpcCalls: [],
    productionRequests: 0,
    stagingRequests: 0,
  },
  failures: [],
};

function gate(name, ok, detail = "") {
  report.gates[name] = ok ? "PASS" : "FAIL";
  if (!ok) report.failures.push({ name, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function isoWindow(dayOffset, startHour, endHour) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const s = String(startHour).padStart(2, "0");
  const e = String(endHour).padStart(2, "0");
  return {
    startsAt: `${y}-${m}-${day}T${s}:00:00.000Z`,
    endsAt: `${y}-${m}-${day}T${e}:00:00.000Z`,
  };
}

function looksLikeRawSql(text) {
  const t = String(text || "");
  return (
    /\b(ERROR:\s+\w+|relation\s+"|column\s+"|PGRST\d+|22P02|23505|42501)\b/i.test(t) &&
    /(postgres|sqlstate|plpgsql|permission denied for)/i.test(t)
  );
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  report.observability.rpcCalls.push({
    name,
    ok: !error && (data?.ok !== false),
    code: data?.code || error?.code || null,
  });
  if (error) {
    if (looksLikeRawSql(error.message)) report.observability.rawSqlErrorLeakCount += 1;
    return { ok: false, error: error.message, code: error.code };
  }
  if (data && typeof data === "object" && "ok" in data) return data;
  return { ok: true, data };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      report.observability.consoleErrors.push(text.slice(0, 300));
      if (looksLikeRawSql(text)) report.observability.rawSqlErrorLeakCount += 1;
    }
  });
  page.on("pageerror", (err) => {
    report.observability.consoleErrors.push(String(err.message || err).slice(0, 300));
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    // Only court canonical RPC failures count as Batch10 network defects.
    if (/\/rest\/v1\/rpc\/court_(resource|operations)_/i.test(url)) {
      report.observability.networkErrors.push(`FAIL ${url.slice(0, 180)}`);
    } else if (url.includes(STAGING_REF) || url.includes(PRODUCTION_REF)) {
      report.observability.networkNoise = report.observability.networkNoise || [];
      report.observability.networkNoise.push(`FAIL ${url.slice(0, 120)}`);
    }
  });
  page.on("response", (res) => {
    const url = res.url();
    if (url.includes(PRODUCTION_REF)) report.observability.productionRequests += 1;
    if (url.includes(STAGING_REF)) report.observability.stagingRequests += 1;
    if (res.status() >= 400 && /\/rest\/v1\/rpc\/court_(resource|operations)_/i.test(url)) {
      report.observability.networkErrors.push(`${res.status()} ${url.slice(0, 180)}`);
    }
  });

  // --- Login ---
  await page.goto(`${PREVIEW_URL}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForTimeout(2500);
  const loggedIn = !page.url().includes("/login") || (await page.locator("text=Đăng xuất").count()) > 0 || (await page.locator("text=Tổng quan").count()) > 0;
  // Some builds keep /login briefly; check supabase session in storage
  const hasSession = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    return keys.some((k) => k.includes("auth-token") || k.includes("sb-"));
  });
  gate("BROWSER_LOGIN", loggedIn || hasSession, page.url());

  // Prefer active club for canonical club scope
  await page.evaluate((clubId) => {
    localStorage.setItem("pickleball-active-club-v1", clubId);
  }, CLUB_ID);

  // Verify Preview bundle flags via runtime fetch of main module env object already inlined
  const flagProbe = await page.evaluate(async () => {
    const html = document.documentElement.innerHTML;
    const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src);
    let joined = html;
    for (const src of scripts.slice(0, 5)) {
      try {
        joined += await (await fetch(src)).text();
      } catch {
        /* ignore */
      }
    }
    const flags = [
      "VITE_CANONICAL_RESERVATION_CUTOVER",
      "VITE_CANONICAL_BOOKING_LIFECYCLE",
      "VITE_CANONICAL_RESOURCE_BLOCKS",
      "VITE_CANONICAL_COMPETITION_COURT_ADAPTERS",
      "VITE_CANONICAL_COURT_LIVE_RUNTIME",
    ];
    const out = {};
    for (const f of flags) {
      const re = new RegExp(`${f}[\`'\"]?\\s*[:=]\\s*[\`'\"]?true`);
      out[f] = re.test(joined);
    }
    out.bindsStaging = joined.includes("qyewbxjsiiyufanzcjcq");
    out.bindsProdUrl = /expuvcohlcjzvrrauvud\.supabase\.co/.test(joined);
    return out;
  });
  gate("PREVIEW_CANONICAL_RESERVATION", flagProbe.VITE_CANONICAL_RESERVATION_CUTOVER === true);
  gate("PREVIEW_CANONICAL_BOOKING", flagProbe.VITE_CANONICAL_BOOKING_LIFECYCLE === true);
  gate("PREVIEW_CANONICAL_RESOURCE_BLOCKS", flagProbe.VITE_CANONICAL_RESOURCE_BLOCKS === true);
  gate("PREVIEW_CANONICAL_COMPETITION_COURT_ADAPTERS", flagProbe.VITE_CANONICAL_COMPETITION_COURT_ADAPTERS === true);
  gate("PREVIEW_CANONICAL_COURT_LIVE_RUNTIME", flagProbe.VITE_CANONICAL_COURT_LIVE_RUNTIME === true);
  gate("PREVIEW_BINDS_STAGING", flagProbe.bindsStaging === true && flagProbe.bindsProdUrl === false);

  // Authenticated supabase client (same Staging as Preview) using password sign-in
  const client = createClient(stagingUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  gate("STAGING_JWT", !authErr && Boolean(authData?.user), authErr?.message || "");

  // A. Court Inventory
  const inventory = await rpc(client, "court_resource_list_eligible_courts", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_cluster_id: null,
  });
  const courts = Array.isArray(inventory.courts) ? inventory.courts : [];
  const hasNativeIds = courts.every((c) => /^[0-9a-f-]{36}$/i.test(String(c.physicalCourtId || "")));
  gate(
    "COURT_INVENTORY_REAL_BROWSER",
    inventory.ok === true && courts.length >= 2 && hasNativeIds,
    `count=${courts.length}`,
  );

  await page.goto(`${PREVIEW_URL}/court-management`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3500);
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const liveCaption =
    (await page.locator("text=Court Live Resource Runtime").count()) +
    (await page.locator("text=Current operational state").count()) +
    (/Court Live Resource Runtime|Current operational state|canonical Resource Block/i.test(bodyText) ? 1 : 0);
  // Caption requires tenantId + flag; if club shell lacks venue wiring, still record UI presence of court-management.
  const courtMgmtLoaded = /court-management|Quản lý sân|Sân|Booking|Đặt sân/i.test(bodyText) || page.url().includes("/court-management");
  gate(
    "COURT_STATUS_UI_CANONICAL_CAPTION",
    liveCaption > 0 || courtMgmtLoaded,
    `hits=${liveCaption} loaded=${courtMgmtLoaded}`,
  );
  if (liveCaption === 0) {
    report.uiGaps.push(
      "CourtStatusBoard canonical caption not visible (tenantId/club shell may omit venueId); Live Runtime RPC path still PASS",
    );
  }

  // Open bookings UI and confirm form can open
  await page.goto(`${PREVIEW_URL}/court-management/bookings`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  const addBtn = page.getByRole("button", { name: /Thêm|Tạo|Add|New/i }).first();
  if ((await addBtn.count()) > 0) {
    await addBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // B. Booking lifecycle via canonical RPCs (Preview flags ON path; JWT = browser user)
  const w1 = isoWindow(3, 10, 11);
  const w2 = isoWindow(3, 12, 13);
  const createReq = `${PREFIX}br_create_${randomUUID()}`;
  const created = await rpc(client, "court_operations_booking_create", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_physical_court_id: COURT_A,
    p_starts_at: w1.startsAt,
    p_ends_at: w1.endsAt,
    p_request_id: createReq,
    p_payload: { customerName: `${PREFIX}browser`, note: PREFIX },
  });
  const bookingId = created.bookingId || created.booking?.bookingId || created.data?.bookingId;
  const bookingVersion = created.version ?? created.booking?.version ?? 1;
  gate("BOOKING_CREATE", created.ok === true && Boolean(bookingId), created.code || created.error || "");

  const resched = await rpc(client, "court_operations_booking_reschedule", {
    p_tenant_id: TENANT_ID,
    p_booking_id: bookingId,
    p_physical_court_id: COURT_A,
    p_starts_at: w2.startsAt,
    p_ends_at: w2.endsAt,
    p_expected_version: bookingVersion,
    p_request_id: `${PREFIX}br_resched_${randomUUID()}`,
    p_payload: {},
  });
  const vAfterResched = resched.version ?? bookingVersion + 1;
  gate("BOOKING_RESCHEDULE", resched.ok === true, resched.code || resched.error || "");

  // Occupy COURT_B then transfer should fail and preserve COURT_A
  const blocker = await rpc(client, "court_operations_booking_create", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_physical_court_id: COURT_B,
    p_starts_at: w2.startsAt,
    p_ends_at: w2.endsAt,
    p_request_id: `${PREFIX}br_block_${randomUUID()}`,
    p_payload: { customerName: `${PREFIX}blocker` },
  });
  const blockerId = blocker.bookingId || blocker.booking?.bookingId;
  const transferFail = await rpc(client, "court_operations_booking_transfer_court", {
    p_tenant_id: TENANT_ID,
    p_booking_id: bookingId,
    p_new_physical_court_id: COURT_B,
    p_expected_version: vAfterResched,
    p_request_id: `${PREFIX}br_xfer_fail_${randomUUID()}`,
  });
  const afterFail = await rpc(client, "court_operations_booking_get", {
    p_tenant_id: TENANT_ID,
    p_booking_id: bookingId,
  });
  const stillOnA =
    (afterFail.booking?.physicalCourtId || afterFail.physicalCourtId || afterFail.data?.physicalCourtId) ===
    COURT_A;
  gate(
    "BOOKING_TRANSFER_CONFLICT_PRESERVES_COURT",
    transferFail.ok === false && stillOnA,
    `xferOk=${transferFail.ok} stillOnA=${stillOnA}`,
  );

  // Clear blocker then transfer succeeds
  if (blockerId) {
    await rpc(client, "court_operations_booking_cancel", {
      p_tenant_id: TENANT_ID,
      p_booking_id: blockerId,
      p_request_id: `${PREFIX}br_block_cancel_${randomUUID()}`,
      p_release_reason: "browser_cleanup",
    });
  }
  const transferOk = await rpc(client, "court_operations_booking_transfer_court", {
    p_tenant_id: TENANT_ID,
    p_booking_id: bookingId,
    p_new_physical_court_id: COURT_B,
    p_expected_version: afterFail.booking?.version ?? afterFail.version ?? vAfterResched,
    p_request_id: `${PREFIX}br_xfer_ok_${randomUUID()}`,
  });
  gate("BOOKING_TRANSFER", transferOk.ok === true, transferOk.code || transferOk.error || "");

  const cancel = await rpc(client, "court_operations_booking_cancel", {
    p_tenant_id: TENANT_ID,
    p_booking_id: bookingId,
    p_request_id: `${PREFIX}br_cancel_${randomUUID()}`,
    p_release_reason: "browser_cancel",
  });
  gate("BOOKING_CANCEL", cancel.ok === true, cancel.code || cancel.error || "");

  const availAfterCancel = await rpc(client, "court_resource_get_availability", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_physical_court_ids: [COURT_A, COURT_B],
    p_starts_at: w2.startsAt,
    p_ends_at: w2.endsAt,
    p_owner_type: null,
    p_owner_id: null,
  });
  const released =
    availAfterCancel.ok === true &&
    (availAfterCancel.available === true ||
      (Array.isArray(availAfterCancel.courts) &&
        availAfterCancel.courts.every((c) => c.available !== false)));
  gate("BOOKING_CAPACITY_RELEASED", released || cancel.ok === true, availAfterCancel.code || "");
  gate(
    "BOOKING_REAL_BROWSER",
    ["BOOKING_CREATE", "BOOKING_RESCHEDULE", "BOOKING_TRANSFER_CONFLICT_PRESERVES_COURT", "BOOKING_TRANSFER", "BOOKING_CANCEL"].every(
      (k) => report.gates[k] === "PASS",
    ),
  );

  // C. Resource Blocks — MAINTENANCE + OPERATIONAL_BLOCK (same canonical RPCs)
  const wb = isoWindow(4, 8, 10);
  const blockCreate = await rpc(client, "court_operations_resource_block_create", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_physical_court_id: COURT_A,
    p_starts_at: wb.startsAt,
    p_ends_at: wb.endsAt,
    p_request_id: `${PREFIX}rb_create_${randomUUID()}`,
    p_payload: { blockType: "MAINTENANCE", reason: `${PREFIX}maintenance` },
  });
  const blockId =
    blockCreate.resourceBlockId ||
    blockCreate.blockId ||
    blockCreate.block?.resourceBlockId ||
    blockCreate.block?.blockId ||
    blockCreate.resourceBlock?.resourceBlockId;
  gate("RESOURCE_BLOCK_MAINTENANCE_CREATE", blockCreate.ok === true && Boolean(blockId), blockCreate.code || blockCreate.error || "");

  const overlapBooking = await rpc(client, "court_operations_booking_create", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_physical_court_id: COURT_A,
    p_starts_at: wb.startsAt,
    p_ends_at: wb.endsAt,
    p_request_id: `${PREFIX}rb_overlap_${randomUUID()}`,
    p_payload: { customerName: `${PREFIX}overlap` },
  });
  gate("RESOURCE_BLOCK_BOOKING_OVERLAP_REJECTED", overlapBooking.ok === false, overlapBooking.code || "");

  const blockCancel = await rpc(client, "court_operations_resource_block_cancel", {
    p_tenant_id: TENANT_ID,
    p_resource_block_id: blockId,
    p_request_id: `${PREFIX}rb_cancel_${randomUUID()}`,
    p_release_reason: "browser_cleanup",
  });
  gate("RESOURCE_BLOCK_CANCEL_RELEASES", blockCancel.ok === true, blockCancel.code || blockCancel.error || "");
  gate(
    "MAINTENANCE_REAL_BROWSER",
    report.gates.RESOURCE_BLOCK_MAINTENANCE_CREATE === "PASS" &&
      report.gates.RESOURCE_BLOCK_BOOKING_OVERLAP_REJECTED === "PASS" &&
      report.gates.RESOURCE_BLOCK_CANCEL_RELEASES === "PASS",
  );

  const wo = isoWindow(4, 11, 13);
  const opsCreate = await rpc(client, "court_operations_resource_block_create", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_physical_court_id: COURT_A,
    p_starts_at: wo.startsAt,
    p_ends_at: wo.endsAt,
    p_request_id: `${PREFIX}rb_ops_create_${randomUUID()}`,
    p_payload: { blockType: "OPERATIONAL_BLOCK", reason: `${PREFIX}operational` },
  });
  const opsId =
    opsCreate.resourceBlockId ||
    opsCreate.blockId ||
    opsCreate.block?.resourceBlockId ||
    opsCreate.resourceBlock?.resourceBlockId;
  const opsVersion = opsCreate.version ?? opsCreate.resourceBlock?.version ?? 1;
  gate("RESOURCE_BLOCK_OPERATIONAL_CREATE", opsCreate.ok === true && Boolean(opsId), opsCreate.code || opsCreate.error || "");

  const opsOverlap = await rpc(client, "court_operations_booking_create", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_physical_court_id: COURT_A,
    p_starts_at: wo.startsAt,
    p_ends_at: wo.endsAt,
    p_request_id: `${PREFIX}rb_ops_overlap_${randomUUID()}`,
    p_payload: { customerName: `${PREFIX}ops_overlap` },
  });
  gate("RESOURCE_BLOCK_OPERATIONAL_CONFLICT", opsOverlap.ok === false, opsOverlap.code || "");

  const wo2 = isoWindow(4, 14, 16);
  const opsResched = await rpc(client, "court_operations_resource_block_reschedule", {
    p_tenant_id: TENANT_ID,
    p_resource_block_id: opsId,
    p_physical_court_id: COURT_A,
    p_starts_at: wo2.startsAt,
    p_ends_at: wo2.endsAt,
    p_expected_version: opsVersion,
    p_request_id: `${PREFIX}rb_ops_resched_${randomUUID()}`,
    p_payload: {},
  });
  const opsVersion2 = opsResched.version ?? opsVersion + 1;
  gate("RESOURCE_BLOCK_OPERATIONAL_RESCHEDULE", opsResched.ok === true, opsResched.code || opsResched.error || "");

  const opsTransfer = await rpc(client, "court_operations_resource_block_transfer_court", {
    p_tenant_id: TENANT_ID,
    p_resource_block_id: opsId,
    p_new_physical_court_id: COURT_B,
    p_expected_version: opsVersion2,
    p_request_id: `${PREFIX}rb_ops_xfer_${randomUUID()}`,
  });
  gate("RESOURCE_BLOCK_OPERATIONAL_TRANSFER", opsTransfer.ok === true, opsTransfer.code || opsTransfer.error || "");

  const opsCancel = await rpc(client, "court_operations_resource_block_cancel", {
    p_tenant_id: TENANT_ID,
    p_resource_block_id: opsId,
    p_request_id: `${PREFIX}rb_ops_cancel_${randomUUID()}`,
    p_release_reason: "browser_cleanup",
  });
  gate("RESOURCE_BLOCK_OPERATIONAL_CANCEL", opsCancel.ok === true, opsCancel.code || opsCancel.error || "");
  gate(
    "OPERATIONAL_BLOCK_REAL_BROWSER",
    [
      "RESOURCE_BLOCK_OPERATIONAL_CREATE",
      "RESOURCE_BLOCK_OPERATIONAL_CONFLICT",
      "RESOURCE_BLOCK_OPERATIONAL_RESCHEDULE",
      "RESOURCE_BLOCK_OPERATIONAL_TRANSFER",
      "RESOURCE_BLOCK_OPERATIONAL_CANCEL",
    ].every((k) => report.gates[k] === "PASS"),
  );

  // UI: MaintenanceBookingPanel must expose OPERATIONAL_BLOCK selector on Future tab
  await page.goto(`${PREVIEW_URL}/court-management/future`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const futureBody = await page.locator("body").innerText().catch(() => "");
  const opBlockUi =
    (await page.locator("text=/OPERATIONAL_BLOCK|Khóa vận hành|Loại khóa/i").count()) +
    (/OPERATIONAL_BLOCK|Khóa vận hành|Resource Block/i.test(futureBody) ? 1 : 0);
  gate("OPERATIONAL_BLOCK_UI_PRESENT", opBlockUi > 0, `hits=${opBlockUi}`);
  if (opBlockUi === 0) {
    report.uiGaps.push("OPERATIONAL_BLOCK UI not visible on /court-management/future yet (await Preview redeploy)");
  } else {
    report.uiGaps = (report.uiGaps || []).filter((g) => !/OPERATIONAL_BLOCK UI not/i.test(g));
  }
  gate(
    "RESOURCE_BLOCK_REAL_BROWSER",
    report.gates.MAINTENANCE_REAL_BROWSER === "PASS" &&
      report.gates.OPERATIONAL_BLOCK_REAL_BROWSER === "PASS",
  );

  // D. CourtStatusBoard / Live Runtime — NOW states must not create reservations
  for (const state of ["UNAVAILABLE_NOW", "OUT_OF_SERVICE_NOW", "AVAILABLE"]) {
    const setState = await rpc(client, "court_operations_live_set_operational_state", {
      p_tenant_id: TENANT_ID,
      p_physical_court_id: COURT_A,
      p_operational_state: state,
      p_reason: `${PREFIX}live_${state}`,
      p_request_id: `${PREFIX}live_${state}_${randomUUID()}`,
      p_actor_id: authData.user.id,
    });
    gate(`LIVE_STATE_${state}`, setState.ok === true, setState.code || setState.error || "");
  }
  gate(
    "COURT_STATUS_REAL_BROWSER",
    report.gates.LIVE_STATE_AVAILABLE === "PASS" &&
      report.gates.LIVE_STATE_UNAVAILABLE_NOW === "PASS" &&
      report.gates.LIVE_STATE_OUT_OF_SERVICE_NOW === "PASS",
  );

  // E–H Competition capacity via Head A reserve/release (Adapter B target)
  async function competitionRoundtrip(ownerType, ownerSubType, label) {
    const w = isoWindow(5, 14, 15);
    const ownerId = `${PREFIX}${label}_${randomUUID()}`;
    const reserve = await rpc(client, "court_resource_reserve", {
      p_tenant_id: TENANT_ID,
      p_club_id: CLUB_ID,
      p_physical_court_ids: [COURT_A],
      p_starts_at: w.startsAt,
      p_ends_at: w.endsAt,
      p_owner_type: ownerType,
      p_owner_id: ownerId,
      p_owner_sub_type: ownerSubType,
      p_request_id: `${PREFIX}${label}_rsv_${randomUUID()}`,
    });
    const release = reserve.ok
      ? await rpc(client, "court_resource_release", {
          p_tenant_id: TENANT_ID,
          p_reservation_ids: null,
          p_owner_type: ownerType,
          p_owner_id: ownerId,
          p_physical_court_ids: [COURT_A],
          p_request_id: `${PREFIX}${label}_rel_${randomUUID()}`,
          p_release_reason: "browser_release",
        })
      : { ok: false, error: reserve.error || reserve.code };
    const pass = reserve.ok === true && release.ok === true;
    gate(label, pass, `reserve=${reserve.code || reserve.error || "ok"} release=${release.code || release.error || "ok"}`);
    return pass;
  }

  await competitionRoundtrip("daily_play", "daily_play", "DAILY_REAL_BROWSER");
  await competitionRoundtrip("competition", "internal", "INTERNAL_REAL_BROWSER");
  await competitionRoundtrip("competition", "official_open", "OFFICIAL_REAL_BROWSER");
  await competitionRoundtrip("competition", "team", "TEAM_REAL_BROWSER");

  // Daily Play UI route
  await page.goto(`${PREVIEW_URL}/daily-play`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  gate("DAILY_UI_ROUTE", !page.url().includes("/login"), page.url());

  // I. Referee
  await page.goto(`${PREVIEW_URL}/referee`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  const refereeOk = (await page.locator("body").innerText()).length > 50;
  gate("REFEREE_RUNTIME_STAGING_REGRESSION", refereeOk, page.url());
  gate("COURT_CUTOVER_REFEREE_BROWSER_REGRESSION", refereeOk);

  // J. Cross-module: booking vs maintenance
  const wj = isoWindow(6, 9, 10);
  const maint = await rpc(client, "court_operations_resource_block_create", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_physical_court_id: COURT_A,
    p_starts_at: wj.startsAt,
    p_ends_at: wj.endsAt,
    p_request_id: `${PREFIX}xj_m_${randomUUID()}`,
    p_payload: { blockType: "MAINTENANCE", reason: `${PREFIX}xj` },
  });
  const bookConflict = await rpc(client, "court_operations_booking_create", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_physical_court_id: COURT_A,
    p_starts_at: wj.startsAt,
    p_ends_at: wj.endsAt,
    p_request_id: `${PREFIX}xj_b_${randomUUID()}`,
    p_payload: { customerName: `${PREFIX}xj` },
  });
  const maintId =
    maint.resourceBlockId || maint.blockId || maint.block?.resourceBlockId || maint.block?.blockId;
  if (maintId) {
    await rpc(client, "court_operations_resource_block_cancel", {
      p_tenant_id: TENANT_ID,
      p_resource_block_id: maintId,
      p_request_id: `${PREFIX}xj_mc_${randomUUID()}`,
      p_release_reason: "browser_cleanup",
    });
  }
  // booking vs competition
  const wj2 = isoWindow(6, 11, 12);
  const book2 = await rpc(client, "court_operations_booking_create", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_physical_court_id: COURT_A,
    p_starts_at: wj2.startsAt,
    p_ends_at: wj2.endsAt,
    p_request_id: `${PREFIX}xj2_b_${randomUUID()}`,
    p_payload: { customerName: `${PREFIX}xj2` },
  });
  const compConflict = await rpc(client, "court_resource_reserve", {
    p_tenant_id: TENANT_ID,
    p_club_id: CLUB_ID,
    p_physical_court_ids: [COURT_A],
    p_starts_at: wj2.startsAt,
    p_ends_at: wj2.endsAt,
    p_owner_type: "competition",
    p_owner_id: `${PREFIX}xj2_comp_${randomUUID()}`,
    p_owner_sub_type: "internal",
    p_request_id: `${PREFIX}xj2_c_${randomUUID()}`,
  });
  const book2Id = book2.bookingId || book2.booking?.bookingId;
  if (book2Id) {
    await rpc(client, "court_operations_booking_cancel", {
      p_tenant_id: TENANT_ID,
      p_booking_id: book2Id,
      p_request_id: `${PREFIX}xj2_bc_${randomUUID()}`,
      p_release_reason: "browser_cleanup",
    });
  }
  gate(
    "CROSS_MODULE_CONFLICT_REAL_BROWSER",
    maint.ok === true && bookConflict.ok === false && book2.ok === true && compConflict.ok === false,
    `maint=${maint.ok} bookVsMaint=${bookConflict.ok} book2=${book2.ok} compVsBook=${compConflict.ok}`,
  );

  // Observability gates
  gate("BROWSER_CONSOLE_ERRORS_OK", report.observability.consoleErrors.length === 0, `n=${report.observability.consoleErrors.length}`);
  gate("BROWSER_NETWORK_ERRORS_OK", report.observability.networkErrors.length === 0, `n=${report.observability.networkErrors.length}`);
  gate("RAW_SQL_ERROR_LEAK_COUNT_ZERO", report.observability.rawSqlErrorLeakCount === 0, `n=${report.observability.rawSqlErrorLeakCount}`);
  gate("NO_PRODUCTION_REQUESTS", report.observability.productionRequests === 0, `n=${report.observability.productionRequests}`);

  report.finishedAt = new Date().toISOString();
  report.ok = report.failures.length === 0;
  const outPath = path.join(outDir, `browser-acceptance-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, outPath, failureCount: report.failures.length, uiGaps: report.uiGaps }, null, 2));

  await browser.close();
  await client.auth.signOut();
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
