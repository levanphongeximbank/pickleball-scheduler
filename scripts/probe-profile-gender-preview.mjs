import fs from "node:fs";
import { spawnSync } from "node:child_process";

const preview =
  process.argv[2] ||
  "https://pickleball-scheduler-git-fix-profil-f85a48-pickleball-scheduler.vercel.app";

const inspect = spawnSync(
  "npx",
  ["vercel", "inspect", preview.replace(/^https?:\/\//, ""), "--json"],
  { encoding: "utf8", shell: true }
);
const raw = `${inspect.stdout || ""}${inspect.stderr || ""}`;
let meta = {};
try {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    meta = JSON.parse(raw.slice(start, end + 1));
  }
} catch {
  meta = { parseError: true, rawHead: raw.slice(0, 500) };
}
const deployment = meta.deployment || meta;
const m = deployment.meta || {};

const html = await fetch(preview).then((r) => r.text());
const assets = [...html.matchAll(/\/assets\/(index|AthleteSelfProfilePage)-[^"'\\s]+\\.js/g)].map(
  (x) => x[0]
);
const findings = {
  preview,
  deploymentId: deployment.id || deployment.uid || null,
  readyState: deployment.readyState || null,
  githubCommitSha: m.githubCommitSha || null,
  githubCommitRef: m.githubCommitRef || null,
  githubCommitMessage: m.githubCommitMessage || null,
  assets,
  htmlHasStagingRef: html.includes("qyewbxjsiiyufanzcjcq"),
  htmlHasProdRef: html.includes("expuvcohlcjzvrrauvud"),
};

for (const asset of assets.slice(0, 4)) {
  const js = await fetch(new URL(asset, preview)).then((r) => r.text());
  findings[asset] = {
    bytes: js.length,
    hasNormalizeProfileGender: js.includes("normalizeProfileGender"),
    hasProfileQaLog: js.includes("[profile-qa]"),
    hasMaleFemaleOther: js.includes('"male"') && js.includes('"female"') && js.includes('"other"'),
    hasLegacyNamValuePattern: /value:\s*"Nam"|value:\s*'Nam'/.test(js),
  };
}

fs.mkdirSync("docs/v5/qa-evidence/phase-profile-gender", { recursive: true });
fs.writeFileSync(
  "docs/v5/qa-evidence/phase-profile-gender/PREVIEW_PROBE.json",
  JSON.stringify(findings, null, 2)
);
console.log(JSON.stringify(findings, null, 2));
