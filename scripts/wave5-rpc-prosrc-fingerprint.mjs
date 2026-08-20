#!/usr/bin/env node
/**
 * Deterministic pg_proc.prosrc extractor + MD5 for Wave5 RPC fingerprint certification.
 *
 * Repository sources are git-LF. Staging live prosrc for these Club RPCs was
 * observed with CRLF (\r\n) deploy newlines (equal CR and LF counts).
 *
 * APPROVED_SOURCE_PROSRC_MD5 for Staging APPLY guards is:
 *   md5(UTF-8 bytes of CRLF deploy-form body)
 * derived by:
 *   1) extract dollar-quoted body
 *   2) canonicalize newlines to LF
 *   3) expand LF → CRLF (deterministic Windows/psql deploy form)
 *   4) md5
 *
 * Equivalent to live: md5(convert_to(pg_proc.prosrc, 'UTF8')) when live uses CRLF.
 * LIVE_HASH_IS_AUTHORITY=NO — hash is derived from repository source + documented transform.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function md5Utf8(s) {
  return crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
}

/** Strip BOM; normalize all newlines to LF. */
export function canonicalizeNewlinesToLf(text) {
  return String(text)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

/**
 * Deterministic deploy-form transform observed on Staging for these RPCs.
 * Git sources are LF; live pg_proc.prosrc uses CRLF.
 */
export function toStagingProsrcNewlines(bodyLf) {
  return canonicalizeNewlinesToLf(bodyLf).replace(/\n/g, "\r\n");
}

/** Structural SQL compare (predicates/joins), ignoring comment/whitespace/paren spacing. */
export function normalizeStructuralSql(s) {
  return canonicalizeNewlinesToLf(s)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),;])\s*/g, "$1")
    .trim()
    .toLowerCase();
}

/**
 * Extract the first public.<name>(...) function body from SQL source.
 * @param {string} sql
 * @param {string} functionName exact proname
 */
export function extractProsrc(sql, functionName) {
  const re = new RegExp(
    String.raw`create\s+or\s+replace\s+function\s+public\.${functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\s*\(`,
    "i"
  );
  const m = re.exec(sql);
  if (!m) return null;

  const startSearch = m.index + m[0].length;
  const nextCreate = sql.slice(startSearch).search(/create\s+or\s+replace\s+function/i);
  const windowEnd = nextCreate >= 0 ? startSearch + nextCreate : sql.length;
  const window = sql.slice(m.index, windowEnd);

  const asDq = /\bas\s+(\$([A-Za-z_]*)\$)/i.exec(window);
  if (!asDq) {
    return { error: "NO_DOLLAR_QUOTE_BODY", functionName };
  }
  const tagInner = asDq[2];
  const closer = `$${tagInner}$`;
  const bodyStartInWindow = asDq.index + asDq[0].length;
  const bodyStart = m.index + bodyStartInWindow;
  const end = sql.indexOf(closer, bodyStart);
  if (end < 0) {
    return { error: "UNCLOSED_DOLLAR_QUOTE", functionName };
  }
  const bodyRaw = sql.slice(bodyStart, end);
  const bodyLf = canonicalizeNewlinesToLf(bodyRaw);
  const bodyStagingCrlf = toStagingProsrcNewlines(bodyLf);
  const header = window.slice(0, asDq.index);

  const langMatch = header.match(/\blanguage\s+(\w+)/i);
  const lang = langMatch ? langMatch[1].toLowerCase() : null;
  const prosecdef = /security\s+definer/i.test(header);
  const spMatch = header.match(/set\s+search_path\s*(?:to|=)\s*([^;\r\n]+)/i);
  const searchPath = spMatch ? spMatch[1].trim().replace(/;+\s*$/, "") : null;

  let volatility = null;
  let volatilityDerivedDefault = false;
  if (/\bimmutable\b/i.test(header)) volatility = "i";
  else if (/\bstable\b/i.test(header)) volatility = "s";
  else if (/\bvolatile\b/i.test(header)) volatility = "v";
  else {
    volatility = "v";
    volatilityDerivedDefault = true;
  }

  return {
    body: bodyLf,
    bodyStagingCrlf,
    md5: md5Utf8(bodyStagingCrlf), // APPROVED_SOURCE_PROSRC_MD5 for Staging live form
    md5GitLf: md5Utf8(bodyLf),
    lang,
    prosecdef,
    searchPath,
    volatility,
    volatilityDerivedDefault,
    bodyLen: bodyStagingCrlf.length,
    bodyLfLen: bodyLf.length,
    headerSnippet: header.slice(0, 240).replace(/\s+/g, " ").trim(),
  };
}

/**
 * Two-state model:
 * APPROVED_PREDECESSOR_PROSRC_MD5 = exact live Staging md5(convert_to(prosrc,'UTF8'))
 * APPROVED_TARGET_PROSRC_MD5 = newline-canonical LF md5 of Wave5 APPLY CREATE body
 * LIVE_HASH_IS_AUTHORITY=NO — live hash is predecessor evidence only.
 */
export const WAVE5_EXISTING_RPC_TRANSITIONS = [
  {
    name: "phase42_club_canonical",
    sig: "public.phase42_club_canonical(text)",
    predecessorAuthority: "CERTIFIED_HISTORICAL_SOURCE_MATCH",
    predecessorSource: "docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql",
    predecessorMd5: "871ff5136397a42f5c5718179b65aed9",
    targetSource: "docs/platform-core-wave5-club-context-closure/sql-design/02_APPLY_DESIGN.sql",
    targetMd5Lf: "1dccf73c5ee25b96376371e1f89a9dac",
    lang: "plpgsql",
    vol: "s",
  },
  {
    name: "club_create",
    sig: "public.club_create(uuid,text,text,text,text,text)",
    predecessorAuthority: "OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR",
    predecessorSource: null,
    predecessorMd5: "cb9669f04a35e9b60242a5d3b18a5b27",
    lineageSource: "docs/v5/PHASE_42G_CLUB_CREATE_OWNER.sql",
    lineageMd5Crlf: "a99c4c6f5021d29142229aeba4c49315",
    targetSource: "docs/platform-core-wave5-club-context-closure/sql-design/02_APPLY_DESIGN.sql",
    targetMd5Lf: "e847c5d23e51370fe4ef1360efbaa10a",
    lang: "plpgsql",
    vol: "v",
  },
  {
    name: "club_list_registry",
    sig: "public.club_list_registry(text,boolean)",
    predecessorAuthority: "OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR",
    predecessorSource: null,
    predecessorMd5: "214cb6e88de6f2d9d0e55e1f33c6e582",
    lineageSource: "docs/v5/PHASE_42C_RLS_RPC.sql",
    lineageMd5Crlf: "b8dc3e51123e4205c1f61ad19ffda555",
    targetSource: "docs/platform-core-wave5-club-context-closure/sql-design/02_APPLY_DESIGN.sql",
    targetMd5Lf: "202fef07f6859107971329412b8beb3b",
    lang: "plpgsql",
    vol: "v",
  },
  {
    name: "club_list_members",
    sig: "public.club_list_members(text)",
    predecessorAuthority: "CERTIFIED_HISTORICAL_SOURCE_MATCH",
    predecessorSource: "docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql",
    predecessorMd5: "3089518678635910041656a1ae30cacd",
    targetSource: "docs/platform-core-wave5-club-context-closure/sql-design/02_APPLY_DESIGN.sql",
    targetMd5Lf: "a497610e6d2d905fe02b7aa2b67724ea",
    lang: "plpgsql",
    vol: "v",
  },
  {
    name: "phase42_can_update_club",
    sig: "public.phase42_can_update_club(text)",
    predecessorAuthority: "CERTIFIED_HISTORICAL_SOURCE_MATCH",
    predecessorSource: "docs/v5/phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql",
    predecessorMd5: "24f9f7e47c2dc0a166c6385811f6c43d",
    targetSource: "docs/platform-core-wave5-club-context-closure/sql-design/02_APPLY_DESIGN.sql",
    targetMd5Lf: "969ce4b24e48632045ae75f4e8b9ca14",
    lang: "sql",
    vol: "s",
  },
  {
    name: "phase42_can_assign_club_owner",
    sig: "public.phase42_can_assign_club_owner(text)",
    predecessorAuthority: "CERTIFIED_HISTORICAL_SOURCE_MATCH",
    predecessorSource: "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql",
    predecessorMd5: "509ea5949fa8389edd1c4827e1bf5779",
    targetSource: "docs/platform-core-wave5-club-context-closure/sql-design/02_APPLY_DESIGN.sql",
    targetMd5Lf: "17491a5d3df2b96da44f5bececdb257e",
    lang: "sql",
    vol: "s",
  },
  {
    name: "phase42_can_transfer_president",
    sig: "public.phase42_can_transfer_president(text)",
    predecessorAuthority: "CERTIFIED_HISTORICAL_SOURCE_MATCH",
    predecessorSource: "docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql",
    predecessorMd5: "24f9f7e47c2dc0a166c6385811f6c43d",
    targetSource: "docs/platform-core-wave5-club-context-closure/sql-design/02_APPLY_DESIGN.sql",
    targetMd5Lf: "61dd0458b9240d5407394f6f8d492bf0",
    lang: "sql",
    vol: "s",
  },
  {
    name: "club_add_member",
    sig: "public.club_add_member(uuid,text,uuid,text,integer)",
    predecessorAuthority: "CERTIFIED_HISTORICAL_SOURCE_MATCH",
    predecessorSource: "docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql",
    predecessorMd5: "922df1b5d672f70150ae4010bb97bed0",
    targetSource: "docs/platform-core-wave5-club-context-closure/sql-design/02_APPLY_DESIGN.sql",
    targetMd5Lf: "484c609b937c029f03be7cb37fb03005",
    lang: "plpgsql",
    vol: "v",
  },
  {
    name: "club_restore_member",
    sig: "public.club_restore_member(uuid,text,uuid,integer)",
    predecessorAuthority: "CERTIFIED_HISTORICAL_SOURCE_MATCH",
    predecessorSource: "docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql",
    predecessorMd5: "d24dbfa3f21e674f31ad509c655a7ef6",
    targetSource: "docs/platform-core-wave5-club-context-closure/sql-design/02_APPLY_DESIGN.sql",
    targetMd5Lf: "8391e0fbafc57917bdfcbd9401242c86",
    lang: "plpgsql",
    vol: "v",
  },
  {
    name: "club_review_membership_request",
    sig: "public.club_review_membership_request(uuid,uuid,text,text,integer)",
    predecessorAuthority: "CERTIFIED_HISTORICAL_SOURCE_MATCH",
    predecessorSource: "docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql",
    predecessorMd5: "0b8ee11ef23090f8cd6e364ad2e6eb60",
    targetSource: "docs/platform-core-wave5-club-context-closure/sql-design/02_APPLY_DESIGN.sql",
    targetMd5Lf: "2ef9e0d87071bba93814ab20344539c1",
    lang: "plpgsql",
    vol: "v",
  },
];

const LIVE = {
  phase42_club_canonical: "871ff5136397a42f5c5718179b65aed9",
  club_create: "cb9669f04a35e9b60242a5d3b18a5b27",
  club_list_registry: "214cb6e88de6f2d9d0e55e1f33c6e582",
  club_list_members: "3089518678635910041656a1ae30cacd",
  phase42_can_update_club: "24f9f7e47c2dc0a166c6385811f6c43d",
  phase42_can_assign_club_owner: "509ea5949fa8389edd1c4827e1bf5779",
  phase42_can_transfer_president: "24f9f7e47c2dc0a166c6385811f6c43d",
  club_add_member: "922df1b5d672f70150ae4010bb97bed0",
  club_restore_member: "d24dbfa3f21e674f31ad509c655a7ef6",
  club_review_membership_request: "0b8ee11ef23090f8cd6e364ad2e6eb60",
};

const CANDIDATES = {
  phase42_club_canonical: [
    "docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql",
  ],
  club_create: ["docs/v5/PHASE_42G_CLUB_CREATE_OWNER.sql"],
  club_list_registry: ["docs/v5/PHASE_42C_RLS_RPC.sql"],
  club_list_members: ["docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql"],
  phase42_can_update_club: [
    "docs/v5/phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql",
  ],
  phase42_can_assign_club_owner: [
    "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql",
  ],
  phase42_can_transfer_president: [
    "docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql",
  ],
  club_add_member: ["docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql"],
  club_restore_member: ["docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql"],
  club_review_membership_request: [
    "docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql",
  ],
};

function main() {
  for (const [fname, files] of Object.entries(CANDIDATES)) {
    console.log(`\n=== ${fname} LIVE=${LIVE[fname]}`);
    for (const f of files) {
      if (!fs.existsSync(f)) {
        console.log(" MISSING", f);
        continue;
      }
      const sql = fs.readFileSync(f, "utf8");
      const r = extractProsrc(sql, fname);
      if (!r) {
        console.log(" NODEF", path.basename(f));
        continue;
      }
      if (r.error) {
        console.log(" ERR", path.basename(f), r.error);
        continue;
      }
      const match = r.md5 === LIVE[fname] ? "MATCH" : "DIFF ";
      console.log(
        ` ${match} stagingCrlf=${r.md5} gitLf=${r.md5GitLf} vol=${r.volatility} lang=${r.lang} ${path.basename(f)}`
      );
    }
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main();
}
