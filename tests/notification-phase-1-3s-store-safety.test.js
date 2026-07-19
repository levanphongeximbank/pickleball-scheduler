import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createNotificationRepository,
  NOTIFICATION_STORE_MODES,
} from "../src/features/notifications/repositories/notificationRepository.js";

describe("Notification Phase 1.3S — staging store safety", () => {
  it("refuses silent local fallback when supabase mode is required", () => {
    const prev = process.env.VITE_NOTIFICATION_REQUIRE_SUPABASE;
    process.env.VITE_NOTIFICATION_REQUIRE_SUPABASE = "true";
    try {
      assert.throws(
        () =>
          createNotificationRepository({
            mode: NOTIFICATION_STORE_MODES.SUPABASE,
            client: null,
          }),
        /Refusing silent local fallback/
      );
    } finally {
      if (prev === undefined) delete process.env.VITE_NOTIFICATION_REQUIRE_SUPABASE;
      else process.env.VITE_NOTIFICATION_REQUIRE_SUPABASE = prev;
    }
  });
});
