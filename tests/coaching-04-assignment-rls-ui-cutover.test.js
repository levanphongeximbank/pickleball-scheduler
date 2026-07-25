/**
 * COACHING-04 — Assignment-aware RLS, scoped permissions, runtime/UI cutover,
 * localStorage retirement design (static + unit). No SQL apply. No DB writes.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  COACHING_ACTIONS,
  COACHING_ACTION_VALUES,
  COACHING_04_ASSIGNED_ACTIONS,
  COACHING_04_ASSIGNED_ACTION_VALUES,
  isCoachingAction,
} from "../src/features/coaching/constants/actions.js";
import {
  COACHING_IDENTITY_PERMISSION_VALUES,
  COACHING_04_ASSIGNED_PERMISSION_VALUES,
  COACHING_PERMISSION_MANIFEST,
} from "../src/features/coaching/constants/permissions.js";
import { COACHING_DURABLE_RUNTIME_DEFAULT as PERSISTENCE_DEFAULT } from "../src/features/coaching/persistence/index.js";
import {
  COACHING_RUNTIME_MODE,
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
  COACHING_LEGACY_STORAGE_KEY_PREFIX,
  COACHING_04_SCOPED_PERMISSION_IDS,
  COACHING_04_PLAYER_SELF_SCOPE_STATUS,
  COACHING_UI_COLLECTIONS,
  COACHING_RUNTIME_ERROR_CODES,
  createCoachingRuntime,
  createLegacyCoachingAdapter,
  createDurableCoachingAdapter,
  getCoachingPageGateway,
  detectLegacyStore,
  classifyLegacyStore,
  buildRetirementPlan,
  assertRetirementNotActivated,
} from "../src/features/coaching/runtime/index.js";
import { COACHING_LEGACY_STORAGE_KEY_PREFIX as SERVICE_KEY_PREFIX } from "../src/features/coaching/services/coachingService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACK = path.join(ROOT, "docs/coaching-training/coaching-04");
const PAGES = path.join(ROOT, "src/pages/coaching");
const RUNTIME = path.join(ROOT, "src/features/coaching/runtime");

function readPack(name) {
  return readFileSync(path.join(PACK, name), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

const EXPECTED_PACK_FILES = [
  "00_COACHING_04_SCOPE_AND_SECURITY_MODEL.md",
  "01_COACHING_04_ASSIGNMENT_MAPPING.md",
  "02_COACHING_04_PLAYER_SELF_SCOPE_MAPPING.md",
  "03_COACHING_04_UI_CUTOVER_PLAN.md",
  "04_COACHING_04_LOCALSTORAGE_RETIREMENT_PLAN.md",
  "05_COACHING_04_ACCESS_MATRIX.md",
  "10_COACHING_04_ASSIGNMENT_HELPERS.sql",
  "20_COACHING_04_ASSIGNMENT_RLS.sql",
  "30_COACHING_04_SCOPED_RPCS.sql",
  "40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql",
  "90_COACHING_04_ROLLBACK.sql",
  "99_COACHING_04_VERIFICATION.sql",
];

const CANONICAL_TABLES = [
  "coaching_programs",
  "coaching_coach_references",
  "coaching_coach_player_relationships",
  "coaching_enrollments",
  "coaching_curricula",
  "coaching_lessons",
  "coaching_training_sessions",
  "coaching_attendance_records",
  "coaching_attendance_corrections",
  "coaching_packages",
  "coaching_package_entitlements",
  "coaching_package_usage_events",
  "coaching_evaluations",
];

const PAGE_FILES = [
  "ClassesPage.jsx",
  "CoachAttendancePage.jsx",
  "CoachEvaluationPage.jsx",
  "CoachListPage.jsx",
  "CoachPackageRegisterPage.jsx",
  "CoachPackagesPage.jsx",
  "CoachSchedulePage.jsx",
  "CoachesPage.jsx",
  "CoachingEntityPage.jsx",
  "StudentsPage.jsx",
];

const SCOPED_PERMS = [
  "coaching.assigned.read",
  "coaching.assigned.session.schedule",
  "coaching.assigned.attendance.record",
  "coaching.assigned.evaluation.submit",
  "coaching.assigned.entitlement.consume",
];

describe("COACHING-04 pack presence", () => {
  test("all pack files exist", () => {
    for (const file of EXPECTED_PACK_FILES) {
      assert.ok(existsSync(path.join(PACK, file)), `missing ${file}`);
    }
  });

  test("PLAYER self-scope mapping is blocked in docs", () => {
    const doc = readPack("02_COACHING_04_PLAYER_SELF_SCOPE_MAPPING.md");
    assert.match(doc, /COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED/);
    assert.match(doc, /auth\.uid\(\)/);
    assert.match(doc, /unproven|False \/ unproven|≠ player_id|not a Coaching SoT/i);
    assert.match(doc, /Do not seed PLAYER|no PLAYER|PLAYER.*out of scope/i);
  });
});

describe("COACHING-04 assignment helpers and RLS SQL contracts", () => {
  test("helpers bind coach_principal_id to auth.uid and fail closed", () => {
    const helpersRaw = readPack("10_COACHING_04_ASSIGNMENT_HELPERS.sql");
    const helpers = stripSqlComments(helpersRaw);
    assert.match(helpers, /CREATE OR REPLACE FUNCTION public\.coaching_04_actor_uid/);
    assert.match(
      helpers,
      /CREATE OR REPLACE FUNCTION public\.coaching_04_active_coach_reference_id/
    );
    assert.match(helpers, /coach_principal_id = auth\.uid\(\)::text/);
    assert.match(helpers, /status = 'active'/);
    assert.match(helpers, /coaching_04_coach_assigned_to_player/);
    assert.match(helpers, /coaching_04_coach_owns_session/);
    assert.match(helpers, /SET search_path = public, pg_temp/);
    assert.match(helpers, /REVOKE ALL ON FUNCTION public\.coaching_04_actor_uid/);
    assert.doesNotMatch(helpers, /profiles\.player_id/);
    assert.doesNotMatch(helpers, /CREATE OR REPLACE FUNCTION public\.coaching_04_.*player_id/i);
    assert.match(helpersRaw, /INTENTIONALLY ABSENT/);
    assert.match(helpersRaw, /COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED/);
  });

  test("additive RLS: assigned coach allowed patterns and negatives documented", () => {
    const rls = stripSqlComments(readPack("20_COACHING_04_ASSIGNMENT_RLS.sql"));
    const mapping = readPack("01_COACHING_04_ASSIGNMENT_MAPPING.md");
    assert.match(rls, /coaching_04_programs_select/);
    assert.match(rls, /coaching_04_attendance_insert/);
    assert.match(rls, /coaching_04_sessions_insert/);
    assert.match(rls, /coaching_04_evaluations_insert/);
    assert.match(rls, /coaching\.assigned\.read/);
    assert.doesNotMatch(rls, /USING\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(rls, /WITH CHECK\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(rls, /FOR DELETE/i);
    assert.doesNotMatch(rls, /DROP POLICY IF EXISTS coaching_programs_select/);
    assert.match(mapping, /inactive|revoked/i);
    assert.match(mapping, /Coach A|Coach B|another.*coach/i);
    assert.match(mapping, /other.*club|cross-player|other club\/tenant/i);
  });

  test("access matrix covers 13 tables and revoked assignment deny", () => {
    const matrix = readPack("05_COACHING_04_ACCESS_MATRIX.md");
    for (const table of CANONICAL_TABLES) {
      assert.match(matrix, new RegExp(table));
    }
    assert.match(matrix, /revoked|inactive/i);
    assert.match(matrix, /RPC-only|RPC only/i);
    assert.match(matrix, /PLAYER.*BLOCKED|self-scope.*BLOCKED|blocked \/ N/i);
  });

  test("scoped RPCs: fixed search_path, no PUBLIC/anon, actor = auth.uid", () => {
    const rpc = stripSqlComments(readPack("30_COACHING_04_SCOPED_RPCS.sql"));
    assert.match(rpc, /coaching_04_record_assigned_attendance/);
    assert.match(rpc, /coaching_04_submit_assigned_evaluation/);
    assert.match(rpc, /coaching_04_consume_assigned_entitlement/);
    assert.match(rpc, /SET search_path = public, pg_temp/);
    assert.match(rpc, /auth\.uid\(\)/);
    assert.match(rpc, /REVOKE ALL[\s\S]*FROM PUBLIC/);
    assert.doesNotMatch(rpc, /GRANT EXECUTE[\s\S]*TO anon/i);
    assert.doesNotMatch(rpc, /p_actor_id/);
  });

  test("rollback covers only COACHING-04 objects", () => {
    const rollback = stripSqlComments(readPack("90_COACHING_04_ROLLBACK.sql"));
    assert.match(rollback, /DROP POLICY IF EXISTS coaching_04_/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.coaching_04_/);
    assert.doesNotMatch(rollback, /DROP TABLE public\.coaching_/);
    assert.doesNotMatch(rollback, /DROP FUNCTION IF EXISTS public\.coaching_02_/);
  });

  test("verification coverage and no true policies", () => {
    const verification = readPack("99_COACHING_04_VERIFICATION.sql");
    assert.match(verification, /coaching_04_active_coach_reference_id/);
    assert.match(verification, /bare TRUE|USING\/CHECK true|qual.*true/i);
    assert.match(verification, /PUBLIC|anon/);
    assert.match(verification, /PLAYER/);
  });
});

describe("COACHING-04 permissions proposal", () => {
  test("scoped catalog complete; no broad records.read for COACH; no PLAYER grants", () => {
    const proposalRaw = readPack(
      "40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql"
    );
    const proposal = stripSqlComments(proposalRaw);
    for (const perm of SCOPED_PERMS) {
      assert.match(proposal, new RegExp(perm.replace(/\./g, "\\.")));
    }
    assert.deepEqual([...COACHING_04_SCOPED_PERMISSION_IDS], SCOPED_PERMS);
    assert.deepEqual([...COACHING_04_ASSIGNED_PERMISSION_VALUES], SCOPED_PERMS);
    assert.match(proposal, /role_id = 'COACH'|SELECT 'COACH'/);
    assert.doesNotMatch(
      proposal,
      /INSERT INTO public\.role_permissions[\s\S]*coaching\.records\.read[\s\S]*COACH/
    );
    assert.doesNotMatch(proposal, /role_id = 'PLAYER'|SELECT 'PLAYER'/);
    assert.match(proposalRaw, /COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED/);
  });

  test("proposal and rollback synchronized on five permissions", () => {
    const proposal = readPack("40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql");
    const rollback = readPack("90_COACHING_04_ROLLBACK.sql");
    for (const perm of SCOPED_PERMS) {
      assert.match(proposal, new RegExp(perm.replace(/\./g, "\\.")));
      assert.match(rollback, new RegExp(perm.replace(/\./g, "\\.")));
    }
  });

  test("canonical 14 admin actions unchanged; assigned actions additive", () => {
    assert.equal(COACHING_ACTION_VALUES.length, 14);
    assert.equal(COACHING_IDENTITY_PERMISSION_VALUES.length, 14);
    assert.equal(COACHING_04_ASSIGNED_ACTION_VALUES.length, 5);
    assert.ok(isCoachingAction(COACHING_ACTIONS.RECORDS_READ));
    assert.ok(isCoachingAction(COACHING_04_ASSIGNED_ACTIONS.ASSIGNED_READ));
    assert.equal(COACHING_PERMISSION_MANIFEST.playerSelfScopeBlocked, true);
    assert.equal(
      COACHING_PERMISSION_MANIFEST.coaching04.playerSelfScopeStatus,
      COACHING_04_PLAYER_SELF_SCOPE_STATUS
    );
  });
});

describe("COACHING-04 runtime and UI cutover", () => {
  test("runtime default disabled; no silent durable→legacy fallback", () => {
    assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
    assert.equal(PERSISTENCE_DEFAULT, false);
    assert.equal(LOCALSTORAGE_RETIRED, false);

    const defaultRuntime = createCoachingRuntime();
    assert.equal(defaultRuntime.mode, COACHING_RUNTIME_MODE.LEGACY);
    assert.equal(defaultRuntime.isDurable, false);

    const durable = createCoachingRuntime({
      mode: COACHING_RUNTIME_MODE.DURABLE,
      // missing injectors → fail closed, not legacy
    });
    assert.equal(durable.mode, COACHING_RUNTIME_MODE.DURABLE);
    assert.equal(durable.isLegacy, false);
  });

  test("durable missing scope fails closed and does not call legacy", async () => {
    const runtime = createCoachingRuntime({
      mode: COACHING_RUNTIME_MODE.DURABLE,
      resolveTenantClub: () => ({ tenantId: "", clubId: "" }),
      resolveActor: () => ({ actorId: "actor-1" }),
    });
    const result = await runtime.listCollection("coaches", "club-1");
    assert.equal(result.ok, false);
    assert.equal(result.code, COACHING_RUNTIME_ERROR_CODES.MISSING_SCOPE);
  });

  test("durable missing actor fails closed", async () => {
    const runtime = createCoachingRuntime({
      mode: COACHING_RUNTIME_MODE.DURABLE,
      resolveTenantClub: () => ({ tenantId: "t1", clubId: "c1" }),
      resolveActor: () => ({ actorId: "" }),
    });
    const result = await runtime.listCollection("packages", "c1");
    assert.equal(result.ok, false);
    assert.equal(result.code, COACHING_RUNTIME_ERROR_CODES.MISSING_ACTOR);
  });

  test("durable adapter never imports coachingService (source)", () => {
    const durableSrc = readFileSync(
      path.join(RUNTIME, "createDurableCoachingAdapter.js"),
      "utf8"
    );
    assert.doesNotMatch(durableSrc, /from\s+['"].*coachingService/);
    assert.doesNotMatch(durableSrc, /localStorage\.(getItem|setItem|removeItem)/);
    const legacySrc = readFileSync(
      path.join(RUNTIME, "createLegacyCoachingAdapter.js"),
      "utf8"
    );
    assert.match(legacySrc, /from\s+['"].*coachingService/);
  });

  test("legacy adapter list/save roundtrip via memory storage shim", () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
    const adapter = createLegacyCoachingAdapter();
    const save = adapter.save("coaches", "club-x", {
      name: "HLV A",
      specialty: "singles",
    });
    assert.equal(save.ok, true);
    const list = adapter.list("coaches", "club-x");
    assert.equal(list.ok, true);
    assert.ok(list.data.length >= 1);
    delete globalThis.localStorage;
  });

  test("authorization denied and concurrency conflict codes exist", () => {
    assert.ok(COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED);
    assert.ok(COACHING_RUNTIME_ERROR_CODES.CONCURRENCY_CONFLICT);
    assert.ok(COACHING_RUNTIME_ERROR_CODES.MISSING_SCOPE);
  });

  test("all pages use runtime boundary; no direct coachingService import", () => {
    for (const file of PAGE_FILES) {
      const src = readFileSync(path.join(PAGES, file), "utf8");
      assert.doesNotMatch(
        src,
        /from\s+['"].*services\/coachingService/
      );
      assert.doesNotMatch(
        src,
        /listCoaches|saveCoach|deleteCoach|listStudents|listClasses|listAttendance|listEvaluations|listPackages|listSchedule/
      );
      if (file === "CoachingEntityPage.jsx") {
        assert.match(src, /useCoachingCollection/);
        assert.match(src, /loading|denied|CONCURRENCY_CONFLICT/);
      } else if (
        file === "CoachListPage.jsx" ||
        file === "CoachPackageRegisterPage.jsx"
      ) {
        assert.match(src, /useCoachingCollection/);
      } else {
        assert.match(src, /collection=/);
      }
    }
  });

  test("page gateway exists and exposes collections", () => {
    const gateway = getCoachingPageGateway();
    assert.ok(gateway);
    assert.equal(typeof gateway.listCollection, "function");
    assert.equal(typeof gateway.saveCollection, "function");
    assert.equal(typeof gateway.deleteCollection, "function");
    assert.equal(gateway.durableRuntimeDefault, false);
    assert.equal(gateway.localStorageRetired, false);
    assert.deepEqual([...COACHING_UI_COLLECTIONS].sort(), [
      "attendance",
      "classes",
      "coaches",
      "evaluations",
      "packages",
      "schedule",
      "students",
    ]);
  });

  test("durable createDurableCoachingAdapter fails closed without deps", async () => {
    const adapter = createDurableCoachingAdapter({});
    const result = await adapter.list("packages", "c1");
    assert.equal(result.ok, false);
    assert.equal(result.code, COACHING_RUNTIME_ERROR_CODES.MISSING_SCOPE);
  });
});

describe("COACHING-04 localStorage retirement design", () => {
  test("legacy key still exists before final gate; retirement not activated", () => {
    assert.equal(SERVICE_KEY_PREFIX, "pickleball-coaching-v1");
    assert.equal(COACHING_LEGACY_STORAGE_KEY_PREFIX, "pickleball-coaching-v1");
    assert.equal(LOCALSTORAGE_RETIRED, false);
    assert.equal(assertRetirementNotActivated(), true);
    assert.ok(
      existsSync(
        path.join(ROOT, "src/features/coaching/services/coachingService.js")
      )
    );
  });

  test("retirement requires explicit confirmation; no silent upload/delete", () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
    store.set(
      "pickleball-coaching-v1::club-1",
      JSON.stringify({
        coaches: [{ id: "c1", name: "User Coach" }],
        students: [],
        classes: [],
        schedule: [],
        packages: [],
        attendance: [],
        evaluations: [],
      })
    );
    const detected = detectLegacyStore("club-1");
    assert.ok(detected);
    assert.equal(classifyLegacyStore(detected), "user-created");
    assert.equal(classifyLegacyStore({ coaches: [], students: [], classes: [], schedule: [], packages: [], attendance: [], evaluations: [] }), "empty");
    assert.equal(
      classifyLegacyStore({
        coaches: [{ id: "demo-1", name: "demo-coach" }],
        students: [],
        classes: [],
        schedule: [],
        packages: [],
        attendance: [],
        evaluations: [],
      }),
      "demo"
    );

    const unconfirmed = buildRetirementPlan({ clubId: "club-1", confirmed: false });
    assert.equal(unconfirmed.ok, false);
    assert.equal(unconfirmed.activated, false);
    assert.equal(unconfirmed.silentUpload, false);

    const confirmed = buildRetirementPlan({ clubId: "club-1", confirmed: true });
    assert.equal(confirmed.ok, false);
    assert.equal(confirmed.activated, false);
    assert.equal(confirmed.localStorageRetired, false);
    assert.equal(confirmed.silentUpload, false);
    assert.ok(store.has("pickleball-coaching-v1::club-1"));

    delete globalThis.localStorage;
  });

  test("no new direct localStorage consumers outside legacy adapter/service", () => {
    const runtimeFiles = readdirSync(RUNTIME).filter((f) => f.endsWith(".js"));
    for (const file of runtimeFiles) {
      if (file === "createLegacyCoachingAdapter.js") continue;
      if (file === "localStorageRetirement.js") continue;
      const src = readFileSync(path.join(RUNTIME, file), "utf8");
      assert.doesNotMatch(src, /localStorage\.(getItem|setItem|removeItem)/);
    }
    for (const file of PAGE_FILES) {
      const src = readFileSync(path.join(PAGES, file), "utf8");
      assert.doesNotMatch(src, /localStorage/);
    }
  });
});

describe("COACHING-04 PLAYER self-scope contract", () => {
  test("status constant and proposal absence of PLAYER grants", () => {
    assert.equal(
      COACHING_04_PLAYER_SELF_SCOPE_STATUS,
      "COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED"
    );
    const helpers = readPack("10_COACHING_04_ASSIGNMENT_HELPERS.sql");
    const proposal = readPack(
      "40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql"
    );
    assert.match(helpers, /COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED/);
    assert.match(proposal, /COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED/);
    assert.doesNotMatch(
      stripSqlComments(proposal),
      /INSERT INTO public\.role_permissions[\s\S]{0,200}PLAYER/
    );
  });
});

describe("COACHING-04 safety markers", () => {
  test("docs declare no apply / defaults off", () => {
    const scope = readPack("00_COACHING_04_SCOPE_AND_SECURITY_MODEL.md");
    assert.match(scope, /AUTHORED|do not apply|Owner GO/i);
    assert.match(readPack("03_COACHING_04_UI_CUTOVER_PLAN.md"), /COACHING_DURABLE_RUNTIME_DEFAULT.*false|false.*durable/i);
    assert.match(
      readPack("04_COACHING_04_LOCALSTORAGE_RETIREMENT_PLAN.md"),
      /LOCALSTORAGE_RETIRED.*false|false.*LOCALSTORAGE_RETIRED/i
    );
  });
});
