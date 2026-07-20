/**
 * Read-only verification queue profile source (Phase 1H-B).
 *
 * Default path queries Identity `profiles` with a narrow column select.
 * Callers must authorize before invoking; this module does not enforce RBAC.
 */
import {
  getSupabaseAuthClient,
  hasSupabaseConfig,
  PROFILES_TABLE,
} from "../../../auth/supabaseClient.js";
import { VERIFICATION_QUEUE_MAX_LIMIT } from "../constants/verificationQueue.js";
import { trimId } from "../utils/playerId.js";

/** Narrow select — never pull privacy_settings / unrelated PII for the queue. */
export const VERIFICATION_QUEUE_PROFILE_SELECT = [
  "id",
  "player_id",
  "display_name",
  "activity_region",
  "identity_verification_status",
  "venue_id",
  "updated_at",
].join(", ");

/**
 * @param {object} [query]
 * @param {string} query.status — required normalized verification status
 * @param {string|null} [query.venueId]
 * @param {number} [query.fetchLimit]
 * @returns {Promise<{ ok: boolean, rows?: object[], code?: string, error?: string }>}
 */
export async function listVerificationQueueProfileRows(query = {}) {
  const status = trimId(query.status);
  if (!status) {
    return { ok: false, code: "VALIDATION_ERROR", error: "status is required" };
  }

  if (!hasSupabaseConfig()) {
    return {
      ok: false,
      code: "PERSISTENCE_UNAVAILABLE",
      error: "Supabase is not configured for verification queue reads",
    };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return {
      ok: false,
      code: "PERSISTENCE_UNAVAILABLE",
      error: "Supabase client unavailable for verification queue reads",
    };
  }

  const fetchLimit = Math.max(
    1,
    Math.min(
      VERIFICATION_QUEUE_MAX_LIMIT * 2,
      Number(query.fetchLimit) || VERIFICATION_QUEUE_MAX_LIMIT * 2
    )
  );
  const venueId = trimId(query.venueId) || null;

  let builder = client
    .from(PROFILES_TABLE)
    .select(VERIFICATION_QUEUE_PROFILE_SELECT)
    .eq("identity_verification_status", status)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(fetchLimit);

  if (venueId) {
    builder = builder.eq("venue_id", venueId);
  }

  const { data, error } = await builder;
  if (error) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      error: error.message || "Failed to list verification queue profiles",
    };
  }

  return { ok: true, rows: Array.isArray(data) ? data : [] };
}
