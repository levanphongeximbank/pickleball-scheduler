#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const entry = join(projectRoot, "src/features/referee-v5/server/edgeEntry.js");
const outDir = join(projectRoot, "supabase/functions/_shared");
const outfile = join(outDir, "refereeV5Server.mjs");
const supabaseStub = join(
  projectRoot,
  "scripts/bundle-stubs/supabase-js-edge-stub.js"
);

mkdirSync(outDir, { recursive: true });

execSync(
  `npx esbuild "${entry}" --bundle --platform=neutral --format=esm --outfile="${outfile}" --banner:js="/* Referee V5 trusted server bundle */" --alias:@supabase/supabase-js="${supabaseStub}"`,
  { cwd: projectRoot, stdio: "inherit" },
);

console.log(`PASS — bundled ${outfile}`);
