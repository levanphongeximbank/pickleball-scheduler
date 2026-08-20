import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  extractProsrc,
  md5Utf8,
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
  assert.match(CERT, /RPC_EXISTING_BLOCKED_BODY_MISMATCH_COUNT=2/);
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

test("blocked RPCs source MD5 does not match live and remain UNCERTIFIED", () => {
  for (const row of BLOCKED) {
    const sql = fs.readFileSync(row.source, "utf8");
    const extracted = extractProsrc(sql, row.name);
    assert.ok(extracted && !extracted.error, row.name);
    assert.notEqual(extracted.md5, row.liveMd5, row.name);
    assert.match(APPLY, new RegExp(`'${row.name}'[\\s\\S]{0,500}'UNCERTIFIED'`));
    assert.match(CERT, /BLOCKED_BODY_MISMATCH/);
    assert.match(INVENTORY, new RegExp(`${row.name}[\\s\\S]{0,200}BLOCKED_BODY_MISMATCH`));
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
  assert.match(APPLY, /certified_fp = 'UNCERTIFIED'/);
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

test("Wave5 APPLY future bodies are not certification authority for existing RPCs", () => {
  for (const row of CERTIFIED) {
    const future = extractProsrc(APPLY, row.name);
    assert.ok(future && !future.error, row.name);
    assert.notEqual(
      future.md5,
      row.md5,
      `${row.name} future APPLY body must differ from certified pre-overwrite source`
    );
  }
});
