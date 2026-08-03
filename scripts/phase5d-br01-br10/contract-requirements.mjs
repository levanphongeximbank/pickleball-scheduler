import { read, norm, splitSql } from "./contract-analyzer.mjs";
import { analyzeEdgeSources } from "./edge-contract-analyzer.mjs";

function balancedObject(text, anchor) {
  const at=typeof anchor==="number"?anchor:text.indexOf(anchor); if(at<0)throw new Error(`contract anchor missing: ${anchor}`); const start=text.indexOf("{",at); if(start<0)throw new Error(`object missing: ${anchor}`);
  let depth=0,quote=null; for(let i=start;i<text.length;i++){const c=text[i],n=text[i+1];if((c==="'"||c==='"'||c==='`')){if(quote===c&&text[i-1]!=="\\")quote=null;else if(!quote)quote=c;}if(quote)continue;if(c==="{")depth++;if(c==="}"&&--depth===0)return text.slice(start,i+1);}throw new Error(`unterminated object: ${anchor}`);
}
const keys=(body)=>[...body.matchAll(/\b(p_[a-z0-9_]+)\s*:/gi)].map(m=>m[1].toLowerCase());
const callContract=(text,rpc)=>({name:rpc,parameters:keys(balancedObject(text,`callTeamTournamentRpc("${rpc}"`))});

export function deriveM9Requirements(){
  const source="src/features/team-tournament/services/teamTournamentRpcService.js",t=read(source),names=["team_tournament_create_referee_assignment","team_tournament_revoke_referee_assignment","team_tournament_referee_match_access_ops","team_tournament_reopen_referee_match"];
  const types={team_tournament_create_referee_assignment:["text","text","text","uuid","timestamptz","boolean","text","text"],team_tournament_revoke_referee_assignment:["text","uuid","integer","text","text"],team_tournament_referee_match_access_ops:["text","text"],team_tournament_reopen_referee_match:["text","text","text","text"]},requiredDefaults={team_tournament_create_referee_assignment:4,team_tournament_revoke_referee_assignment:1,team_tournament_referee_match_access_ops:0,team_tournament_reopen_referee_match:1};
  return {sources:[source,"docs/v5/team-tournament/tt5/TT5-D_IMPLEMENTATION.md","tests/team-tournament-tt5d.test.js"],functions:names.map(n=>{const c=callContract(t,n),defaults=requiredDefaults[n];return {...c,parameterDetails:c.parameters.map((name,i)=>({name,type:types[n][i],hasDefault:i>=c.parameters.length-defaults})),optionalParameters:c.parameters.slice(c.parameters.length-defaults),returns:"json",security:"definer",searchPathIncludes:["public"],executeRoles:["authenticated"],deniedRoles:["public","anon"]};})};
}

export function deriveM10Requirements(){
  const atomic="src/features/referee-v5/persistence/RefereeV5RpcAtomicCommitService.js",a=read(atomic),get="src/features/referee-v5/services/refereeV5RpcService.js";
  const payloads=[...a.matchAll(/const payload\s*=\s*\{/g)].map(m=>keys(balancedObject(a,m.index)));
  if(payloads.length<2)throw new Error("referee runtime payload contracts missing");
  return {sources:[atomic,get,"src/features/referee-v5/server/edgeHttpHandler.js","docs/v5/referee-v5/V5-D_RPC_SPECIFICATION.md","docs/v5/referee-v5/V5-D1_ATOMIC_COMMIT_SPECIFICATION.md","tests/referee-v5/referee-v5-d1.test.js"],functions:[
    {name:"referee_v5_get_match_state",parameters:["p_tenant_id","p_tournament_id","p_match_id"],parameterDetails:["p_tenant_id","p_tournament_id","p_match_id"].map(name=>({name,type:"text",hasDefault:false})),returns:"jsonb",security:"definer",searchPathIncludes:["public"],executeRoles:["authenticated"],deniedRoles:["public"]},
    {name:"referee_v5_commit_match_transition",parameters:[...payloads[0],"p_staging_fault"],parameterDetails:["text","text","text","uuid","text","jsonb","integer","bigint","text","text","text","jsonb","jsonb","text","text","jsonb","text"].map((type,i)=>({name:[...payloads[0],"p_staging_fault"][i],type,hasDefault:i>=15})),optionalParameters:["p_state_before","p_staging_fault"],returns:"jsonb",security:"definer",searchPathIncludes:["pg_catalog","public"],executeRoles:["service_role"],deniedRoles:["public","anon","authenticated"]},
    {name:"referee_v5_commit_match_finalization",parameters:[...payloads[1],"p_staging_fault"],parameterDetails:["text","text","text","uuid","integer","text","text","jsonb","jsonb","text","text"].map((type,i)=>({name:[...payloads[1],"p_staging_fault"][i],type,hasDefault:i>=8})),optionalParameters:["p_outbox_events","p_override_reason","p_staging_fault"],returns:"jsonb",security:"definer",searchPathIncludes:["pg_catalog","public"],executeRoles:["service_role"],deniedRoles:["public","anon","authenticated"]},
  ],tables:["referee_assignments","match_live_states","match_events","match_sync_mutations"].map(name=>({name,rlsEnabled:true})),authorization:{callerBearer:true,assignmentRequired:true,tenantRequired:true,serviceRoleInternalOnly:true}};
}

export function parameterParts(value){const s=norm(value).replace(/\s+default\s+[\s\S]*$/,"");const m=s.match(/^([a-z0-9_]+)\s+([\s\S]+)$/);return m?{name:m[1],type:m[2]}:{name:s,type:""};}

export function deriveEdgeSourceContract(name){const rating=name.startsWith("rating"),index=`supabase/functions/${name}/index.ts`,authority=rating?"src/features/pick-vn-rating-v5/server/edgeEntry.js":"src/features/referee-v5/server/edgeHttpHandler.js",helper=rating?"src/features/pick-vn-rating-v5/server/edgeHttpHelpers.js":authority;return {sources:[index,authority,helper],...analyzeEdgeSources(name,{indexText:read(index),authorityText:read(authority),helperText:read(helper)})};}

export function deriveStorageTextContract(text){
  const statements=splitSql(text).map(s=>norm(s.replace(/--[^\n]*/g," "))),policy=name=>statements.find(s=>s.startsWith(`create policy "${name}"`)||s.startsWith(`create policy ${name} `))||"";
  const targetsAvatar=s=>/bucket_id\s*(?:=\s*'user-avatars'|in\s*\(\s*'user-avatars'\s*\)|=\s*any\s*\(\s*array\s*\[\s*'user-avatars'\s*\]\s*\))/.test(s),own=s=>/bucket_id\s*=\s*'user-avatars'/.test(s)&&!/\b(?:or|not)\b/.test(s)&&/\(storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/.test(s),roles=s=>(s.match(/\bto\s+(.+?)(?=\s+using|\s+with check|$)/)?.[1]||"public").split(",").map(norm);
  const writes=statements.filter(s=>/^create policy/.test(s)&&/\bon\s+storage\.objects\b/.test(s)&&/\bfor\s+(insert|update|delete|all)\b/.test(s)),unsafe=writes.filter(s=>roles(s).some(r=>r==="anon"||r==="public")),unsafeAuthenticated=writes.filter(s=>roles(s).includes("authenticated")&&(!/bucket_id/.test(s)||targetsAvatar(s))&&!own(s));
  const selectAnon=policy("user_avatars_select_anon"),insert=policy("user_avatars_insert"),update=policy("user_avatars_update"),del=policy("user_avatars_delete"),bucketMutations=statements.filter(s=>/^(insert\s+into|update)\s+storage\.buckets/.test(s)),last=bucketMutations.at(-1)||"";
  return {bucketPublic:/values\s*\(\s*'user-avatars'\s*,\s*'user-avatars'\s*,\s*true/.test(last)||/set\s+public\s*=\s*true/.test(last),anonymousSelect:/for\s+select\s+to\s+anon/.test(selectAnon)&&targetsAvatar(selectAnon),anonymousWritePolicies:unsafe.length,unsafeAuthenticatedWritePolicies:unsafeAuthenticated.length,authenticatedOwnInsert:/for\s+insert\s+to\s+authenticated/.test(insert)&&/with check/.test(insert)&&own(insert),authenticatedOwnUpdate:/for\s+update\s+to\s+authenticated/.test(update)&&/\busing\b/.test(update)&&/with check/.test(update)&&own(update),authenticatedOwnDelete:/for\s+delete\s+to\s+authenticated/.test(del)&&/\busing\b/.test(del)&&own(del),policyNames:[...text.matchAll(/create\s+policy\s+"?([a-z0-9_]+)"?/gi)].map(m=>m[1]).sort()};
}
export function deriveStorageSourceContract(rel){return deriveStorageTextContract(read(rel));}
