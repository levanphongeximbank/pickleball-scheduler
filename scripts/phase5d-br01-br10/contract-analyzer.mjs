import fs from "fs";
import path from "path";
import crypto from "crypto";

export const ROOT = process.cwd();
export const norm = (v = "") => String(v).replace(/\s+/g, " ").trim().toLowerCase();
export const hashFile = (rel) => {
  const b = fs.readFileSync(path.join(ROOT, rel));
  return { sha256: crypto.createHash("sha256").update(b).digest("hex"), bytes: b.length };
};
export const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

export function splitSql(text) {
  const out = [];
  let start = 0, quote = null, dollar = null, line = false, block = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (line) { if (c === "\n") line = false; continue; }
    if (block) { if (c === "*" && n === "/") { block = false; i++; } continue; }
    if (!quote && !dollar && c === "-" && n === "-") { line = true; i++; continue; }
    if (!quote && !dollar && c === "/" && n === "*") { block = true; i++; continue; }
    if (!quote && c === "$") {
      const m = text.slice(i).match(/^\$[a-zA-Z0-9_]*\$/);
      if (m && (!dollar || dollar === m[0])) { dollar = dollar ? null : m[0]; i += m[0].length - 1; continue; }
    }
    if (!dollar && (c === "'" || c === '"')) {
      if (quote === c && n === c) { i++; continue; }
      if (!quote) quote = c; else if (quote === c) quote = null;
    }
    if (c === ";" && !quote && !dollar) {
      const s = text.slice(start, i + 1).trim(); if (s) out.push(s); start = i + 1;
    }
  }
  const tail = text.slice(start).trim(); if (tail) out.push(tail);
  return out;
}

const ident = "(?:[a-zA-Z_][\\w$]*\\.)?[a-zA-Z_][\\w$]*";
const cleanName = (s) => s.replace(/"/g, "").toLowerCase().replace(/^public\./, "");
function args(s) {
  return splitComma(s).map((x) => norm(x.replace(/\b(default|in|out|inout|variadic)\b/gi, " ")));
}
function splitComma(s){const out=[];let start=0,depth=0,quote=null;for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];if((c==="'"||c==='"')){if(quote===c&&n===c){i++;continue;}if(!quote)quote=c;else if(quote===c)quote=null;}if(!quote){if(c==="(")depth++;else if(c===")")depth--;else if(c===","&&depth===0){out.push(s.slice(start,i));start=i+1;}}}out.push(s.slice(start));return out.filter(x=>x.trim());}
function columns(body) {
  return splitComma(body).map(norm).filter(Boolean).map((x) => {
    if (/^(constraint|primary|foreign|unique|check|exclude)\b/.test(x)) return { constraint: x };
    const m = x.match(/^"?([\w$]+)"?\s+([^ ]+(?:\s+[^ ]+)?)/); if (!m) return { unclassified: x };
    const type = norm(m[2].replace(/\b(default|not|null|constraint|primary|unique|references|check)\b[\s\S]*$/, ""));
    return { name: m[1], type, nullable: !/\bnot null\b/.test(x), default: norm(x.match(/\bdefault\s+(.+?)(?=\s+(?:not|null|constraint|primary|unique|references|check)\b|$)/)?.[1] || ""), constraints: norm(x.match(/\b(primary key|unique|references\s+[^ ]+|check\s*\(.+\))/)?.[0] || "") };
  });
}

export function extractSql(rel) {
  const statements = splitSql(read(rel));
  const o = { path: rel, schemas: [], extensions: [], types: [], domains: [], tables: [], columns: [], constraints: [], indexes: [], views: [], materializedViews: [], sequences: [], functions: [], procedures: [], triggers: [], rls: [], policies: [], grants: [], revokes: [], storageBuckets: [], unclassified: [] };
  for (const raw of statements) {
    const s = norm(raw.replace(/--[^\n]*/g, " ")); let m;
    if (!s || /^(begin|commit|do\s+\$|insert\s+into|update\s+|delete\s+from|select\s+|comment\s+on|drop\s+)/.test(s)) continue;
    if ((m=s.match(/^create schema(?: if not exists)?\s+(\w+)/))) o.schemas.push(m[1]);
    else if ((m=s.match(/^create extension(?: if not exists)?\s+(\w+)/))) o.extensions.push(m[1]);
    else if ((m=s.match(/^create type\s+([^ ]+)\s+as\s+(enum|composite|range)/))) o.types.push({name:cleanName(m[1]),kind:m[2],definition:s});
    else if ((m=s.match(/^create domain\s+([^ ]+)\s+as\s+([^ ]+)/))) o.domains.push({name:cleanName(m[1]),type:m[2],definition:s});
    else if ((m=s.match(new RegExp(`^create table(?: if not exists)?\\s+(${ident})\\s*\\(([\\s\\S]*)\\)`)))) { const name=cleanName(m[1]); const cs=columns(m[2]); o.tables.push(name); for(const c of cs) c.name ? o.columns.push({table:name,...c}) : c.constraint ? o.constraints.push({table:name,definition:c.constraint}) : o.unclassified.push({kind:"column",statement:c.unclassified}); }
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+enable row level security`)))) o.rls.push({table:cleanName(m[1]),enabled:true,forced:false});
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+force row level security`)))) o.rls.push({table:cleanName(m[1]),enabled:true,forced:true});
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+add(?: column)?(?: if not exists)?\\s+(\\w+)\\s+([^ ]+)`)))) o.columns.push({table:cleanName(m[1]),name:m[2],type:m[3],nullable:!/not null/.test(s),default:norm(s.match(/\bdefault\s+(.+?)(?=\s+(?:not|null|constraint|primary|unique|references|check)\b|$)/)?.[1]||""),constraints:""});
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+([\\s\\S]+)`)))) o.constraints.push({table:cleanName(m[1]),definition:m[2]});
    else if ((m=s.match(new RegExp(`^alter (function|procedure)\\s+(${ident})\\s*\\(([^)]*)\\)\\s+([\\s\\S]+)`)))) o[m[1]==="function"?"functions":"procedures"].push({name:cleanName(m[2]),parameters:args(m[3]),returns:"alter-existing",security:/security definer/.test(s)?"definer":"unchanged",searchPath:norm(m[4].match(/set\s+search_path\s*(?:=|to)\s*([^\n;]+)/)?.[1]||"")});
    else if ((m=s.match(new RegExp(`^create(?: unique)? index(?: concurrently)?(?: if not exists)?\\s+(\\w+)\\s+on\\s+(${ident})`)))) o.indexes.push({name:m[1],table:cleanName(m[2]),definition:s});
    else if ((m=s.match(new RegExp(`^create materialized view\\s+(${ident})`)))) o.materializedViews.push(cleanName(m[1]));
    else if ((m=s.match(new RegExp(`^create(?: or replace)? view\\s+(${ident})`)))) o.views.push(cleanName(m[1]));
    else if ((m=s.match(new RegExp(`^create sequence(?: if not exists)?\\s+(${ident})`)))) o.sequences.push(cleanName(m[1]));
    else if ((m=s.match(new RegExp(`^create(?: or replace)? (function|procedure)\\s+(${ident})\\s*\\(([^)]*)\\)\\s*([\\s\\S]*)`)))) { const item={name:cleanName(m[2]),parameters:args(m[3]),returns:norm(m[4].match(/\breturns\s+(.+?)(?=\s+language|\s+as\s+\$)/)?.[1]||"void"),security:/security definer/.test(s)?"definer":"invoker",searchPath:norm(m[4].match(/set\s+search_path\s*(?:=|to)\s*([^\n;]+)/)?.[1]||"")}; o[m[1]==="function"?"functions":"procedures"].push(item); }
    else if ((m=s.match(new RegExp(`^create(?: or replace)? trigger\\s+(\\w+)[\\s\\S]+?on\\s+(${ident})`)))) o.triggers.push({name:m[1],table:cleanName(m[2]),definition:s});
    else if ((m=s.match(new RegExp(`^create policy\\s+"?([^" ]+)"?\\s+on\\s+(${ident})([\\s\\S]*)`)))) { const tail=m[3]; o.policies.push({name:m[1],table:cleanName(m[2]),command:norm(tail.match(/\bfor\s+(all|select|insert|update|delete)/)?.[1]||"all"),roles:norm(tail.match(/\bto\s+(.+?)(?=\s+using|\s+with check|$)/)?.[1]||"public"),using:norm(tail.match(/\busing\s*\(([\s\S]*?)\)(?=\s+with check|$)/)?.[1]||""),withCheck:norm(tail.match(/\bwith check\s*\(([\s\S]*)\)/)?.[1]||"")}); }
    else if ((m=s.match(/^(grant|revoke)\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+(?:to|from)\s+([\s\S]+?);?$/))) o[m[1]==="grant"?"grants":"revokes"].push({privileges:norm(m[2]),object:norm(m[3]),roles:norm(m[4])});
    else if (/^(create|alter|grant|revoke)\b/.test(s)) o.unclassified.push({kind:"statement",statement:s.slice(0,500)});
  }
  const bucket = read(rel).match(/insert\s+into\s+storage\.buckets[\s\S]*?values\s*\(\s*'([^']+)'\s*,\s*'[^']+'\s*,\s*(true|false)/i);
  if (bucket) o.storageBuckets.push({id:bucket[1],public:bucket[2].toLowerCase()==="true"});
  return o;
}

export function topology(entries) {
  const ids=new Set(entries.map(e=>e.migrationId)), order=new Map(entries.map((e,i)=>[e.migrationId,i])); let unresolved=0,forward=0,self=0; const visiting=new Set(),done=new Set(); let cycles=0;
  const by=new Map(entries.map(e=>[e.migrationId,e])); const visit=(id)=>{if(visiting.has(id)){cycles++;return;} if(done.has(id))return; visiting.add(id); for(const d of by.get(id)?.dependencies||[]) if(by.has(d))visit(d); visiting.delete(id);done.add(id);};
  for(const e of entries){for(const d of e.dependencies||[]){if(d===e.migrationId)self++; if(!ids.has(d))unresolved++; else if(order.get(d)>=order.get(e.migrationId))forward++;} visit(e.migrationId);}
  const ps=entries.map(e=>e.path); return {unresolved,forward,self,cycles,duplicateMigrationIds:entries.length-ids.size,duplicatePaths:ps.length-new Set(ps).size};
}

export function envReads(rel) { return [...read(rel).matchAll(/Deno\.env\.get\(["']([^"']+)["']\)/g)].map(m=>m[1]); }
export function consumerRefs(paths) {
  const rpc=new Set(), tables=new Set();
  for(const p of paths){const t=read(p); for(const m of t.matchAll(/\.rpc\(["'`]([^"'`]+)["'`]/g))rpc.add(m[1].toLowerCase()); for(const m of t.matchAll(/\.from\(["'`]([^"'`]+)["'`]/g))tables.add(m[1].toLowerCase()); for(const m of t.matchAll(/[`"']((?:team_tournament|referee_v5)_[a-z0-9_]+)[`"']/gi))rpc.add(m[1].toLowerCase());}
  return {functions:[...rpc].sort(),tables:[...tables].sort(),sources:paths};
}
