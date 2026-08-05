import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  athleteGenderDisplayLabel,
  getPlayerGenderKey,
  normalizeAthleteGender,
  normalizePlayer,
  normalizePlayers,
} from "../src/models/player.js";
import { normalizeProfileGender } from "../src/features/identity/utils/profileGender.js";
import { computePlayerDashboardStats } from "../src/utils/playerHelpers.js";
import {
  excludeQaTestIdentities,
  isCertifiedQaEmail,
  isConfirmedQaTestIdentity,
} from "../src/features/player/utils/qaTestIdentityFilter.js";
import { buildTournamentQuickAddPlayer } from "../src/components/tournament/buildTournamentQuickAddPlayer.js";
import {
  quarantineProductionSmokeUsers,
  resolveAuthUserEmailForQuarantine,
} from "../scripts/lib/prod-smoke-identity-hygiene.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walkSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "legacy") {
      // still scan legacy engines that are remediations targets — skip only heavy dirs
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git", "coverage"].includes(entry.name)) continue;
      walkSourceFiles(full, out);
      continue;
    }
    if (/\.(js|jsx|mjs|ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test("getPlayerGenderKey canonical contract", () => {
  assert.equal(getPlayerGenderKey("male"), "male");
  assert.equal(getPlayerGenderKey("female"), "female");
  assert.equal(getPlayerGenderKey("other"), "other");
  assert.equal(getPlayerGenderKey("Nam"), "male");
  assert.equal(getPlayerGenderKey("Nữ"), "female");
  assert.equal(getPlayerGenderKey("Khác"), "other");
  assert.equal(getPlayerGenderKey(null), null);
  assert.equal(getPlayerGenderKey(""), null);
  assert.equal(getPlayerGenderKey("unknown"), null);
  assert.equal(getPlayerGenderKey("   "), null);
  assert.equal(getPlayerGenderKey({ gender: "female" }), "female");
});

test("normalizeAthleteGender keeps engine unknown for other/null", () => {
  assert.equal(normalizeAthleteGender("Nữ"), "female");
  assert.equal(normalizeAthleteGender("Nam"), "male");
  assert.equal(normalizeAthleteGender("other"), "unknown");
  assert.equal(normalizeAthleteGender(null), "unknown");
});

test("athleteGenderDisplayLabel is Vietnamese presentation only", () => {
  assert.equal(athleteGenderDisplayLabel("male"), "Nam");
  assert.equal(athleteGenderDisplayLabel("female"), "Nữ");
  assert.equal(athleteGenderDisplayLabel("other"), "Khác");
  assert.equal(athleteGenderDisplayLabel(null), "Chưa xác định");
  assert.equal(athleteGenderDisplayLabel("Nam"), "Nam");
});

test("normalizeProfileGender writer persists only canonical values", () => {
  assert.equal(normalizeProfileGender("Nam"), "male");
  assert.equal(normalizeProfileGender("Nữ"), "female");
  assert.equal(normalizeProfileGender("Khác"), "other");
  assert.equal(normalizeProfileGender(""), null);
});

test("normalizePlayer never preserves Nam/Nữ in stored gender", () => {
  assert.equal(normalizePlayer({ id: 1, name: "A", gender: "Nam" }).gender, "male");
  assert.equal(normalizePlayer({ id: 2, name: "B", gender: "Nữ" }).gender, "female");
  assert.equal(normalizePlayer({ id: 3, name: "C", gender: "Khác" }).gender, "other");
  assert.equal(normalizePlayer({ id: 4, name: "D", gender: null }).gender, null);
});

test("QuickAdd cannot persist Nam/Nữ even if form sends Vietnamese", () => {
  const fromLegacyForm = buildTournamentQuickAddPlayer({
    name: "Guest",
    gender: "Nam",
    level: 3.5,
  });
  assert.equal(fromLegacyForm.gender, "male");
  assert.notEqual(fromLegacyForm.gender, "Nam");

  const female = buildTournamentQuickAddPlayer({
    name: "Guest Nu",
    gender: "Nữ",
    level: 3.0,
  });
  assert.equal(female.gender, "female");
  assert.notEqual(female.gender, "Nữ");

  const canonical = buildTournamentQuickAddPlayer({
    name: "Guest M",
    gender: "male",
    level: 3.0,
  });
  assert.equal(canonical.gender, "male");
});

test("dashboard female count includes canonical female and legacy Nữ", () => {
  const stats = computePlayerDashboardStats([
    { id: 1, gender: "female", level: 3 },
    { id: 2, gender: "Nữ", level: 3 },
    { id: 3, gender: "male", level: 3 },
    { id: 4, gender: "Nam", level: 3 },
    { id: 5, gender: null, level: 3 },
  ]);
  assert.equal(stats.female, 2);
  assert.equal(stats.male, 2);
  assert.equal(stats.total, 5);
});

test("null gender is not misclassified as female or male", () => {
  assert.equal(getPlayerGenderKey(null), null);
  assert.notEqual(getPlayerGenderKey(null), "female");
  assert.notEqual(getPlayerGenderKey(null), "male");
  const stats = computePlayerDashboardStats([{ id: 1, gender: null, level: 3 }]);
  assert.equal(stats.female, 0);
  assert.equal(stats.male, 0);
});

test("normalizePlayers exposes genderKey from canonical helper", () => {
  const [player] = normalizePlayers([{ id: "p1", name: "A", gender: "Nữ", level: 3 }]);
  assert.equal(player.genderKey, "female");
  assert.equal(player.gender, "female");
});

test("repository-wide guard — no active persisted gender: Nam|Nữ writers in src", () => {
  const srcRoot = path.join(root, "src");
  const files = walkSourceFiles(srcRoot);
  const persistedLiteral =
    /\bgender\s*:\s*["'](?:Nam|Nữ)["']|\bvalue\s*=\s*["'](?:Nam|Nữ)["']/;
  const offenders = [];
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    // Presentation helpers may mention Nam/Nữ as return labels — exclude those files'
    // return "Nam" patterns by focusing on gender:/value= only.
    const text = fs.readFileSync(file, "utf8");
    if (persistedLiteral.test(text)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `active Nam/Nữ writer literals remain in: ${offenders.join(", ")}`
  );
});

test("QA filter — positive certified identities", () => {
  assert.equal(
    isCertifiedQaEmail("phase1b-smoke-1@pickleball-scheduler.qa"),
    true
  );
  assert.equal(
    isCertifiedQaEmail("phase1c.prod.player.x@prod-qa.local"),
    true
  );
  assert.equal(
    isConfirmedQaTestIdentity({
      email: "phase1b-unrelated-1@pickleball-scheduler.qa",
    }),
    true
  );
});

test("QA filter — negative and near-match must not hide real users", () => {
  assert.equal(isCertifiedQaEmail("phase1b-smith@gmail.com"), false);
  assert.equal(isConfirmedQaTestIdentity({ email: "phase1b-smith@gmail.com" }), false);
  assert.equal(isCertifiedQaEmail("real@gmail.com"), false);
  assert.equal(isCertifiedQaEmail("player@prod-qa.local"), false); // wrong local pattern
  assert.equal(
    isCertifiedQaEmail("phase1c.prod.player@pickleball-scheduler.qa"),
    false
  ); // wrong domain for phase1c pattern
  assert.equal(
    isConfirmedQaTestIdentity({ name: "phase1b-smoke", email: "user@gmail.com" }),
    false
  );
  assert.equal(
    isConfirmedQaTestIdentity({ display_name: "phase1c.prod.player", email: "" }),
    false
  );
});

test("QA filter — excludeQaTestIdentities keeps real users", () => {
  const rows = [
    { id: "1", email: "real@gmail.com", name: "Real" },
    { id: "2", email: "phase1c.prod.player.x@prod-qa.local", name: "QA" },
    { id: "3", email: "phase1b-smith@gmail.com", name: "Near match" },
  ];
  const visible = excludeQaTestIdentities(rows);
  assert.equal(visible.length, 2);
  assert.deepEqual(
    visible.map((r) => r.email).sort(),
    ["phase1b-smith@gmail.com", "real@gmail.com"]
  );
});

test("smoke hygiene — Auth ban aborted without certified email (dry-run)", async () => {
  const bans = [];
  const profileUpdates = [];
  const admin = {
    auth: {
      admin: {
        async getUserById(id) {
          if (id === "real-user") {
            return { data: { user: { id, email: "phase1b-smith@gmail.com" } }, error: null };
          }
          if (id === "qa-user") {
            return {
              data: {
                user: { id, email: "phase1b-smoke-1@pickleball-scheduler.qa" },
              },
              error: null,
            };
          }
          if (id === "no-email") {
            return { data: { user: { id, email: null } }, error: null };
          }
          return { data: { user: null }, error: { message: "not found" } };
        },
        async updateUserById(id, payload) {
          bans.push({ id, payload });
          return { data: {}, error: null };
        },
      },
    },
    from() {
      return {
        update(patch) {
          return {
            eq() {
              return {
                eq() {
                  profileUpdates.push(patch);
                  return { error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const aborted = await quarantineProductionSmokeUsers({
    admin,
    userIds: ["real-user", "no-email"],
    dryRun: false,
  });
  assert.equal(aborted.every((r) => r.aborted === true), true);
  assert.equal(aborted.every((r) => r.mutations === 0), true);
  assert.equal(bans.length, 0);
  assert.equal(profileUpdates.length, 0);
  assert.equal(
    aborted.find((r) => r.userId === "real-user").abortReason,
    "email_not_certified_qa"
  );
  assert.equal(
    aborted.find((r) => r.userId === "no-email").abortReason,
    "email_absent"
  );

  const dry = await quarantineProductionSmokeUsers({
    admin,
    userIds: ["qa-user"],
    dryRun: true,
  });
  assert.equal(dry[0].aborted, false);
  assert.equal(dry[0].certified, true);
  assert.equal(dry[0].ban, "dry_run_would_ban");
  assert.equal(dry[0].mutations, 0);
  assert.equal(bans.length, 0);

  const resolved = await resolveAuthUserEmailForQuarantine({
    admin,
    userId: "qa-user",
  });
  assert.equal(resolved.ok, true);
  assert.equal(isCertifiedQaEmail(resolved.email), true);
});
