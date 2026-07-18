import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCaptainPortalPath,
  buildCaptainPortalUrl,
} from "../src/components/tournament/team/copyPortalLink.js";

test("buildCaptainPortalPath — includes club query when provided", () => {
  assert.equal(
    buildCaptainPortalPath("team-tournament-abc", {
      clubId: "club-219e4a7cbd73437eb6271f02a53314c3",
    }),
    "/team-portal/team-tournament-abc?club=club-219e4a7cbd73437eb6271f02a53314c3"
  );
  assert.equal(buildCaptainPortalPath("team-tournament-abc"), "/team-portal/team-tournament-abc");
  assert.equal(
    buildCaptainPortalPath("team-tournament-abc", { clubId: "  " }),
    "/team-portal/team-tournament-abc"
  );
});

test("buildCaptainPortalUrl — absolute URL with optional club", () => {
  const prev = globalThis.window;
  globalThis.window = { location: { origin: "https://pickvn.app" } };
  try {
    assert.equal(
      buildCaptainPortalUrl("team-tournament-4rv7plln", {
        clubId: "club-accc",
      }),
      "https://pickvn.app/team-portal/team-tournament-4rv7plln?club=club-accc"
    );
  } finally {
    if (prev === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = prev;
    }
  }
});
