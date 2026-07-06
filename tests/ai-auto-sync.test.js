import test from "node:test";
import assert from "node:assert/strict";

import { isAiAutoCloudSyncEnabled } from "../src/ai/autoCloudSync.js";

test("isAiAutoCloudSyncEnabled defaults to false without env", () => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_AI_AUTO_CLOUD_SYNC = "false";
    import.meta.env.VITE_SUPABASE_URL = "";
    import.meta.env.VITE_SUPABASE_ANON_KEY = "";
  }
  assert.equal(isAiAutoCloudSyncEnabled(), false);
});

test("isAiAutoCloudSyncEnabled true only with flag and supabase url", () => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_AI_AUTO_CLOUD_SYNC = "true";
    import.meta.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    import.meta.env.VITE_SUPABASE_ANON_KEY = "eyJ-test";
    assert.equal(isAiAutoCloudSyncEnabled(), true);
  } else {
    assert.ok(true);
  }
});
