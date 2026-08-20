/**
 * Wave5 SQL dollar-quote lexical auditor.
 *
 * Detects PostgreSQL parse collisions where an outer DO/function dollar-quote
 * delimiter also appears as an inner literal delimiter before the intended close.
 * Local/static only. Does not connect to any database.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const WAVE5_PACKAGE_DIR = path.join(
  ROOT,
  "docs/platform-core-wave5-club-context-closure"
);

const DOLLAR_RE = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/;

export function listWave5SqlFiles(rootDir = WAVE5_PACKAGE_DIR) {
  const out = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith(".sql")) out.push(p);
    }
  }
  walk(rootDir);
  return out.sort((a, b) => a.localeCompare(b));
}

export function relWave5Sql(filePath) {
  return path.relative(WAVE5_PACKAGE_DIR, filePath).split(path.sep).join("/");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWordChar(ch) {
  return ch != null && /[A-Za-z0-9_]/.test(ch);
}

function isKeywordAt(sql, i, word) {
  if (sql.slice(i, i + word.length).toUpperCase() !== word.toUpperCase()) return false;
  if (i > 0 && isWordChar(sql[i - 1])) return false;
  if (isWordChar(sql[i + word.length])) return false;
  return true;
}

function skipLineComment(sql, i) {
  while (i < sql.length && sql[i] !== "\n") i += 1;
  return i;
}

function skipBlockComment(sql, i) {
  const end = sql.indexOf("*/", i + 2);
  return end < 0 ? sql.length : end + 2;
}

function skipSingleQuoted(sql, i) {
  i += 1;
  while (i < sql.length) {
    if (sql[i] === "'" && sql[i + 1] === "'") {
      i += 2;
      continue;
    }
    if (sql[i] === "'") return i + 1;
    i += 1;
  }
  return i;
}

function skipDoubleQuoted(sql, i) {
  i += 1;
  while (i < sql.length) {
    if (sql[i] === '"' && sql[i + 1] === '"') {
      i += 2;
      continue;
    }
    if (sql[i] === '"') return i + 1;
    i += 1;
  }
  return i;
}

function skipTrivia(sql, i) {
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      i = skipLineComment(sql, i);
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      i = skipBlockComment(sql, i);
      continue;
    }
    break;
  }
  return i;
}

export function matchDollarAt(sql, i) {
  if (sql[i] !== "$") return null;
  const m = sql.slice(i).match(DOLLAR_RE);
  if (!m) return null;
  return { delim: m[0], tag: m[1] || "", length: m[0].length };
}

function lineOf(sql, index) {
  let line = 1;
  for (let i = 0; i < index && i < sql.length; i += 1) {
    if (sql[i] === "\n") line += 1;
  }
  return line;
}

function countDelimOccurrences(text, delim) {
  if (!delim) return 0;
  let n = 0;
  let from = 0;
  while (from <= text.length - delim.length) {
    const at = text.indexOf(delim, from);
    if (at < 0) break;
    n += 1;
    from = at + delim.length;
  }
  return n;
}

function innerSameDelimLiterals(body, delim) {
  const n = countDelimOccurrences(body, delim);
  return {
    delimOccurrenceCount: n,
    collisionCount: Math.floor(n / 2),
    oddDelim: n % 2 === 1,
  };
}

function findIntendedDoClose(sql, bodyStart, delim) {
  const re = new RegExp(String.raw`\bEND\s+` + escapeRe(delim), "i");
  const rest = sql.slice(bodyStart);
  const m = re.exec(rest);
  if (!m) return null;
  return {
    endKeywordIndex: bodyStart + m.index,
    closeIndex: bodyStart + m.index + m[0].length - delim.length,
    afterClose: bodyStart + m.index + m[0].length,
    body: rest.slice(0, m.index),
  };
}

function findIntendedFunctionClose(sql, bodyStart, delim) {
  const re = new RegExp(escapeRe(delim) + String.raw`\s*(;|LANGUAGE\b)`, "i");
  const rest = sql.slice(bodyStart);
  const m = re.exec(rest);
  if (!m) return null;
  return {
    closeIndex: bodyStart + m.index,
    afterClose: bodyStart + m.index + delim.length,
    body: rest.slice(0, m.index),
  };
}

function skipCreateFunctionHeader(sql, createIndex) {
  let i = createIndex;
  if (!isKeywordAt(sql, i, "CREATE")) return null;
  i = skipTrivia(sql, i + 6);
  if (isKeywordAt(sql, i, "OR")) {
    i = skipTrivia(sql, i + 2);
    if (!isKeywordAt(sql, i, "REPLACE")) return null;
    i = skipTrivia(sql, i + 7);
  }
  if (!isKeywordAt(sql, i, "FUNCTION")) return null;
  return skipTrivia(sql, i + 8);
}

function findAsDollar(sql, from, limit) {
  let i = from;
  while (i < limit && i < sql.length) {
    i = skipTrivia(sql, i);
    if (i >= limit) break;
    if (sql[i] === "'") {
      i = skipSingleQuoted(sql, i);
      continue;
    }
    if (sql[i] === '"') {
      i = skipDoubleQuoted(sql, i);
      continue;
    }
    const d = matchDollarAt(sql, i);
    if (d) {
      i += d.length;
      continue;
    }
    if (isKeywordAt(sql, i, "AS")) {
      const afterAs = skipTrivia(sql, i + 2);
      const dollar = matchDollarAt(sql, afterAs);
      if (dollar) {
        return { asIndex: i, dollarIndex: afterAs, ...dollar };
      }
    }
    if (isKeywordAt(sql, i, "CREATE")) break;
    i += 1;
  }
  return null;
}

function collectTags(blocks) {
  const set = new Set();
  for (const b of blocks) {
    set.add(b.delim);
    for (const inner of b.innerDelims || []) set.add(inner);
  }
  return [...set];
}

function collectInnerDelims(body) {
  const tags = [];
  const re = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/g;
  let m;
  while ((m = re.exec(body))) {
    tags.push(m[0]);
  }
  return tags;
}

export function auditSql(sql, fileLabel = "<memory>") {
  const doBlocks = [];
  const functionBodies = [];
  const unbalanced = [];
  const collisions = [];
  let i = 0;

  while (i < sql.length) {
    i = skipTrivia(sql, i);
    if (i >= sql.length) break;

    if (sql[i] === "'") {
      i = skipSingleQuoted(sql, i);
      continue;
    }
    if (sql[i] === '"') {
      i = skipDoubleQuoted(sql, i);
      continue;
    }

    if (isKeywordAt(sql, i, "DO")) {
      const afterDo = skipTrivia(sql, i + 2);
      const dollar = matchDollarAt(sql, afterDo);
      if (dollar) {
        const bodyStart = afterDo + dollar.length;
        const intended = findIntendedDoClose(sql, bodyStart, dollar.delim);
        if (!intended) {
          unbalanced.push({
            kind: "do",
            delim: dollar.delim,
            startLine: lineOf(sql, afterDo),
            reason: "UNCLOSED_DO_DOLLAR_QUOTE",
          });
          i = bodyStart;
          continue;
        }
        const inner = innerSameDelimLiterals(intended.body, dollar.delim);
        const postgresClose = sql.indexOf(dollar.delim, bodyStart);
        const premature =
          postgresClose >= 0 && postgresClose < intended.closeIndex;
        const innerDelims = collectInnerDelims(intended.body);
        const block = {
          kind: "do",
          delim: dollar.delim,
          tagged: dollar.tag.length > 0,
          startLine: lineOf(sql, afterDo),
          endLine: lineOf(sql, intended.closeIndex),
          collisionCount: inner.collisionCount,
          delimOccurrenceCount: inner.delimOccurrenceCount,
          oddDelim: inner.oddDelim,
          premature,
          innerDelims: [...new Set(innerDelims)],
        };
        doBlocks.push(block);
        if (inner.collisionCount > 0 || inner.oddDelim || premature) {
          collisions.push(block);
        }
        i = intended.afterClose;
        continue;
      }
    }

    const fnHeader = skipCreateFunctionHeader(sql, i);
    if (fnHeader != null) {
      const asDollar = findAsDollar(sql, fnHeader, sql.length);
      if (asDollar) {
        const bodyStart = asDollar.dollarIndex + asDollar.length;
        const intended = findIntendedFunctionClose(sql, bodyStart, asDollar.delim);
        if (!intended) {
          unbalanced.push({
            kind: "function",
            delim: asDollar.delim,
            startLine: lineOf(sql, asDollar.dollarIndex),
            reason: "UNCLOSED_FUNCTION_DOLLAR_QUOTE",
          });
          i = bodyStart;
          continue;
        }
        const inner = innerSameDelimLiterals(intended.body, asDollar.delim);
        const postgresClose = sql.indexOf(asDollar.delim, bodyStart);
        const premature =
          postgresClose >= 0 && postgresClose < intended.closeIndex;
        const innerDelims = collectInnerDelims(intended.body);
        const block = {
          kind: "function",
          delim: asDollar.delim,
          tagged: asDollar.tag.length > 0,
          startLine: lineOf(sql, asDollar.dollarIndex),
          endLine: lineOf(sql, intended.closeIndex),
          collisionCount: inner.collisionCount,
          delimOccurrenceCount: inner.delimOccurrenceCount,
          oddDelim: inner.oddDelim,
          premature,
          innerDelims: [...new Set(innerDelims)],
        };
        functionBodies.push(block);
        if (inner.collisionCount > 0 || inner.oddDelim || premature) {
          collisions.push(block);
        }
        i = intended.afterClose;
        continue;
      }
    }

    const topDollar = matchDollarAt(sql, i);
    if (topDollar) {
      const close = sql.indexOf(topDollar.delim, i + topDollar.length);
      if (close < 0) {
        unbalanced.push({
          kind: "literal",
          delim: topDollar.delim,
          startLine: lineOf(sql, i),
          reason: "UNCLOSED_TOPLEVEL_DOLLAR_QUOTE",
        });
        break;
      }
      i = close + topDollar.length;
      continue;
    }

    i += 1;
  }

  const allBlocks = [...doBlocks, ...functionBodies];
  const tags = collectTags(allBlocks);
  const untaggedRegions = allBlocks.filter((b) => !b.tagged).length;
  const collisionCount = collisions.reduce((n, b) => n + b.collisionCount, 0);
  let parseRisk = "NONE";
  if (unbalanced.length) parseRisk = "UNBALANCED";
  else if (collisionCount > 0) parseRisk = "NESTED_SAME_DELIMITER";

  return {
    file: fileLabel,
    tags,
    doBlocks,
    functionBodies,
    doBlockCount: doBlocks.length,
    functionBodyDollarQuoteCount: functionBodies.length,
    untaggedDollarQuoteCount: untaggedRegions,
    nestedSameDelimiterCollision: collisionCount,
    collisions,
    unbalanced,
    parseRisk,
    action: parseRisk === "NONE" ? "NONE" : "RETAG_OUTER_DELIMITER",
  };
}

export function auditWave5SqlFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  return auditSql(sql, relWave5Sql(filePath));
}

export function auditWave5Package(rootDir = WAVE5_PACKAGE_DIR) {
  const files = listWave5SqlFiles(rootDir);
  return files.map((f) => auditWave5SqlFile(f));
}
