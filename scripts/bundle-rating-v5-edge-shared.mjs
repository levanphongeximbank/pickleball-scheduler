#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const entry = join(projectRoot, "src/features/pick-vn-rating-v5/server/edgeEntry.js");
const outDir = join(projectRoot, "supabase/functions/_shared");
const outfile = join(outDir, "ratingV5Server.mjs");

mkdirSync(outDir, { recursive: true });

execSync(
  `npx esbuild "${entry}" --bundle --platform=neutral --format=esm --outfile="${outfile}" --banner:js="/* Rating V5 trusted server bundle */"`,
  { cwd: projectRoot, stdio: "inherit" },
);

console.log(`PASS — bundled ${outfile}`);
