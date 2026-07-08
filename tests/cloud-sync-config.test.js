import test from "node:test";
import assert from "node:assert/strict";

import { isClubCloudSyncEnabled } from "../src/ai/cloudSyncConfig.js";

test("isClubCloudSyncEnabled follows VITE_CLUB_CLOUD_SYNC=true", () => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_CLUB_CLOUD_SYNC = "true";
    import.meta.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    import.meta.env.VITE_SUPABASE_ANON_KEY = "eyJ-test";
    import.meta.env.VITE_COURT_ENGINE_STORE = "local";
    import.meta.env.VITE_AI_AUTO_CLOUD_SYNC = "false";
    assert.equal(isClubCloudSyncEnabled(), true);
  }
});

test("isClubCloudSyncEnabled true when court engine store is supabase", () => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_CLUB_CLOUD_SYNC = "";
    import.meta.env.VITE_AI_AUTO_CLOUD_SYNC = "false";
    import.meta.env.VITE_COURT_ENGINE_STORE = "supabase";
    import.meta.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    import.meta.env.VITE_SUPABASE_ANON_KEY = "eyJ-test";
    assert.equal(isClubCloudSyncEnabled(), true);
  }
});

test("isClubCloudSyncEnabled false when explicitly disabled", () => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_CLUB_CLOUD_SYNC = "false";
    import.meta.env.VITE_COURT_ENGINE_STORE = "supabase";
    import.meta.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    import.meta.env.VITE_SUPABASE_ANON_KEY = "eyJ-test";
    assert.equal(isClubCloudSyncEnabled(), false);
  }
});
