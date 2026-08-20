#!/usr/bin/env node
/**
 * Deterministic pg_proc.prosrc extractor + MD5 for Wave5 RPC fingerprint certification.
 * Hash method: md5(UTF-8 bytes of body between AS $tag$ ... $tag$) — equivalent to
 * md5(convert_to(pg_proc.prosrc, 'UTF8')).
 *
 * Does NOT hash CREATE header, RETURNS, LANGUAGE, SECURITY, SET search_path, or delimiters.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function md5Utf8(s) {
  return crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
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
  const body = sql.slice(bodyStart, end);
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
    body,
    md5: md5Utf8(body),
    lang,
    prosecdef,
    searchPath,
    volatility,
    volatilityDerivedDefault,
    bodyLen: body.length,
    headerSnippet: header.slice(0, 240).replace(/\s+/g, " ").trim(),
  };
}

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
    "docs/v5/PHASE_42C_RLS_RPC.sql",
    "docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql",
  ],
  club_create: ["docs/v5/PHASE_42G_CLUB_CREATE_OWNER.sql"],
  club_list_registry: ["docs/v5/PHASE_42C_RLS_RPC.sql"],
  club_list_members: [
    "docs/v5/PHASE_42C_RLS_RPC.sql",
    "docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql",
  ],
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
        ` ${match} ${r.md5} vol=${r.volatility}${r.volatilityDerivedDefault ? "(default)" : ""} lang=${r.lang} ${path.basename(f)}`
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
