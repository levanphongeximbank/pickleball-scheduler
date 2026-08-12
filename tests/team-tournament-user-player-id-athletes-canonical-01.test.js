/**
 * Local-only package contract for athletes-canonical player helper.
 * Does not mutate Staging.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = join(
  __dirname,
  "../docs/v5/migrations/team-tournament-user-player-id-athletes-canonical-01"
);

function read(name) {
  return readFileSync(join(pkg, name), "utf8");
}

describe("team-tournament-user-player-id-athletes-canonical-01", () => {
  it("APPLY replaces profiles.player_id with athletes.id authority", () => {
    const apply = read("02_APPLY.sql");
    const verify = read("03_VERIFY.sql");
    const precheck = read("01_PRECHECK.sql");
    const rollback = read("04_ROLLBACK.sql");

    assert.match(precheck, /c168c14f87ad03a2a246150cd47afcf3/);
    assert.match(apply, /from public\.athletes a/);
    assert.match(apply, /a\.user_id = auth\.uid\(\)/);
    assert.doesNotMatch(apply, /p\.player_id/);
    assert.match(verify, /legacy profiles\.player_id authority still present/);
    assert.match(rollback, /from public\.profiles p/);
    assert.match(rollback, /p\.player_id/);
  });
});
