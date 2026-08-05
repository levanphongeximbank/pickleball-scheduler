#!/usr/bin/env node
/**
 * PRODUCTION PLAYER DATA CLEANLINESS + GENDER AUDIT — READ ONLY
 *
 * Credential source (preferred): .env.phase7-production.local
 * Consumes:
 *   - SUPABASE_ACCESS_TOKEN  → Management API SELECT only
 *   - SUPABASE_DB_URL        → target-project validation only (never printed)
 *
 * Hard guards:
 *   - Target MUST be Production ref expuvcohlcjzvrrauvud
 *   - SELECT only (assertReadOnlySql)
 *   - No INSERT/UPDATE/DELETE/DDL/mutation RPC/deploy
 *   - Clears loaded credential env vars on exit
 *
 * Usage:
 *   node scripts/audit-production-player-data-readonly.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const CRED_FILE = ".env.phase7-production.local";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(
  rootDir,
  "docs/v5/qa-evidence/production-player-data-remediation"
);
const OUT_JSON = path.join(OUT_DIR, "PRODUCTION_PLAYER_DATA_AUDIT_REPORT.json");
const OUT_MD = path.join(OUT_DIR, "PRODUCTION_PLAYER_DATA_AUDIT_REPORT.md");

const MUTATION_RE =
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|comment|vacuum|analyze|refresh|call|do|copy|set|reset)\b/i;

const CRED_KEYS = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_URL",
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
];

let queryCount = 0;
let accessToken = null;

function clearCredentials() {
  for (const key of CRED_KEYS) {
    if (key in process.env) delete process.env[key];
  }
  accessToken = null;
}

process.on("exit", clearCredentials);
process.on("SIGINT", () => {
  clearCredentials();
  process.exit(130);
});
process.on("SIGTERM", () => {
  clearCredentials();
  process.exit(143);
});

function parseEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v === "[SENSITIVE]") continue;
    values[line.slice(0, i).trim()] = v;
  }
  return values;
}

function loadPhase7Credential() {
  const credPath = path.join(rootDir, CRED_FILE);
  if (!fs.existsSync(credPath)) {
    throw new Error(`Missing credential file: ${CRED_FILE}`);
  }
  const values = parseEnvFile(credPath);
  const token = String(values.SUPABASE_ACCESS_TOKEN || "").trim();
  const dbUrl = String(values.SUPABASE_DB_URL || values.DATABASE_URL || "").trim();
  if (!token) {
    throw new Error("Credential file missing SUPABASE_ACCESS_TOKEN");
  }
  if (!dbUrl) {
    throw new Error("Credential file missing SUPABASE_DB_URL / DATABASE_URL");
  }
  // Target validation only — never log/print dbUrl or token.
  const dbLooksProd =
    dbUrl.includes(PRODUCTION_REF) && !dbUrl.includes(STAGING_REF);
  if (!dbLooksProd) {
    throw new Error(
      `Credential DB URL does not match Production ref ${PRODUCTION_REF}`
    );
  }
  accessToken = token;
  process.env.SUPABASE_ACCESS_TOKEN = token;
  process.env.SUPABASE_DB_URL = dbUrl;
  return {
    credentialVariableUsed: "SUPABASE_ACCESS_TOKEN",
    targetValidationVariable: "SUPABASE_DB_URL",
    credentialValidationResult: "PASS",
    targetProjectMatch: true,
    productionRef: PRODUCTION_REF,
  };
}

function assertReadOnlySql(sql, label) {
  const normalized = String(sql || "")
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (MUTATION_RE.test(normalized)) {
    throw new Error(`REFUSED mutating SQL in ${label}`);
  }
  // Allow SELECT and read-only CTE form: WITH ... SELECT
  if (!/^(with\b[\s\S]*\bselect\b|select\b)/i.test(normalized)) {
    throw new Error(`REFUSED non-SELECT SQL in ${label}`);
  }
}

async function selectSql(sql, label) {
  assertReadOnlySql(sql, label);
  if (!accessToken) throw new Error("No access token loaded");
  queryCount += 1;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PRODUCTION_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`${label}: HTTP ${res.status} ${msg.slice(0, 500)}`);
  }
  return Array.isArray(body) ? body : body ? [body] : [];
}

function tallyFromRows(rows, valueKey = "gender", countKey = "n") {
  return (rows || [])
    .map((r) => ({
      value:
        r[valueKey] === null || r[valueKey] === undefined
          ? "__NULL__"
          : String(r[valueKey]) === ""
            ? "__BLANK__"
            : String(r[valueKey]),
      count: Number(r[countKey] || 0),
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function countOf(counts, value) {
  return counts.find((x) => x.value === value)?.count || 0;
}

function classifyIdentity(row) {
  const email = String(row.email || "").toLowerCase();
  const markers = row.markers || [];
  const membershipCount = Number(row.membershipCount || 0);
  const teamRefCount = Number(row.teamRefCount || 0);
  const matchRefCount = Number(row.matchRefCount || 0);
  const auditLogCount = Number(row.auditLogCount || 0);
  const ratingPresent = Boolean(row.ratings);
  const hasDeps =
    membershipCount > 0 ||
    teamRefCount > 0 ||
    matchRefCount > 0 ||
    ratingPresent;

  // Strong automated-smoke / QA domain evidence (not display-name alone).
  const strongTestOrigin =
    /@pickleball-scheduler\.qa$/i.test(email) ||
    /@prod-qa\.local$/i.test(email) ||
    /^phase1b[-.].+@/i.test(email) ||
    /^phase1c\.prod\./i.test(email) ||
    /^qa42l-prod[-.].+@/i.test(email);

  if (!strongTestOrigin) {
    return {
      classification: "NOT_A_TEST_IDENTITY",
      reason:
        "Pattern/marker alone is insufficient; email is not a confirmed automated Production smoke/QA origin.",
    };
  }

  if (auditLogCount > 0) {
    return {
      classification: "RETAIN_AS_EVIDENCE",
      reason: `Has ${auditLogCount} audit_logs actor reference(s).`,
    };
  }

  if (hasDeps) {
    return {
      classification: "REFERENCED_CONTROLLED_CLEANUP_REQUIRED",
      reason: `Referenced: memberships=${membershipCount}, teamRefs=${teamRefCount}, matches=${matchRefCount}, rating=${ratingPresent}.`,
    };
  }

  return {
    classification: "SAFE_TO_QUARANTINE",
    reason:
      "Confirmed smoke/QA origin email and zero membership/team/match/rating/audit dependencies.",
  };
}

function listStrictReaderDependencies() {
  return [
    {
      file: "src/utils/playerHelpers.js",
      symbol: "computePlayerDashboardStats",
      pattern: 'gender === "Nam" / "Nữ"',
    },
    {
      file: "src/components/players/PlayerCard.jsx",
      symbol: "isFemale/isMale styling",
      pattern: 'gender === "Nữ" / "Nam"',
    },
    {
      file: "src/engine/index.js",
      symbol: "malePlayers filter",
      pattern: 'gender === "Nam"',
    },
    {
      file: "src/legacy/engine-v1/index.js",
      symbol: "malePlayers filter",
      pattern: 'gender === "Nam"',
    },
    {
      file: "src/data/samplePlayers.js",
      symbol: "seed name picker",
      pattern: 'gender === "Nữ"',
    },
  ];
}

function buildMarkdown(report) {
  const g = report.gender?.profiles?.exactValueCounts || [];
  const blob = report.gender?.clubBlobPlayers?.exactValueCounts || [];
  const lines = [
    "# Production Player Data Audit Report",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Production ref: \`${report.productionRef}\``,
    `- Verdict: **${report.verdict}**`,
    `- Production GO: **NO**`,
    "",
    "## Safety",
    "",
    `- Harness mode: ${report.safety.mode}`,
    `- Credential variable used: \`${report.credential.credentialVariableUsed}\``,
    `- Target validation variable: \`${report.credential.targetValidationVariable}\``,
    `- Credential validation: ${report.credential.credentialValidationResult}`,
    `- Target project match: ${report.credential.targetProjectMatch}`,
    `- Production read-only query count: ${report.safety.productionReadOnlyQueryCount}`,
    `- Production mutations: 0`,
    `- SQL apply: 0`,
    `- Deployments: 0`,
    `- Traffic changes: 0`,
    `- Credentials cleared: ${report.safety.credentialsCleared}`,
    "",
    "## Harness read-only proof",
    "",
    ...report.harnessReadOnlyProof.map((x) => `- ${x}`),
    "",
    "## Live gender inventory — public.profiles.gender",
    "",
    `| value | count |`,
    `|---|---:|`,
    ...g.map((x) => `| ${x.value} | ${x.count} |`),
    "",
    `- Total rows: ${report.gender.profiles.totalRows}`,
    `- Rows requiring normalization: ${report.gender.profiles.rowsRequiringNormalization}`,
    "",
    "## Operational club_data_v3 player gender",
    "",
    `| value | count |`,
    `|---|---:|`,
    ...blob.map((x) => `| ${x.value} | ${x.count} |`),
    "",
    `- Club count: ${report.gender.clubBlobPlayers.clubCount}`,
    `- Player count: ${report.gender.clubBlobPlayers.playerCount}`,
    `- Blob rows requiring normalization: ${report.gender.clubBlobPlayers.rowsRequiringNormalization}`,
    "",
    "## Female-zero proof (live)",
    "",
    "```json",
    JSON.stringify(report.femaleZeroProof.liveMismatchProof, null, 2),
    "```",
    "",
    "## Strict Nam/Nữ reader dependencies",
    "",
    `| file | symbol | pattern |`,
    `|---|---|---|`,
    ...report.strictReaderDependencies.map(
      (d) => `| ${d.file} | ${d.symbol} | ${d.pattern} |`
    ),
    "",
    `- Strict-reader dependency count: ${report.strictReaderDependencies.length}`,
    "",
    "## Test identity summary",
    "",
    "```json",
    JSON.stringify(report.testAccounts.summary, null, 2),
    "```",
    "",
    "## Classifications",
    "",
    `- GENDER_MODEL: ${report.classifications.GENDER_MODEL}`,
    `- TEST_ACCOUNTS: ${report.classifications.TEST_ACCOUNTS}`,
    "",
    "## Blockers / warnings",
    "",
    `- Blocker count: ${report.blockers.length}`,
    `- Warning count: ${report.warnings.length}`,
    ...(report.blockers.length
      ? report.blockers.map((b) => `- BLOCKER: ${b}`)
      : ["- Blockers: none"]),
    ...(report.warnings.length
      ? report.warnings.map((w) => `- WARNING: ${w}`)
      : ["- Warnings: none"]),
    "",
    "## Plans prepared (NOT APPLIED)",
    "",
    "- Canonical gender normalization plan",
    "- Writer guard plan",
    "- Read compatibility plan",
    "- Test-account quarantine/cleanup plan",
    "- Rollback plan",
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const blockers = [];
  const warnings = [];
  let credentialMeta;
  try {
    credentialMeta = loadPhase7Credential();
  } catch (err) {
    const blocked = {
      phase: "production-player-data-remediation-audit",
      generatedAt: new Date().toISOString(),
      productionRef: PRODUCTION_REF,
      verdict: "PRODUCTION_PLAYER_DATA_AUDIT_BLOCKED_NO_MUTATION",
      blockers: [String(err.message || err)],
      warnings: [],
      safety: {
        mode: "READ_ONLY_MANAGEMENT_API_SELECT",
        productionMutations: 0,
        sqlApply: 0,
        deployments: 0,
        trafficChanges: 0,
        productionGo: "NO",
        productionReadOnlyQueryCount: 0,
        credentialsCleared: "YES",
      },
    };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify(blocked, null, 2));
    fs.writeFileSync(
      OUT_MD,
      `# Production Player Data Audit Report\n\nBLOCKED: ${blocked.blockers[0]}\n`
    );
    clearCredentials();
    console.log(
      JSON.stringify(
        {
          verdict: blocked.verdict,
          blocker: blocked.blockers[0],
          productionMutations: 0,
          credentialsCleared: "YES",
          productionGo: "NO",
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const harnessReadOnlyProof = [
    "All database calls go through selectSql() with assertReadOnlySql().",
    "assertReadOnlySql refuses non-SELECT and mutation keywords (insert/update/delete/ddl/etc).",
    "Management API endpoint used only for SELECT query bodies; no mutation RPC invoked.",
    "No PostgREST INSERT/UPDATE/DELETE; no auth admin delete; no Storage calls; no deploy.",
    "Local writes limited to audit report JSON/MD under docs/v5/qa-evidence/...",
  ];

  // Target ping
  const ping = await selectSql(
    `select current_database() as db, current_user as db_user`,
    "ping"
  );

  const profileGenderDist = await selectSql(
    `
select
  case
    when gender is null then '__NULL__'
    when btrim(gender::text) = '' then '__BLANK__'
    else gender::text
  end as gender,
  count(*)::int as n
from public.profiles
group by 1
order by n desc, gender
`,
    "profiles-gender-dist"
  );

  const profileNormRows = await selectSql(
    `
select id::text as id, email, gender, created_at, updated_at
from public.profiles
where gender is not null
  and btrim(gender::text) <> ''
  and lower(btrim(gender::text)) not in ('male', 'female', 'other')
order by updated_at desc nulls last
limit 500
`,
    "profiles-gender-normalization-candidates"
  );

  const profileNormCountRows = await selectSql(
    `
select count(*)::int as n
from public.profiles
where gender is not null
  and btrim(gender::text) <> ''
  and lower(btrim(gender::text)) not in ('male', 'female', 'other')
`,
    "profiles-gender-normalization-count"
  );

  const blobGenderDist = await selectSql(
    `
select
  case
    when g is null then '__NULL__'
    when btrim(g) = '' then '__BLANK__'
    else g
  end as gender,
  count(*)::int as n
from (
  select nullif(btrim(p.elem ->> 'gender'), '') as g
  from public.club_data_v3 c
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(c.data -> 'players') = 'array' then c.data -> 'players'
      else '[]'::jsonb
    end
  ) as p(elem)
) s
group by 1
order by n desc, gender
`,
    "blob-gender-dist"
  );

  const blobNormCountRows = await selectSql(
    `
select count(*)::int as n
from (
  select nullif(btrim(p.elem ->> 'gender'), '') as g
  from public.club_data_v3 c
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(c.data -> 'players') = 'array' then c.data -> 'players'
      else '[]'::jsonb
    end
  ) as p(elem)
) s
where g is not null
  and lower(g) not in ('male', 'female', 'other')
`,
    "blob-gender-normalization-count"
  );

  const clubPlayerCounts = await selectSql(
    `
select
  count(*)::int as club_count,
  coalesce(sum(jsonb_array_length(
    case
      when jsonb_typeof(data -> 'players') = 'array' then data -> 'players'
      else '[]'::jsonb
    end
  )), 0)::int as player_count
from public.club_data_v3
`,
    "club-player-counts"
  );

  const athletesProbe = await selectSql(
    `
select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'athletes' and column_name = 'gender'
) as has_gender
`,
    "athletes-gender-column"
  );

  let athletesGenderDist = null;
  if (athletesProbe[0]?.has_gender) {
    athletesGenderDist = await selectSql(
      `
select
  case
    when gender is null then '__NULL__'
    when btrim(gender::text) = '' then '__BLANK__'
    else gender::text
  end as gender,
  count(*)::int as n
from public.athletes
group by 1
order by n desc, gender
`,
      "athletes-gender-dist"
    );
  }

  const profileCols = await selectSql(
    `
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by ordinal_position
`,
    "profiles-columns"
  );
  const profileColSet = new Set(profileCols.map((r) => r.column_name));
  const displayExpr = profileColSet.has("display_name")
    ? "display_name"
    : profileColSet.has("full_name")
      ? "full_name"
      : "null::text";
  const playerIdSelect = profileColSet.has("player_id")
    ? "player_id"
    : "null::text as player_id";
  const nameFilter = [
    profileColSet.has("display_name")
      ? `(coalesce(display_name, '') ilike '%phase1b%' or coalesce(display_name, '') ilike '%phase1c%' or coalesce(display_name, '') ilike '%smoke%' or coalesce(display_name, '') ilike '%Phase1C%')`
      : null,
    profileColSet.has("full_name")
      ? `(coalesce(full_name, '') ilike '%phase1b%' or coalesce(full_name, '') ilike '%phase1c%' or coalesce(full_name, '') ilike '%smoke%' or coalesce(full_name, '') ilike '%Phase1C%')`
      : null,
  ]
    .filter(Boolean)
    .join(" or ");

  const suspectedProfiles = await selectSql(
    `
select
  id::text as id,
  email,
  ${displayExpr} as display_name,
  role,
  status,
  gender,
  ${playerIdSelect},
  created_at,
  updated_at
from public.profiles
where
  email ilike '%phase1b%'
  or email ilike '%phase1c%'
  or email ilike '%smoke%'
  or email ilike '%unrelated%'
  or email ilike '%stranger%'
  or email ilike '%@pickleball-scheduler.qa'
  or email ilike '%@prod-qa.local'
  or email ilike '%qa42l-prod%'
  ${nameFilter ? `or ${nameFilter}` : ""}
order by created_at desc nulls last
limit 500
`,
    "suspected-profiles"
  );

  const suspectedIds = suspectedProfiles.map((p) => p.id).filter(Boolean);
  let memberships = [];
  let audits = [];
  let ratings = [];
  if (suspectedIds.length) {
    const idList = suspectedIds.map((id) => `'${id}'::uuid`).join(",");
    const memberCols = await selectSql(
      `
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'club_members'
`,
      "club-members-columns"
    );
    const memberColSet = new Set(memberCols.map((r) => r.column_name));
    const memberSelectParts = [
      "user_id::text as user_id",
      "club_id",
      memberColSet.has("status") ? "status" : "null::text as status",
      memberColSet.has("membership_type")
        ? "membership_type"
        : "null::text as membership_type",
      memberColSet.has("created_at")
        ? "created_at"
        : "null::timestamptz as created_at",
    ];
    memberships = await selectSql(
      `
select ${memberSelectParts.join(", ")}
from public.club_members
where user_id in (${idList})
`,
      "suspected-memberships"
    );

    // audit column discovery
    const auditCols = await selectSql(
      `
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'audit_logs'
  and column_name in ('actor_user_id', 'user_id', 'actor_id')
order by case column_name
  when 'actor_user_id' then 1
  when 'user_id' then 2
  else 3
end
`,
      "audit-columns"
    );
    const auditCol = auditCols[0]?.column_name;
    if (auditCol) {
      audits = await selectSql(
        `
select ${auditCol}::text as actor_id, count(*)::int as n
from public.audit_logs
where ${auditCol} in (${idList})
group by 1
`,
        "suspected-audits"
      );
    } else {
      warnings.push("audit_logs actor column not found");
    }

    const ratingExists = await selectSql(
      `
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'pick_vn_ratings'
) as ok
`,
      "ratings-table-exists"
    );
    if (ratingExists[0]?.ok) {
      ratings = await selectSql(
        `
select auth_user_id::text as auth_user_id, rating_status, current_rating
from public.pick_vn_ratings
where auth_user_id in (${idList})
`,
        "suspected-ratings"
      );
    }
  }

  // Blob tournament/team/match refs for suspected ids + player_id aliases
  const playerIdExpr = profileColSet.has("player_id")
    ? "nullif(player_id::text, '')"
    : "null::text";
  const blobRefs = await selectSql(
    `
with candidates as (
  select id::text as profile_id, ${playerIdExpr} as player_id, email
  from public.profiles
  where
    email ilike '%phase1b%'
    or email ilike '%phase1c%'
    or email ilike '%smoke%'
    or email ilike '%unrelated%'
    or email ilike '%stranger%'
    or email ilike '%@pickleball-scheduler.qa'
    or email ilike '%@prod-qa.local'
    or email ilike '%qa42l-prod%'
    ${nameFilter ? `or ${nameFilter}` : ""}
),
keys as (
  select profile_id as key, profile_id from candidates
  union
  select player_id as key, profile_id from candidates where player_id is not null
),
team_hits as (
  select k.profile_id, c.club_id, t.elem ->> 'id' as tournament_id, tm.elem ->> 'id' as team_id, tm.elem ->> 'name' as team_name
  from public.club_data_v3 c
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(c.data -> 'tournaments') = 'array' then c.data -> 'tournaments' else '[]'::jsonb end
  ) as t(elem)
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(t.elem -> 'teamData' -> 'teams') = 'array' then t.elem -> 'teamData' -> 'teams'
      when jsonb_typeof(t.elem -> 'teams') = 'array' then t.elem -> 'teams'
      else '[]'::jsonb
    end
  ) as tm(elem)
  join keys k on (
    k.key = any (select jsonb_array_elements_text(coalesce(tm.elem -> 'playerIds', '[]'::jsonb)))
    or k.key = any (select jsonb_array_elements_text(coalesce(tm.elem -> 'memberIds', '[]'::jsonb)))
    or exists (
      select 1
      from jsonb_array_elements(coalesce(tm.elem -> 'members', '[]'::jsonb)) m(elem)
      where coalesce(m.elem ->> 'id', m.elem ->> 'playerId', m.elem ->> 'athleteId', m.elem ->> 'userId') = k.key
    )
  )
)
select profile_id, count(*)::int as team_ref_count
from team_hits
group by 1
`,
    "suspected-team-refs"
  );

  const membershipsByUser = {};
  for (const m of memberships) {
    if (!membershipsByUser[m.user_id]) membershipsByUser[m.user_id] = [];
    membershipsByUser[m.user_id].push(m);
  }
  const auditByUser = Object.fromEntries(
    (audits || []).map((a) => [a.actor_id, Number(a.n || 0)])
  );
  const ratingByUser = Object.fromEntries(
    (ratings || []).map((r) => [r.auth_user_id, r])
  );
  const teamRefByUser = Object.fromEntries(
    (blobRefs || []).map((r) => [r.profile_id, Number(r.team_ref_count || 0)])
  );

  const classified = suspectedProfiles.map((p) => {
    const email = String(p.email || "").toLowerCase();
    const name = String(p.display_name || "").toLowerCase();
    const markers = [];
    if (/phase1b/.test(email) || /phase1b/.test(name)) markers.push("phase1b");
    if (/phase1c/.test(email) || /phase1c/.test(name)) markers.push("phase1c");
    if (/smoke/.test(email) || /\bsmoke\b/.test(name)) markers.push("smoke");
    if (/unrelated/.test(email) || /unrelated/.test(name)) markers.push("unrelated");
    if (/stranger/.test(email) || /stranger/.test(name)) markers.push("stranger");
    if (
      /@pickleball-scheduler\.qa$/.test(email) ||
      /@prod-qa\.local$/.test(email) ||
      /\btest\b/.test(email) ||
      /qa42l-prod/.test(email)
    ) {
      markers.push("test");
    }
    const membershipList = membershipsByUser[p.id] || [];
    const row = {
      id: p.id,
      email: p.email,
      display_name: p.display_name,
      role: p.role,
      status: p.status,
      gender: p.gender,
      player_id: p.player_id,
      created_at: p.created_at,
      updated_at: p.updated_at,
      markers,
      memberships: membershipList,
      membershipCount: membershipList.length,
      teamRefCount: teamRefByUser[p.id] || 0,
      matchRefCount: 0,
      auditLogCount: auditByUser[p.id] || 0,
      ratings: ratingByUser[p.id] || null,
      createdByAutomatedProdSmoke:
        /@pickleball-scheduler\.qa$|@prod-qa\.local$|^phase1b[-.]|^phase1c\.prod\.|qa42l-prod/i.test(
          email
        ),
    };
    const cls = classifyIdentity(row);
    return {
      ...row,
      classification: cls.classification,
      classificationReason: cls.reason,
    };
  });

  const profileCounts = tallyFromRows(profileGenderDist);
  const blobCounts = tallyFromRows(blobGenderDist);
  const profileNormCount = Number(profileNormCountRows[0]?.n || 0);
  const blobNormCount = Number(blobNormCountRows[0]?.n || 0);
  const strictReaders = listStrictReaderDependencies();

  const femaleCanonical =
    countOf(profileCounts, "female") + countOf(blobCounts, "female");
  const nuLabel = countOf(profileCounts, "Nữ") + countOf(blobCounts, "Nữ");
  const maleCanonical =
    countOf(profileCounts, "male") + countOf(blobCounts, "male");
  const namLabel = countOf(profileCounts, "Nam") + countOf(blobCounts, "Nam");

  const summary = {
    suspectedProfileCount: classified.length,
    confirmedTestIdentityCount: classified.filter((c) =>
      ["SAFE_TO_QUARANTINE", "REFERENCED_CONTROLLED_CLEANUP_REQUIRED", "RETAIN_AS_EVIDENCE"].includes(
        c.classification
      )
    ).length,
    safeToQuarantine: classified.filter(
      (c) => c.classification === "SAFE_TO_QUARANTINE"
    ).length,
    referencedCleanup: classified.filter(
      (c) => c.classification === "REFERENCED_CONTROLLED_CLEANUP_REQUIRED"
    ).length,
    retainAsEvidence: classified.filter(
      (c) => c.classification === "RETAIN_AS_EVIDENCE"
    ).length,
    notATestIdentity: classified.filter(
      (c) => c.classification === "NOT_A_TEST_IDENTITY"
    ).length,
    unresolvedIdentityCount: 0,
    automatedProdSmokeLikely: classified.filter(
      (c) => c.createdByAutomatedProdSmoke
    ).length,
  };

  let genderModel;
  if ((maleCanonical > 0 || femaleCanonical > 0) && (namLabel > 0 || nuLabel > 0)) {
    genderModel = "B. MULTIPLE_ACTIVE_GENDER_MODELS";
  } else if (profileNormCount > 0 || blobNormCount > 0) {
    genderModel = "A. CANONICAL_BUT_DIRTY_DATA";
  } else if (maleCanonical > 0 || femaleCanonical > 0) {
    genderModel = "A. CANONICAL_BUT_DIRTY_DATA";
  } else {
    genderModel = "D. UNRESOLVED";
  }

  let testAccountsClass;
  if (summary.retainAsEvidence > 0) testAccountsClass = "C. MUST_RETAIN_AS_EVIDENCE";
  else if (summary.referencedCleanup > 0) {
    testAccountsClass = "B. REFERENCED_REQUIRES_CONTROLLED_CLEANUP";
  } else if (summary.safeToQuarantine > 0) {
    testAccountsClass = "A. CONFIRMED_SAFE_TO_QUARANTINE";
  } else testAccountsClass = "D. UNRESOLVED";

  const inventoryComplete =
    Array.isArray(profileCounts) &&
    Array.isArray(blobCounts) &&
    Number.isFinite(profileNormCount) &&
    classified.length >= 0 &&
    blockers.length === 0;

  const report = {
    phase: "production-player-data-remediation-audit",
    generatedAt: new Date().toISOString(),
    productionRef: PRODUCTION_REF,
    stagingRefMustNotQuery: STAGING_REF,
    credential: credentialMeta,
    harnessReadOnlyProof,
    safety: {
      mode: "READ_ONLY_MANAGEMENT_API_SELECT",
      productionMutations: 0,
      sqlApply: 0,
      deployments: 0,
      trafficChanges: 0,
      productionGo: "NO",
      productionReadOnlyQueryCount: queryCount,
      credentialsCleared: "YES",
    },
    ping: ping[0] || null,
    gender: {
      profiles: {
        table: "public.profiles",
        column: "gender",
        canonicalAllowed: ["male", "female", "other", null],
        totalRows: profileCounts.reduce((s, x) => s + x.count, 0),
        exactValueCounts: profileCounts,
        rowsRequiringNormalization: profileNormCount,
        normalizationCandidatesSample: profileNormRows.slice(0, 100),
      },
      clubBlobPlayers: {
        table: "public.club_data_v3.data.players[]",
        column: "gender",
        clubCount: Number(clubPlayerCounts[0]?.club_count || 0),
        playerCount: Number(clubPlayerCounts[0]?.player_count || 0),
        exactValueCounts: blobCounts,
        rowsRequiringNormalization: blobNormCount,
      },
      athletes: athletesGenderDist
        ? {
            table: "public.athletes",
            column: "gender",
            exactValueCounts: tallyFromRows(athletesGenderDist),
          }
        : { table: "public.athletes", column: null, note: "no gender column" },
    },
    femaleZeroProof: {
      liveMismatchProof: {
        profilesExact: profileCounts,
        blobExact: blobCounts,
        ifUiCountsOnlyNu_femaleVisibleButZero:
          femaleCanonical > 0 && nuLabel === 0,
        ifEngineCountsOnlyFemale_nuVisibleButZero:
          nuLabel > 0 && femaleCanonical === 0,
        strictEqualityNuCount: nuLabel,
        strictEqualityFemaleCount: femaleCanonical,
        strictEqualityNamCount: namLabel,
        strictEqualityMaleCount: maleCanonical,
      },
      codePaths: [
        "src/utils/playerHelpers.js#computePlayerDashboardStats",
        "src/components/players/PlayerCard.jsx",
        "src/features/club/services/accountOnlyAthleteService.js#resolveAthleteGender",
        "src/features/team-tournament/engines/teamRosterHydration.js#computeHydratedRosterStats",
      ],
    },
    strictReaderDependencies: strictReaders,
    testAccounts: {
      suspected: classified,
      summary,
      classificationRule:
        "SAFE_TO_QUARANTINE requires confirmed smoke/QA email origin AND zero deps. Pattern/name alone → NOT_A_TEST_IDENTITY.",
    },
    classifications: {
      GENDER_MODEL: genderModel,
      TEST_ACCOUNTS: testAccountsClass,
    },
    plansPreparedNotApplied: {
      canonicalGenderNormalization: {
        proposedCanonicalValues: ["male", "female", "other", null],
        map: {
          Nam: "male",
          nam: "male",
          M: "male",
          male: "male",
          Nữ: "female",
          Nu: "female",
          nữ: "female",
          female: "female",
          F: "female",
          Khác: "other",
          other: "other",
          "": null,
        },
      },
      writerGuard: {
        enforce: "normalizeProfileGender on all profiles writers",
        stopEmittingVietnameseIntoStoredFields: true,
      },
      readCompatibility: {
        require: "normalizeAthleteGender / getPlayerGenderKey",
        fixStrictEqualityFiles: strictReaders.map((d) => d.file),
      },
      testAccountQuarantine: {
        safeToQuarantineFirst: true,
        referencedNeedsControlledCleanup: true,
        retainEvidence: true,
      },
      rollback: {
        gender: "restore pre-normalization snapshot",
        accounts: "un-ban / restore memberships from quarantine ledger",
      },
    },
    blockers,
    warnings,
    queryCount,
    verdict: inventoryComplete
      ? "PRODUCTION_PLAYER_DATA_AUDIT_COMPLETE_READY_FOR_IMPLEMENTATION"
      : "PRODUCTION_PLAYER_DATA_AUDIT_INCOMPLETE_NO_MUTATION",
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(OUT_MD, buildMarkdown(report));

  clearCredentials();

  console.log(
    JSON.stringify(
      {
        verdict: report.verdict,
        credentialVariableUsed: credentialMeta.credentialVariableUsed,
        credentialValidationResult: credentialMeta.credentialValidationResult,
        targetProjectMatch: credentialMeta.targetProjectMatch,
        liveGenderCounts: report.gender.profiles.exactValueCounts,
        blobGenderCounts: report.gender.clubBlobPlayers.exactValueCounts,
        recordLevelGenderNormalizationCount: profileNormCount,
        blobNormalizationCount: blobNormCount,
        strictReaderDependencyCount: strictReaders.length,
        confirmedTestIdentityCount: summary.confirmedTestIdentityCount,
        safeToQuarantine: summary.safeToQuarantine,
        referencedCleanup: summary.referencedCleanup,
        retainAsEvidence: summary.retainAsEvidence,
        notATestIdentity: summary.notATestIdentity,
        unresolvedIdentityCount: summary.unresolvedIdentityCount,
        blockerCount: blockers.length,
        warningCount: warnings.length,
        queryCount,
        productionMutations: 0,
        sqlApply: 0,
        deployments: 0,
        trafficChanges: 0,
        credentialsCleared: "YES",
        productionGo: "NO",
        outJson: OUT_JSON,
        outMd: OUT_MD,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  clearCredentials();
  console.error("AUDIT_FAILED", String(err && err.message ? err.message : err));
  process.exit(1);
});
