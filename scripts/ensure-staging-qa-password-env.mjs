#!/usr/bin/env node
/**
 * Ensure QA password env vars exist in gitignored .env.staging-qa.local (never logs values).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env.staging-qa.local");

function randomPassword() {
  return `${crypto.randomBytes(18).toString("base64url")}Aa1!`;
}

function upsertEnvLine(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const suffix = content.endsWith("\n") || content.length === 0 ? "" : "\n";
  return `${content}${suffix}${line}\n`;
}

let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

for (const key of ["STAGING_PLAYER_NEW_PASSWORD", "STAGING_NON_COHORT_NEW_PASSWORD"]) {
  const existing = String(process.env[key] || "").trim();
  if (existing) {
    continue;
  }
  const fromFile = content.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (fromFile?.[1]?.trim()) {
    process.env[key] = fromFile[1].trim();
    continue;
  }
  const generated = randomPassword();
  content = upsertEnvLine(content, key, generated);
  process.env[key] = generated;
}

fs.writeFileSync(envPath, content);
console.log("QA password env vars ready (values not logged)");
