import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  extractProsrc,
  md5Utf8,
  normalizeStructuralSql,
  WAVE5_EXISTING_RPC_TRANSITIONS,
} from "../scripts/wave5-rpc-prosrc-fingerprint.mjs";

const SQL_DIR = path.join(
  process.cwd(),
  "docs/platform-core-wave5-club-context-closure/sql-design"
);
const CERT = fs.readFileSync(
  path.join(SQL_DIR, "08B_RPC_FINGERPRINT_CERTIFICATION.md"),
  "utf8"
);
const APPLY = fs.readFileSync(path.join(SQL_DIR, "02_APPLY_DESIGN.sql"), "utf8");
const INVENTORY = fs.readFileSync(
  path.join(SQL_DIR, "08_RPC_OVERWRITE_GUARD_INVENTORY.md"),
  "utf8"
);

const CERTIFIED = [
  {
    name: "phase42_club_canonical",
    sig: "public.phase42_club_canonical(text)",
    source: "docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql",
    md5: "871ff5136397a42f5c5718179b65aed9",
    lang: "plpgsql",
    vol: "s",
  },
  {
    name: "club_list_members",
    sig: "public.club_list_members(text)",
    source: "docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql",
    md5: "3089518678635910041656a1ae30cacd",
    lang: "plpgsql",
    vol: "v",
  },
  {
    name: "phase42_can_update_club",
    sig: "public.phase42_can_update_club(text)",
    source: "docs/v5/phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql",
    md5: "24f9f7e47c2dc0a166c6385811f6c43d",
    lang: "sql",
    vol: "s",
  },
  {
    name: "phase42_can_assign_club_owner",
    sig: "public.phase42_can_assign_club_owner(text)",
    source: "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql",
    md5: "509ea5949fa8389edd1c4827e1bf5779",
    lang: "sql",
    vol: "s",
  },
  {
    name: "phase42_can_transfer_president",
    sig: "public.phase42_can_transfer_president(text)",
    source: "docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql",
    md5: "24f9f7e47c2dc0a166c6385811f6c43d",
    lang: "sql",
    vol: "s",
  },
  {
    name: "club_add_member",
    sig: "public.club_add_member(uuid,text,uuid,text,integer)",
    source: "docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql",
    md5: "922df1b5d672f70150ae4010bb97bed0",
    lang: "plpgsql",
    vol: "v",
  },
  {
    name: "club_restore_member",
    sig: "public.club_restore_member(uuid,text,uuid,integer)",
    source: "docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql",
    md5: "d24dbfa3f21e674f31ad509c655a7ef6",
    lang: "plpgsql",
    vol: "v",
  },
  {
    name: "club_review_membership_request",
    sig: "public.club_review_membership_request(uuid,uuid,text,text,integer)",
    source: "docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql",
    md5: "0b8ee11ef23090f8cd6e364ad2e6eb60",
    lang: "plpgsql",
    vol: "v",
  },
];

const BLOCKED = [
  {
    name: "club_create",
    source: "docs/v5/PHASE_42G_CLUB_CREATE_OWNER.sql",
    liveMd5: "cb9669f04a35e9b60242a5d3b18a5b27",
  },
  {
    name: "club_list_registry",
    source: "docs/v5/PHASE_42C_RLS_RPC.sql",
    liveMd5: "214cb6e88de6f2d9d0e55e1f33c6e582",
  },
];

test("extractor self-validation: plpgsql + sql + dollar-quote bodies", () => {
  const plpgsql = `
create or replace function public.demo_plpgsql(p text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $body$
begin
  return p;
end;
$body$;
`;
  const sqlFn = `
create or replace function public.demo_sql(p text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p is not null
$$;
`;
  const a = extractProsrc(plpgsql, "demo_plpgsql");
  const b = extractProsrc(sqlFn, "demo_sql");
  assert.equal(a.lang, "plpgsql");
  assert.equal(a.volatility, "s");
  assert.equal(a.prosecdef, true);
  assert.equal(a.body.includes("begin"), true);
  assert.equal(a.body.includes("$body$"), false);
  assert.equal(a.body.includes("\r"), false);
  assert.equal(a.bodyStagingCrlf.includes("\r\n"), true);
  assert.equal(a.md5, md5Utf8(a.bodyStagingCrlf));
  assert.equal(a.md5GitLf, md5Utf8(a.body));
  assert.equal(b.lang, "sql");
  assert.equal(b.volatility, "s");
  assert.match(b.body, /select p is not null/);
  assert.equal(b.body.includes("$$"), false);
});

test("extractor is newline-canonical across CRLF and LF working trees", () => {
  const lf = `create or replace function public.demo_nl(p text)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  return p;
end;
$$;`;
  const crlf = lf.replace(/\n/g, "\r\n");
  const a = extractProsrc(lf, "demo_nl");
  const b = extractProsrc(crlf, "demo_nl");
  assert.equal(a.md5, b.md5);
  assert.equal(a.md5GitLf, b.md5GitLf);
  assert.equal(a.body, b.body);
});

test("certification set is exactly 10 existing + 3 new expected-absent", () => {
  assert.match(CERT, /RPC_EXISTING_REQUIRED_COUNT=10/);
  assert.match(CERT, /RPC_EXISTING_CERTIFIED_MATCH_COUNT=8/);
  assert.match(CERT, /RPC_EXISTING_OWNER_ACCEPTANCE_REQUIRED_COUNT=2/);
  assert.match(CERT, /RPC_EXISTING_BLOCKED_BODY_MISMATCH_COUNT=0/);
  assert.match(CERT, /RPC_NEW_EXPECTED_ABSENT_COUNT=3/);
  assert.match(CERT, /RPC_NEW_LIVE_PRESENT_COUNT=0/);
  assert.match(CERT, /LIVE_HASH_IS_AUTHORITY=NO/);
  assert.match(INVENTORY, /EXISTING_RPC_OVERWRITE_GUARD_COUNT=10/);
  assert.match(INVENTORY, /NEW_WAVE5_FUNCTION_GUARD_COUNT=3/);
});

test("each CERTIFIED_MATCH RPC has source-derived MD5 matching APPLY guard", () => {
  for (const row of CERTIFIED) {
    const sql = fs.readFileSync(row.source, "utf8");
    const extracted = extractProsrc(sql, row.name);
    assert.ok(extracted && !extracted.error, row.name);
    assert.equal(extracted.md5, row.md5, row.name);
    assert.equal(extracted.lang, row.lang, row.name);
    assert.equal(extracted.volatility, row.vol, row.name);
    assert.equal(extracted.prosecdef, true, row.name);
    assert.match(extracted.searchPath || "", /public/i);
    assert.match(
      APPLY,
      new RegExp(`'${row.name}'[\\s\\S]{0,500}'${row.md5}'`)
    );
    assert.match(APPLY, new RegExp(`'${row.name}'[\\s\\S]{0,500}'postgres'`));
    assert.match(
      APPLY,
      new RegExp(`'${row.name}'[\\s\\S]{0,500}'${row.vol}'`)
    );
    assert.match(CERT, new RegExp(row.sig.replace(/[()]/g, "\\$&")));
    assert.match(CERT, /CERTIFIED_MATCH/);
    assert.match(INVENTORY, new RegExp(`${row.name}[\\s\\S]{0,400}CERTIFIED_MATCH`));
  }
});

test("live-only RPCs keep predecessor != target and require Owner acceptance", () => {
  for (const row of BLOCKED) {
    const sql = fs.readFileSync(row.source, "utf8");
    const extracted = extractProsrc(sql, row.name);
    assert.ok(extracted && !extracted.error, row.name);
    assert.notEqual(extracted.md5, row.liveMd5, row.name);
    const future = extractProsrc(APPLY, row.name);
    assert.ok(future && !future.error, row.name);
    assert.notEqual(future.md5GitLf, row.liveMd5, `${row.name} target must not copy live predecessor`);
    assert.match(APPLY, new RegExp(`'${row.name}'[\\s\\S]{0,500}'${row.liveMd5}'`));
    assert.match(
      APPLY,
      /OWNER_ACCEPTANCE_REQUIRED_CAPTURED_LIVE_EQUIVALENT/
    );
    assert.match(CERT, /OWNER_ACCEPTANCE_REQUIRED_CAPTURED_LIVE_EQUIVALENT/);
    assert.match(
      INVENTORY,
      new RegExp(`${row.name}[\\s\\S]{0,400}OWNER_ACCEPTANCE_REQUIRED_CAPTURED_LIVE_EQUIVALENT`)
    );
    assert.match(CERT, /RPC_EXISTING_BLOCKED_BODY_MISMATCH_COUNT=0/);
  }
});

test("live hash is never treated as source authority in docs", () => {
  assert.match(CERT, /LIVE_HASH_IS_AUTHORITY=NO/);
  assert.match(CERT, /REPO_CANONICAL_SOURCE_IS_AUTHORITY=YES/);
  assert.match(INVENTORY, /LIVE_HASH_IS_AUTHORITY=NO/);
  assert.match(APPLY, /LIVE_HASH_IS_AUTHORITY=NO/);
  assert.match(APPLY, /APPROVED_FINGERPRINT_SOURCE=AUTHORITATIVE_REPOSITORY_FUNCTION_BODY/);
  assert.doesNotMatch(APPLY, /LIVE_HASH_IS_AUTHORITY=YES/);
});

test("APPLY aborts on UNCERTIFIED / owner / volatility / fingerprint drift", () => {
  assert.match(APPLY, /WAVE5_APPLY_ABORT_RPC_BODY_DRIFT/);
  assert.match(APPLY, /OWNER_REVIEW_REQUIRED/);
  assert.match(APPLY, /predecessor_fp = 'UNCERTIFIED'/);
  assert.match(APPLY, /unknown\/untrusted SECURITY DEFINER owner|live_owner=%/);
  assert.match(APPLY, /overload_count=%/);
  assert.match(APPLY, /v_overload <> 1/);
});

test("new Wave5 functions remain expected-absent pre-APPLY", () => {
  for (const name of [
    "platform_is_canonical_tenant_entitled",
    "wave5_resolve_club_facility_venue_id",
    "wave5_ensure_athlete_for_club_member",
  ]) {
    assert.match(CERT, new RegExp(name));
    assert.match(CERT, /EXPECTED_ABSENT=PASS/);
  }
  assert.match(APPLY, /NEW_WAVE5_FUNCTION_EXPECTED_ABSENT_OR_CERTIFIED/);
});

test("Wave5 APPLY future bodies are not predecessor authority for existing RPCs", () => {
  for (const row of CERTIFIED) {
    const future = extractProsrc(APPLY, row.name);
    assert.ok(future && !future.error, row.name);
    assert.notEqual(
      future.md5GitLf,
      row.md5,
      `${row.name} APPLY target must differ from certified predecessor`
    );
  }
});

const VERIFY = fs.readFileSync(path.join(SQL_DIR, "03_VERIFY.sql"), "utf8");

const LIVE_REGISTRY = `
declare v_rows jsonb;
begin
  if auth.uid() is null then return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.'); end if;
  select coalesce(jsonb_agg(public.phase42_club_canonical(c.id) order by c.name), '[]'::jsonb) into v_rows
  from public.clubs c
  where c.deleted_at is null
    and (p_tenant_id is null or c.tenant_id = p_tenant_id)
    and (p_include_inactive or c.status = 'active')
    and (public.phase42_is_platform_super_admin() or public.phase42_is_tenant_member(c.tenant_id));
  return json_build_object('ok', true, 'data', v_rows);
end;
`;

test("two-state predecessor vs target catalog covers all 10 existing RPCs", () => {
  assert.equal(WAVE5_EXISTING_RPC_TRANSITIONS.length, 10);
  const ownerReq = WAVE5_EXISTING_RPC_TRANSITIONS.filter(
    (r) =>
      r.predecessorAuthority ===
      "OWNER_ACCEPTANCE_REQUIRED_CAPTURED_LIVE_EQUIVALENT"
  );
  const hist = WAVE5_EXISTING_RPC_TRANSITIONS.filter(
    (r) => r.predecessorAuthority === "CERTIFIED_HISTORICAL_SOURCE_MATCH"
  );
  assert.equal(hist.length, 8);
  assert.equal(ownerReq.length, 2);
  assert.deepEqual(
    ownerReq.map((r) => r.name).sort(),
    ["club_create", "club_list_registry"]
  );
  for (const row of WAVE5_EXISTING_RPC_TRANSITIONS) {
    assert.notEqual(row.predecessorMd5, row.targetMd5Lf, row.name);
    assert.match(CERT, new RegExp(row.predecessorMd5));
    assert.match(CERT, new RegExp(row.targetMd5Lf));
    assert.match(APPLY, new RegExp(`'${row.name}'[\\s\\S]{0,800}'${row.predecessorMd5}'`));
    assert.match(APPLY, new RegExp(row.targetMd5Lf));
    const future = extractProsrc(APPLY, row.name);
    assert.equal(future.md5GitLf, row.targetMd5Lf, row.name);
  }
});

test("pre-APPLY uses predecessor hash and post-APPLY uses target hash", () => {
  assert.match(APPLY, /PRE_APPLY_GUARD=PREDECESSOR/);
  assert.match(APPLY, /POST_APPLY_VERIFY=TARGET/);
  assert.match(APPLY, /APPROVED_PREDECESSOR_PROSRC_MD5/);
  assert.match(APPLY, /APPROVED_TARGET_PROSRC_MD5/);
  assert.match(VERIFY, /POST_APPLY_VERIFY=TARGET/);
  assert.match(VERIFY, /Never assert predecessor hashes here/);
  assert.match(CERT, /PREDECESSOR_AND_TARGET_FINGERPRINTS_DISTINCTLY_NAMED=YES/);
  assert.doesNotMatch(APPLY, /APPROVED_CANONICAL_MD5=cb9669f04a35e9b60242a5d3b18a5b27/);
  assert.doesNotMatch(APPLY, /APPROVED_CANONICAL_MD5=214cb6e88de6f2d9d0e55e1f33c6e582/);
  assert.match(APPLY, /v_live_fp IS DISTINCT FROM v_guard\.predecessor_fp/);
  assert.match(APPLY, /OWNER_ACCEPTANCE_REQUIRED_CAPTURED_LIVE_PREDECESSOR/);
  assert.match(APPLY, /APPLY_EXECUTION_NOT_ENABLED=YES/);
});

test("historical source match is required for automatic certification", () => {
  assert.match(CERT, /HISTORICAL_SOURCE_NOT_FOUND=YES/);
  assert.match(CERT, /LIVE_ONLY_NO_HISTORICAL_SOURCE/);
  assert.match(CERT, /CLUB_CREATE_HISTORICAL_EXACT_BODY_FOUND=NO/);
  assert.match(CERT, /CLUB_LIST_REGISTRY_HISTORICAL_EXACT_BODY_FOUND=NO/);
  assert.match(CERT, /OWNER_ACCEPTANCE_REQUIRED=YES/);
});

test("live-only equivalent body requires Owner acceptance and does not enable APPLY", () => {
  assert.match(CERT, /STAGING_CUTOVER_EXECUTION_READY=NO_PENDING_OWNER_PREDECESSOR_ACCEPTANCE/);
  assert.match(CERT, /WAVE5_APPLY_READINESS_ALL_10_CERTIFIED_MATCH=NO/);
  const createRow = APPLY.match(
    /'club_create'[\s\S]{0,400}OWNER_ACCEPTANCE_REQUIRED_CAPTURED_LIVE_EQUIVALENT/
  );
  assert.ok(createRow);
});

test("security / data-integrity / unknown semantic difference classifications remain blocking vocabulary", () => {
  assert.match(CERT, /BLOCKED_SECURITY_DIFFERENCE/);
  assert.match(CERT, /BLOCKED_DATA_INTEGRITY_DIFFERENCE/);
  assert.match(CERT, /BLOCKED_SEMANTIC_DIFFERENCE/);
  assert.match(CERT, /BLOCKED_UNKNOWN_PROVENANCE/);
  assert.match(CERT, /OWNER_ACCEPTANCE_REQUIRED_CAPTURED_LIVE_EQUIVALENT/);
  const allowed = [
    "CERTIFIED_HISTORICAL_SOURCE_MATCH",
    "CERTIFIED_DEPLOYMENT_ARTIFACT_MATCH",
    "OWNER_ACCEPTANCE_REQUIRED_CAPTURED_LIVE_EQUIVALENT",
    "BLOCKED_SEMANTIC_DIFFERENCE",
    "BLOCKED_SECURITY_DIFFERENCE",
    "BLOCKED_DATA_INTEGRITY_DIFFERENCE",
    "BLOCKED_UNKNOWN_PROVENANCE",
  ];
  for (const row of WAVE5_EXISTING_RPC_TRANSITIONS) {
    assert.equal(allowed.includes(row.predecessorAuthority), true, row.name);
  }
});

test("club_create semantic checklist is documented", () => {
  for (const concern of [
    "authentication",
    "Tenant",
    "entitlement",
    "club.create",
    "plan",
    "idempotency",
    "duplicate",
    "registered_cluster",
    "INSERT",
    "tenant_id",
    "membership",
    "club_owner",
    "president",
    "Super Admin",
    "profiles.role",
    "profiles.club_id",
    "version",
    "audit",
    "exception",
    "transaction",
    "security",
    "ASCII_FOLDED_RUNTIME_LITERAL_IMPACT=HUMAN_MESSAGE_ONLY",
  ]) {
    assert.match(CERT, new RegExp(concern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("club_list_registry semantic checklist and formatting proof", () => {
  const src = fs.readFileSync("docs/v5/PHASE_42C_RLS_RPC.sql", "utf8");
  const body = extractProsrc(src, "club_list_registry");
  assert.equal(normalizeStructuralSql(body.body), normalizeStructuralSql(LIVE_REGISTRY));
  assert.match(CERT, /REGISTRY_LIVE_DIFF=FORMATTING_ONLY/);
  assert.match(CERT, /p_tenant_id/);
  assert.match(CERT, /p_include_inactive/);
  assert.match(CERT, /phase42_is_tenant_member/);
  assert.match(CERT, /platform_is_canonical_tenant_entitled/);
  assert.match(CERT, /deleted_at/);
  assert.match(CERT, /phase42_club_canonical/);
  const applyBody = extractProsrc(APPLY, "club_list_registry");
  assert.equal(applyBody.body.includes("platform_is_canonical_tenant_entitled"), true);
  assert.equal(applyBody.body.includes("phase42_is_tenant_member"), false);
});

test("eight previous certifications and three expected-absent remain unchanged", () => {
  for (const row of CERTIFIED) {
    assert.match(CERT, new RegExp(row.md5));
    assert.match(CERT, /CERTIFIED_MATCH/);
  }
  assert.match(CERT, /RPC_NEW_EXPECTED_ABSENT_COUNT=3/);
  assert.match(CERT, /RPC_NEW_LIVE_PRESENT_COUNT=0/);
});

test("service_role cutover guard comments remain intact in APPLY package", () => {
  assert.match(APPLY, /APPLY_PRELOCK_SERVICE_ROLE_DIRECT_DML=DENIED/);
  assert.doesNotMatch(APPLY, /ALTER\s+ROLE\s+service_role/i);
});
