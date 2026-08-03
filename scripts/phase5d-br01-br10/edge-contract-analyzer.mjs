import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const {parse}=require("@babel/parser");
const childNodes=(node)=>Object.values(node||{}).flatMap(v=>Array.isArray(v)?v:v&&typeof v==="object"?[v]:[]).filter(v=>v&&typeof v.type==="string");
const walk=(node,visit)=>{visit(node);for(const child of childNodes(node))walk(child,visit);};
const walkExecutable=(node,visit)=>{visit(node);if(node?.type==="IfStatement"&&node.test?.type==="BooleanLiteral"&&node.test.value===false){if(node.alternate)walkExecutable(node.alternate,visit);return;}for(const child of childNodes(node))walkExecutable(child,visit);};
const memberName=(node)=>node?.type==="MemberExpression"?(node.computed?literal(node.property):node.property?.name):null;
const literal=(node)=>node?.type==="StringLiteral"||node?.type==="NumericLiteral"?node.value:node?.type==="Identifier"?node.name:null;
const calleePath=(node)=>{if(node?.type==="Identifier")return node.name;if(node?.type!=="MemberExpression")return "";return [calleePath(node.object),memberName(node)].filter(Boolean).join(".");};
const envNames=(ast)=>{const out=new Set();walk(ast,n=>{if(n.type==="CallExpression"&&calleePath(n.callee)==="Deno.env.get"&&typeof literal(n.arguments[0])==="string")out.add(literal(n.arguments[0]));});return [...out].sort();};
const switchPairs=(ast)=>{const out=[];walk(ast,n=>{if(n.type!=="SwitchStatement")return;let pending=[];for(const c of n.cases){if(c.test)pending.push(calleePath(c.test)||literal(c.test));const ret=c.consequent.find(x=>x.type==="ReturnStatement"&&typeof literal(x.argument)==="number");if(ret){for(const code of pending)out.push({code:String(code).split(".").at(-1),status:literal(ret.argument)});pending=[];}}});return out;};
const functionMap=(ast)=>{const map=new Map();walk(ast,n=>{if(n.type==="FunctionDeclaration"&&n.id?.name)map.set(n.id.name,n);if(n.type==="VariableDeclarator"&&n.id?.type==="Identifier"&&["ArrowFunctionExpression","FunctionExpression"].includes(n.init?.type))map.set(n.id.name,n.init);});return map;};
const reachableNodes=(ast,roots)=>{const functions=functionMap(ast),queue=[...roots],seen=new Set(),nodes=[];while(queue.length){const name=queue.shift();if(seen.has(name)||!functions.has(name))continue;seen.add(name);const fn=functions.get(name);nodes.push(fn);walkExecutable(fn,n=>{if(n.type==="CallExpression"&&n.callee?.type==="Identifier"&&functions.has(n.callee.name))queue.push(n.callee.name);});}return nodes;};
const guardedReturn=(scopes,names,status)=>scopes.some(scope=>{let found=false;walkExecutable(scope,n=>{if(found||n.type!=="IfStatement")return;const test=JSON.stringify(n.test),body=JSON.stringify(n.consequent);if(names.some(name=>test.includes(`\"name\":\"${name}\"`))&&body.includes('"type":"ReturnStatement"')&&body.includes(`"value":${status}`))found=true;});return found;});
const guardedFailure=(scopes,names)=>scopes.some(scope=>{let found=false;walkExecutable(scope,n=>{if(found||n.type!=="IfStatement")return;const test=JSON.stringify(n.test),body=JSON.stringify(n.consequent);if(names.some(name=>test.includes(`\"name\":\"${name}\"`))&&body.includes('"type":"ReturnStatement"')&&body.includes('"name":"ok"')&&body.includes('"value":false'))found=true;});return found;});
const exactNegativeGuard=(scopes,object,property,status)=>scopes.some(scope=>{let found=false;walkExecutable(scope,n=>{if(found||n.type!=="IfStatement")return;const t=n.test,negative=t?.type==="UnaryExpression"&&t.operator==="!",target=negative?t.argument:null,match=property?target?.type==="MemberExpression"&&target.object?.type==="Identifier"&&target.object.name===object&&memberName(target)===property:target?.type==="Identifier"&&target.name===object;if(match&&JSON.stringify(n.consequent).includes('"type":"ReturnStatement"')&&JSON.stringify(n.consequent).includes(`"value":${status}`))found=true;});return found;});
const assignedCall=(scopes,binding,callSuffix,dependencies=[])=>scopes.some(scope=>{let found=false;walkExecutable(scope,n=>{if(found||n.type!=="VariableDeclarator"||n.id?.name!==binding)return;const init=n.init?.type==="AwaitExpression"?n.init.argument:n.init;if(init?.type!=="CallExpression"||!calleePath(init.callee).endsWith(callSuffix))return;const body=JSON.stringify(init.arguments);if(dependencies.every(d=>body.includes(`"name":"${d}"`)))found=true;});return found;});

export function analyzeEdgeSources(name,{indexText,authorityText,helperText=""}){
  const parseOne=(text,typescript=false)=>parse(text,{sourceType:"module",plugins:typescript?["typescript"]:[]});
  const index=parseOne(indexText,true),authority=parseOne(authorityText),helper=helperText?parseOne(helperText):authority,rating=name.startsWith("rating");
  const authorityRoots=rating?["handleCompleteAssessmentHttpRequest"]:["handleRefereeV5MatchHttpRequest"],scopes=[...reachableNodes(authority,authorityRoots),...reachableNodes(index,["createSupabaseClients"])],calls=[];for(const scope of scopes)walkExecutable(scope,n=>{if(n.type==="CallExpression")calls.push(n);});
  const callPaths=calls.map(n=>calleePath(n.callee));
  const clientCalls=calls.filter(n=>calleePath(n.callee)==="createClient");
  const hasUserClient=clientCalls.some(n=>calleePath(n.arguments[1])==="anonKey"&&JSON.stringify(n.arguments[2]||{}).includes("Authorization")&&JSON.stringify(n.arguments[2]||{}).includes("authHeader"));
  const hasServiceClient=clientCalls.some(n=>calleePath(n.arguments[1])==="serviceKey"&&!JSON.stringify(n.arguments[2]||{}).includes("Authorization"));
  const statusScopes=reachableNodes(helper,["mapHttpStatus"]),pairs=statusScopes.flatMap(s=>switchPairs(s));
  const identifiers=new Set();for(const scope of scopes)walkExecutable(scope,n=>{if(n.type==="Identifier")identifiers.add(n.name);});
  const authenticationEnforced=rating?assignedCall(scopes,"userResult","auth.getUser")&&exactNegativeGuard(scopes,"user",null,401):assignedCall(scopes,"verified","verifyBearerToken",["userClient"])&&exactNegativeGuard(scopes,"verified","ok",401)&&guardedFailure(scopes,["error","data"]);
  const tenantEnforced=rating?assignedCall(scopes,"tenantId","resolveTenantId",["user"])&&exactNegativeGuard(scopes,"tenantId",null,403):assignedCall(scopes,"assignment","findAssignmentByUserAndMatch",["verified"])&&exactNegativeGuard(scopes,"assignment",null,403);
  return {
    environment:envNames(index),
    callerBearer:callPaths.includes("req.headers.get")||callPaths.includes("request.headers.get"),
    authenticatedUser:callPaths.some(x=>x.endsWith(".auth.getUser")),
    authenticationEnforced,
    userClientUsesAnonBearer:hasUserClient,
    serviceClientUsesServiceKey:hasServiceClient,
    serviceRoleInternal:hasServiceClient&&(identifiers.has("serviceClient")||identifiers.has("service")),
    tenantAuthorization:rating?callPaths.includes("resolveTenantId"):identifiers.has("tenantId")&&callPaths.some(x=>x.endsWith("findAssignmentByUserAndMatch")),
    tenantEnforced,
    ownershipAuthorization:rating?callPaths.includes("fetchAssessmentRow")&&identifiers.has("user_id"):null,
    assignmentAuthorization:rating?null:callPaths.some(x=>x.endsWith("findAssignmentByUserAndMatch"))&&identifiers.has("REFEREE_NOT_ASSIGNED"),
    assignmentEnforced:rating?null:assignedCall(scopes,"assignment","findAssignmentByUserAndMatch",["verified"])&&exactNegativeGuard(scopes,"assignment",null,403),
    roleAuthorization:rating?null:identifiers.has("assignment"),
    statusMap:pairs,
    statusMapperReachable:callPaths.includes("mapHttpStatus"),
    statusCodes:[...new Set(pairs.map(x=>x.status))].sort((a,b)=>a-b),
    errorCodes:[...new Set(pairs.map(x=>x.code))].sort(),
  };
}
