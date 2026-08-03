import fs from "fs";
import path from "path";
import crypto from "crypto";

export const ROOT = process.cwd();
export const norm = (v = "") => String(v).replace(/\s+/g, " ").trim().toLowerCase();
export const hashFile = (rel) => {
  const b = fs.readFileSync(path.isAbsolute(rel)?rel:path.join(ROOT, rel));
  return { sha256: crypto.createHash("sha256").update(b).digest("hex"), bytes: b.length };
};
export const read = (rel) => fs.readFileSync(path.isAbsolute(rel)?rel:path.join(ROOT, rel), "utf8");

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
  return splitComma(s).map((x) => norm(x.replace(/^\s*(in|out|inout|variadic)\s+/i,"")));
}
export function parameterParts(value){const raw=norm(value),dm=raw.match(/(?:\s+default\s+|\s*=\s*)([\s\S]*)$/),s=raw.replace(/(?:\s+default\s+|\s*=\s*)[\s\S]*$/,"");const m=s.match(/^([a-z_][a-z0-9_]*)\s+([\s\S]+)$/);return m?{name:m[1],type:m[2],hasDefault:!!dm,defaultValue:dm?.[1]||""}:{name:"",type:s,hasDefault:!!dm,defaultValue:dm?.[1]||""};}
function splitComma(s){const out=[];let start=0,depth=0,quote=null;for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];if((c==="'"||c==='"')){if(quote===c&&n===c){i++;continue;}if(!quote)quote=c;else if(quote===c)quote=null;}if(!quote){if(c==="(")depth++;else if(c===")")depth--;else if(c===","&&depth===0){out.push(s.slice(start,i));start=i+1;}}}out.push(s.slice(start));return out.filter(x=>x.trim());}
function parenthesizedClause(s,keyword){const m=s.match(new RegExp(`\\b${keyword}\\s*\\(`));if(!m)return "";const start=m.index+m[0].length;let depth=1,quote=null;for(let i=start;i<s.length;i++){const c=s[i],n=s[i+1];if(c==="'"||c==='"'){if(quote===c&&n===c){i++;continue;}if(!quote)quote=c;else if(quote===c)quote=null;continue;}if(quote)continue;if(c==="(")depth++;else if(c===")"&&--depth===0)return norm(s.slice(start,i));}return "";}
function columns(body) {
  return splitComma(body).map(norm).filter(Boolean).map((x) => {
    if (/^(constraint|primary|foreign|unique|check|exclude)\b/.test(x)) return { constraint: x };
    const m = x.match(/^"?([\w$]+)"?\s+([^ ]+(?:\s+[^ ]+)?)/); if (!m) return { unclassified: x };
    const type = norm(m[2].replace(/\b(default|not|null|constraint|primary|unique|references|check)\b[\s\S]*$/, ""));
    return { name: m[1], type, nullable: !/\bnot null\b/.test(x), default: norm(x.match(/\bdefault\s+(.+?)(?=\s+(?:not|null|constraint|primary|unique|references|check)\b|$)/)?.[1] || ""), constraints: norm(x.match(/\b(primary key|unique|references\s+[^ ]+|check\s*\(.+\))/)?.[0] || "") };
  });
}
function classifyDoBlock(statement){const ddl=[...statement.matchAll(/\b(alter\s+(?:table|function|publication)\s+[^;']+|(?:grant|revoke)\s+[^;']+)/g)].map(m=>m[1]);const hasDdl=/\b(create|alter|drop|grant|revoke)\b/.test(statement),known=ddl.length>0&&!/\bcreate\b/.test(statement),effects=[];for(const d of ddl){let m;if(/^alter table\s+%i\s+alter column\s+tenant_id\s+type\s+text/.test(d)){const list=statement.match(/array\s*\[([^\]]+)\]/)?.[1]||"";for(const name of [...list.matchAll(/'([a-z0-9_]+)'/g)].map(x=>x[1]))effects.push({kind:"columnType",table:name,name:"tenant_id",type:"text"});}else if((m=d.match(/^alter table\s+([a-z0-9_.]+)\s+alter column\s+tenant_id\s+type\s+text/)))effects.push({kind:"columnType",table:cleanName(m[1]),name:"tenant_id",type:"text"});else if((m=d.match(/^alter table\s+([a-z0-9_.]+)\s+alter column\s+([a-z0-9_]+)\s+(set|drop)\s+(not null|default(?:\s+.+)?)/)))effects.push({kind:"columnAlter",table:cleanName(m[1]),name:m[2],action:`${m[3]} ${m[4]}`});else if((m=d.match(/^alter table\s+([a-z0-9_.]+)\s+((?:add|drop)\s+constraint.+)/)))effects.push({kind:"constraint",table:cleanName(m[1]),definition:m[2]});else if(/^alter publication\b/.test(d))effects.push({kind:"publication",definition:d});else if(/^(grant|revoke)\b/.test(d))effects.push({kind:"aclTemplate",definition:d});else if(/^alter function\b/.test(d))effects.push({kind:"functionRename",definition:d});else effects.push({kind:"unknown",definition:d});}const supported=!hasDdl||(known&&effects.length>0&&effects.every(x=>x.kind!=="unknown"));return {hasDdl,supported,classifiedOperations:ddl,effects};}

function specialDoEffects(statement){
  if(!/alter table public\.%i alter column tenant_id type text/.test(statement))return null;
  const list=statement.match(/array\s*\[([^\]]+)\]/)?.[1]||"";
  const tables=[...list.matchAll(/'([a-z0-9_]+)'/g)].map(x=>x[1]);
  return tables.length?tables.map(table=>({kind:"columnType",table,name:"tenant_id",type:"text"})):null;
}

export function extractSql(rel) {
  const statements = splitSql(read(rel));
  const o = { path: rel, schemas: [], extensions: [], types: [], domains: [], tables: [], columns: [], constraints: [], indexes: [], views: [], materializedViews: [], sequences: [], functions: [], procedures: [], functionAlters: [], triggers: [], rls: [], policies: [], grants: [], revokes: [], drops: [], dataStatements: [], doBlocks: [], storageBuckets: [], unclassified: [], operations: [] };
  for (const raw of statements) {
    const s = norm(raw.replace(/--[^\n]*/g, " ")); let m;
    if (!s || /^(begin|commit|comment\s+on)/.test(s)) continue;
    if (/^do\s+\$/.test(s)) { const x={statement:s,...classifyDoBlock(s)}; o.doBlocks.push(x); o.operations.push({kind:"doBlock",value:x}); continue; }
    if (/^(insert\s+into|update\s+|delete\s+from|select\s+)/.test(s)) { const x={command:s.split(" ")[0],statement:s}; o.dataStatements.push(x); o.operations.push({kind:"dataStatement",value:x}); continue; }
    if ((m=s.match(new RegExp(`^drop\\s+(table|view|materialized view|sequence|function|procedure|trigger|policy|type|domain|schema|extension|index)\\s+(?:if exists\\s+)?(?:"([^"]+)"|(${ident}))([\\s\\S]*)`)))) { const x={kind:m[1],name:cleanName(m[2]||m[3]),parameterTypes:(m[4].match(/^\s*\(([^)]*)\)/)?.[1]||"").split(",").map(norm).filter(Boolean),statement:s}; o.drops.push(x); o.operations.push({kind:"drop",value:x}); continue; }
    const before=Object.fromEntries(Object.entries(o).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]));
    if ((m=s.match(/^create schema(?: if not exists)?\s+(\w+)/))) o.schemas.push(m[1]);
    else if ((m=s.match(/^create extension(?: if not exists)?\s+(\w+)/))) o.extensions.push(m[1]);
    else if ((m=s.match(/^create type\s+([^ ]+)\s+as\s+(enum|composite|range)/))) o.types.push({name:cleanName(m[1]),kind:m[2],definition:s});
    else if ((m=s.match(/^create domain\s+([^ ]+)\s+as\s+([^ ]+)/))) o.domains.push({name:cleanName(m[1]),type:m[2],definition:s});
    else if ((m=s.match(new RegExp(`^create table(?: if not exists)?\\s+(${ident})\\s*\\(([\\s\\S]*)\\)`)))) { const name=cleanName(m[1]); const cs=columns(m[2]); o.tables.push(name); for(const c of cs) c.name ? o.columns.push({table:name,...c}) : c.constraint ? o.constraints.push({table:name,name:c.constraint.match(/^constraint\s+([a-z0-9_]+)/)?.[1]||null,definition:c.constraint}) : o.unclassified.push({kind:"column",statement:c.unclassified}); }
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+enable row level security`)))) o.rls.push({table:cleanName(m[1]),enabled:true,forced:false});
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+force row level security`)))) o.rls.push({table:cleanName(m[1]),enabled:true,forced:true});
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+disable row level security`)))) o.rls.push({table:cleanName(m[1]),enabled:false,forced:false});
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+no force row level security`)))) o.rls.push({table:cleanName(m[1]),enabled:true,forced:false});
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+drop(?: column)?(?: if exists)?\\s+(?!constraint\\b)(\\w+)`)))) { const x={kind:"column",table:cleanName(m[1]),name:m[2],statement:s};o.drops.push(x); }
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+alter(?: column)?\\s+(\\w+)\\s+type\\s+([^ ]+)`)))) o.columns.push({table:cleanName(m[1]),name:m[2],type:m[3],alteration:"type"});
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+add(?: column)?(?: if not exists)?\\s+(\\w+)\\s+([^ ]+)`)))) o.columns.push({table:cleanName(m[1]),name:m[2],type:m[3],nullable:!/not null/.test(s),default:norm(s.match(/\bdefault\s+(.+?)(?=\s+(?:not|null|constraint|primary|unique|references|check)\b|$)/)?.[1]||""),constraints:""});
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+alter(?: column)?\\s+(\\w+)\\s+(set|drop)\\s+(not null|default(?:\\s+[\\s\\S]+)?)`)))) o.columns.push({table:cleanName(m[1]),name:m[2],alteration:`${m[3]} ${m[4]}`,...(m[4].startsWith("default")?{default:norm(m[4].slice(7))}:{nullable:m[3]==="drop"})});
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+(add|drop)\\s+constraint(?: if exists)?\\s+([a-z0-9_]+)([\\s\\S]*)`)))) o.constraints.push({table:cleanName(m[1]),name:m[3],action:m[2],definition:norm(`${m[2]} constraint ${m[3]}${m[4]}`)});
    else if ((m=s.match(new RegExp(`^alter table(?: if exists)?\\s+(${ident})\\s+([\\s\\S]+)`)))) o.unclassified.push({kind:"alter-table",table:cleanName(m[1]),statement:m[2]});
    else if ((m=s.match(new RegExp(`^alter (function|procedure)\\s+(${ident})\\s*\\(([^)]*)\\)\\s+([\\s\\S]+)`)))) o.functionAlters.push({kind:m[1],name:cleanName(m[2]),parameters:args(m[3]),security:/security definer/.test(s)?"definer":/security invoker/.test(s)?"invoker":null,searchPath:norm(m[4].match(/set\s+search_path\s*(?:=|to)\s*(.+?)$/)?.[1]||"")});
    else if ((m=s.match(new RegExp(`^create(?: unique)? index(?: concurrently)?(?: if not exists)?\\s+(\\w+)\\s+on\\s+(${ident})`)))) o.indexes.push({name:m[1],table:cleanName(m[2]),definition:s});
    else if ((m=s.match(new RegExp(`^create materialized view\\s+(${ident})`)))) o.materializedViews.push(cleanName(m[1]));
    else if ((m=s.match(new RegExp(`^create(?: or replace)? view\\s+(${ident})`)))) o.views.push(cleanName(m[1]));
    else if ((m=s.match(new RegExp(`^create sequence(?: if not exists)?\\s+(${ident})`)))) o.sequences.push(cleanName(m[1]));
    else if ((m=s.match(new RegExp(`^create(?: or replace)? (function|procedure)\\s+(${ident})\\s*\\(([^)]*)\\)\\s*([\\s\\S]*)`)))) { const item={name:cleanName(m[2]),parameters:args(m[3]),returns:norm(m[4].match(/\breturns\s+(.+?)(?=\s+language|\s+as\s+\$)/)?.[1]||"void"),security:/security definer/.test(s)?"definer":"invoker",searchPath:norm(m[4].match(/set\s+search_path\s*(?:=|to)\s*(.+?)(?=\s+as\s+\$|$)/)?.[1]||"")}; o[m[1]==="function"?"functions":"procedures"].push(item); }
    else if ((m=s.match(new RegExp(`^create(?: or replace)? trigger\\s+(\\w+)[\\s\\S]+?on\\s+(${ident})`)))) o.triggers.push({name:m[1],table:cleanName(m[2]),definition:s});
    else if ((m=s.match(new RegExp(`^create policy\\s+"?([^" ]+)"?\\s+on\\s+(${ident})([\\s\\S]*)`)))) { const tail=m[3]; o.policies.push({name:m[1],table:cleanName(m[2]),command:norm(tail.match(/\bfor\s+(all|select|insert|update|delete)/)?.[1]||"all"),roles:norm(tail.match(/\bto\s+(.+?)(?=\s+using|\s+with check|$)/)?.[1]||"public"),using:parenthesizedClause(tail,"using"),withCheck:parenthesizedClause(tail,"with check")}); }
    else if ((m=s.match(/^(grant|revoke)\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+(?:to|from)\s+([\s\S]+?);?$/))) o[m[1]==="grant"?"grants":"revokes"].push({privileges:norm(m[2]),object:norm(m[3]),roles:norm(m[4])});
    else if (/^(create|alter|grant|revoke)\b/.test(s)) o.unclassified.push({kind:"statement",statement:s.slice(0,500)});
    for(const [kind,list] of Object.entries(o)){if(!Array.isArray(list)||kind==="operations")continue;for(let i=before[kind]||0;i<list.length;i++)o.operations.push({kind,value:list[i]});}
  }
  for(const statement of statements){const s=norm(statement);let bucket;if((bucket=s.match(/insert\s+into\s+storage\.buckets[\s\S]*?values\s*\(\s*'([^']+)'\s*,\s*'[^']+'\s*,\s*(true|false)/i)))o.storageBuckets.push({id:bucket[1],public:bucket[2]==="true",operation:"insert-or-upsert"});else if((bucket=s.match(/update\s+storage\.buckets\s+set[\s\S]*?public\s*=\s*(true|false)[\s\S]*?where[\s\S]*?id\s*=\s*'([^']+)'/i)))o.storageBuckets.push({id:bucket[2],public:bucket[1]==="true",operation:"update"});}
  return o;
}

function buildEffectiveSqlState(entries) {
  const state={tables:new Map(),columns:new Map(),constraints:new Map(),functions:new Map(),procedures:new Map(),policies:new Map(),triggers:new Map(),indexes:new Map(),views:new Map(),materializedViews:new Map(),sequences:new Map(),types:new Map(),domains:new Map(),rls:new Map(),storageBuckets:new Map(),publications:new Map(),tableAcl:new Map(),grants:[],revokes:[],functionAcl:new Map(),unresolvedDynamicDdl:[]};
  const paramType=(p)=>parameterParts(p).type;const keyFn=(f)=>`${f.name}(${f.parameters.map(paramType).join(",")})`;
  for(const e of entries){const o=extractSql(e.path);
    for(const op of o.operations){const x=op.value;
      if(op.kind==="doBlock"&&x.hasDdl&&/\bif\s+(?:false|0\s*=\s*1)\b/.test(x.statement)){state.unresolvedDynamicDdl.push(`${e.path}#unprovable-do-condition`);continue;}
      if(op.kind==="doBlock"&&x.hasDdl&&/\bif\s+(?!(?:not\s+)?exists\b)/.test(x.statement)){state.unresolvedDynamicDdl.push(`${e.path}#unrecognized-do-condition`);continue;}
      if(op.kind==="doBlock"&&x.hasDdl){
        const effects=x.supported?x.effects:specialDoEffects(x.statement);
        if(!effects){state.unresolvedDynamicDdl.push(`${e.path}#do-block-not-effectively-modeled`);continue;}
        for(const effect of effects){
          if(effect.kind==="columnType")state.columns.set(`${effect.table}.${effect.name}`,{...effect,path:e.path});
          else if(effect.kind==="columnAlter"){const key=`${effect.table}.${effect.name}`,prior=state.columns.get(key)||{table:effect.table,name:effect.name};state.columns.set(key,{...prior,...effect,nullable:effect.action==="drop not null"?true:effect.action==="set not null"?false:prior.nullable,path:e.path});}
          else if(effect.kind==="constraint"){const m=effect.definition.match(/^(add|drop)\s+constraint(?:\s+if exists)?\s+([a-z0-9_]+)/);if(!m)state.unresolvedDynamicDdl.push(`${e.path}#unparsed-do-constraint`);else if(m[1]==="drop")state.constraints.delete(`${effect.table}:${m[2]}`);else state.constraints.set(`${effect.table}:${m[2]}`,{...effect,name:m[2],path:e.path});}
          else if(effect.kind==="publication"){
            const m=effect.definition.match(/alter publication\s+([a-z0-9_]+)\s+add table\s+([a-z0-9_.]+)/);
            if(!m)state.unresolvedDynamicDdl.push(`${e.path}#publication-effect`);else state.publications.set(`${m[1]}:${cleanName(m[2])}`,{publication:m[1],table:cleanName(m[2]),path:e.path});
          }else if(effect.kind==="aclTemplate"){
            const tables=[...(x.statement.match(/array\s*\[([^\]]+)\]/)?.[1]||"").matchAll(/'([a-z0-9_]+)'/g)].map(m=>m[1]),m=effect.definition.match(/^(grant|revoke)\s+(.+?)\s+on table\s+(?:public\.)?%i\s+(?:to|from)\s+([a-z0-9_]+)/);
            if(!m||!tables.length)state.unresolvedDynamicDdl.push(`${e.path}#acl-template-effect`);else for(const table of tables){const acl=state.tableAcl.get(table)||new Map();acl.set(m[3],{allowed:m[1]==="grant",privileges:m[2]});state.tableAcl.set(table,acl);}
          }else if(effect.kind==="functionRename"){
            const m=effect.definition.match(/alter function\s+(?:public\.)?([a-z0-9_]+)\(([^)]*)\)\s+rename to\s+([a-z0-9_]+)/);
            if(!m){state.unresolvedDynamicDdl.push(`${e.path}#function-rename-effect`);continue;}
            const types=m[2].split(",").map(norm).join(","),oldKey=`${m[1]}(${types})`,newKey=`${m[3]}(${types})`,prior=state.functions.get(oldKey);
            if(prior&&!state.functions.has(newKey)){state.functions.delete(oldKey);state.functions.set(newKey,{...prior,name:m[3],path:e.path});const acl=state.functionAcl.get(oldKey.replace(/\s+/g,""));if(acl){state.functionAcl.delete(oldKey.replace(/\s+/g,""));state.functionAcl.set(newKey.replace(/\s+/g,""),acl);}}
          }
        }
        continue;
      }
      if(op.kind==="tables")state.tables.set(x,{path:e.path}); else if(op.kind==="columns"){const key=`${x.table}.${x.name}`,prior=state.columns.get(key);state.columns.set(key,{...(x.alteration&&prior?prior:{}),...x,path:e.path});} else if(op.kind==="functions")state.functions.set(keyFn(x),{...x,path:e.path}); else if(op.kind==="procedures")state.procedures.set(keyFn(x),{...x,path:e.path});
      else if(op.kind==="functionAlters"){const map=x.kind==="function"?state.functions:state.procedures,key=keyFn(x),prior=map.get(key);if(prior)map.set(key,{...prior,...(x.security?{security:x.security}:{}),...(x.searchPath?{searchPath:x.searchPath}:{}),path:e.path});else state.unresolvedDynamicDdl.push(`${e.path}#alter-missing:${key}`);}
      else if(op.kind==="constraints"){const key=`${x.table}:${x.name||x.definition}`;if(x.action==="drop")state.constraints.delete(key);else state.constraints.set(key,{...x,path:e.path});} else if(op.kind==="policies")state.policies.set(`${x.table}:${x.name}`,{...x,path:e.path}); else if(op.kind==="triggers")state.triggers.set(`${x.table}:${x.name}`,{...x,path:e.path}); else if(op.kind==="indexes")state.indexes.set(x.name,{...x,path:e.path});
      else if(op.kind==="views")state.views.set(x,{path:e.path}); else if(op.kind==="materializedViews")state.materializedViews.set(x,{path:e.path}); else if(op.kind==="sequences")state.sequences.set(x,{path:e.path}); else if(op.kind==="types")state.types.set(x.name,{...x,path:e.path}); else if(op.kind==="domains")state.domains.set(x.name,{...x,path:e.path}); else if(op.kind==="rls")state.rls.set(x.table,{...x,path:e.path}); else if(op.kind==="grants"||op.kind==="revokes"){state[op.kind].push({...x,path:e.path});const fm=x.object.match(/function\s+(?:public\.)?([a-z0-9_]+)\s*(\([^)]*\))?/);if(fm){const identity=`${fm[1]}${fm[2]||"(*)"}`.replace(/\s+/g,"");const acl=state.functionAcl.get(identity)||new Map();for(const role of x.roles.replace(/;$/,"").split(",").map(norm))acl.set(role,op.kind==="grants");state.functionAcl.set(identity,acl);}}
      else if(op.kind==="drop"||op.kind==="drops"){const d=x;if(d.kind==="column"){state.columns.delete(`${d.table}.${d.name}`);continue;}const plural={table:"tables",function:"functions",procedure:"procedures",policy:"policies",trigger:"triggers",index:"indexes",view:"views","materialized view":"materializedViews",sequence:"sequences",type:"types",domain:"domains"}[d.kind];if(!plural)continue;const map=state[plural],exact=(d.kind==="function"||d.kind==="procedure")&&d.parameterTypes.length?`${d.name}(${d.parameterTypes.join(",")})`:null;for(const k of [...map.keys()])if(k===d.name||k===exact||(!exact&&k.startsWith(`${d.name}(`))||k.endsWith(`:${d.name}`)){map.delete(k);if(d.kind==="function"||d.kind==="procedure")state.functionAcl.delete(k.replace(/\s+/g,""));}if(d.kind==="table"){for(const name of ["columns","constraints","policies","triggers"]){for(const k of [...state[name].keys()])if(k.startsWith(`${d.name}.`)||k.startsWith(`${d.name}:`))state[name].delete(k);}for(const [k,v] of state.indexes)if(v.table===d.name)state.indexes.delete(k);state.rls.delete(d.name);state.tableAcl.delete(d.name);}}
    }
    for(const bucket of o.storageBuckets)state.storageBuckets.set(bucket.id,{...bucket,path:e.path});
  } return state;
}

export function effectiveSqlState(entries) {
  const state=buildEffectiveSqlState(entries);
  for(let i=0;i<entries.length;i++){
    const o=extractSql(entries[i].path);
    for(const block of o.doBlocks){
      const effects=specialDoEffects(block.statement);if(!effects)continue;
      const prior=buildEffectiveSqlState(entries.slice(0,i));
      for(const effect of effects){const key=`${effect.table}.${effect.name}`,before=prior.columns.get(key),after=state.columns.get(key);if((!before||!/^uuid\b/.test(before.type))&&after?.path===entries[i].path){if(before)state.columns.set(key,before);else state.columns.delete(key);}}
    }
  }
  return state;
}

export function verifyRequiredContracts(entries, requirements) {
  const state=effectiveSqlState(entries),results=[];
  for(const req of requirements.functions||[]){const candidates=[...state.functions.values()].filter(f=>f.name===req.name),checks=[];for(const f of candidates){const details=f.parameters.map(parameterParts),actualParams=details.map(p=>p.name),expected=req.parameterDetails||req.parameters.map(name=>({name})),search=f.searchPath.split(",").map(norm),identity=`${f.name}(${details.map(p=>p.type).join(",")})`,acl=state.functionAcl.get(identity)||state.functionAcl.get(`${f.name}(*)`)||new Map(),optional=new Set(req.optionalParameters||[]);checks.push({signature:`${f.name}(${f.parameters.join(",")})`,parametersExact:JSON.stringify(actualParams)===JSON.stringify(req.parameters),parameterTypesDefaultsExact:expected.every((p,i)=>!p.type||p.name===details[i]?.name&&norm(p.type)===details[i]?.type&&("hasDefault" in p?p.hasDefault===details[i]?.hasDefault:true)),optionalDefaultsExact:details.every(p=>p.hasDefault===optional.has(p.name)),returnType:f.returns===req.returns,securityMode:f.security===req.security,searchPathExact:JSON.stringify(search)===JSON.stringify(req.searchPathIncludes.map(norm)),executeRoles:(req.executeRoles||[]).every(r=>acl.get(r)===true),deniedRoles:(req.deniedRoles||[]).every(r=>acl.get(r)===false)});}const pass=checks.some(c=>Object.entries(c).filter(([k])=>k!=="signature").every(([,v])=>v));results.push({name:req.name,required:req,candidates:checks,pass});}
  const tables=(requirements.tables||[]).map(req=>{const rls=state.rls.get(req.name);return {...req,actualRls:rls||null,pass:state.tables.has(req.name)&&(!req.rlsEnabled||rls?.enabled===true)};});
  return {pass:results.every(x=>x.pass)&&tables.every(x=>x.pass)&&state.unresolvedDynamicDdl.length===0,functions:results,tables,unresolvedDynamicDdl:[...new Set(state.unresolvedDynamicDdl)]};
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
