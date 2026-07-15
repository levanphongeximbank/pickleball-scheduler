import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Importing a `*.test.js` file from inside a running test registers that module's
// top-level `test()` calls as subtests of the caller. When the caller resolves
// before those injected subtests finish, node:test marks them `cancelledByParent`
// (observed on Linux Node 22; masked as duplicate passing tests on Node 24).
// Resolving + existence-checking the specifier verifies the import surface stays
// available without executing foreign test registrations.
export function assertTestModuleAvailable(specifier, baseUrl) {
  const filePath = fileURLToPath(new URL(specifier, baseUrl));
  if (!existsSync(filePath)) {
    throw new Error(`Expected test module to remain available: ${specifier}`);
  }
  return filePath;
}
