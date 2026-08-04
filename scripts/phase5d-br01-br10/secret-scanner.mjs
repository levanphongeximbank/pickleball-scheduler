const VALUE="[A-Za-z0-9_./+\\-=]{8,}";
const patterns=[
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
  /sb_(?:secret|service_role)_[a-zA-Z0-9_-]{12,}/i,
  /(?:ghp|github_pat|glpat|sk_live|sk_test)_[A-Za-z0-9_-]{16,}/i,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  new RegExp(`(?:service[_-]?role(?:[_-]?key)?|password|api[_-]?key|client[_-]?secret|secret)\\s*[=:]\\s*["']?(${VALUE})["']?`,`i`),
  new RegExp(`["'](?:service[_-]?role(?:[_-]?key)?|password|api[_-]?key|client[_-]?secret|secret)["']\\s*:\\s*["'](${VALUE})["']`,`i`),
  new RegExp(`["']?(?:access|refresh)[_-]?token["']?\\s*[=:]\\s*["']?(${VALUE})["']?`,`i`),
];

export function findSecretCandidates(text){
  const sanitized=String(text).replace(/\$\{[A-Z_][A-Z0-9_]*\}|\$[A-Z_][A-Z0-9_]*|Deno\.env\.get\([^)]*\)|process\.env\.[A-Z_][A-Z0-9_]*/g,"ENV_REFERENCE");
  return patterns.flatMap((pattern,index)=>[...sanitized.matchAll(new RegExp(pattern.source,`${pattern.flags.replace("g","")}g`))]
    .filter(m=>!m[0].includes("ENV_REFERENCE"))
    // Object member references such as `password: actor.password` are code,
    // not embedded credential values. Quoted values remain reportable.
    .filter(m=>!(index===5 && !/\s*[=:]\s*["']/.test(m[0]) && /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(m[1]||"")))
    .map(m=>({pattern:index,match:m[0].slice(0,80)})));
}
