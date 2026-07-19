/**
 * Map Supabase / Postgres profile write failures to stable Player Management codes.
 * Never returns connection strings, keys, or raw client config.
 */
import { WRITE_ERROR_CODES } from "../constants/writableFields.js";

const REDACT =
  /(postgres(ql)?:\/\/\S+)|((?:svc|service)[_-]?role)|(\beyJ[A-Za-z0-9_-]{20,})|(sb_[a-z]+_[A-Za-z0-9]+)|(password=\S+)/gi;

function sanitizeMessage(raw) {
  const text = String(raw || "Unknown database failure").trim();
  return text.replace(REDACT, "[redacted]").slice(0, 280);
}

/**
 * @param {object|null|undefined} error — Supabase error, thrown Error, or { code, message, error }
 * @param {object} [context]
 * @returns {{ code: string, message: string }}
 */
export function mapProfilesWriteError(error, context = {}) {
  const pgCode = String(error?.code || error?.error_code || "").trim();
  const rawMessage = error?.message || error?.error || error?.details || "";
  const message = sanitizeMessage(rawMessage);
  const lower = message.toLowerCase();

  if (
    pgCode === "NO_SUPABASE" ||
    pgCode === "PERSISTENCE_UNAVAILABLE" ||
    /chưa cấu hình|not configured|no supabase/i.test(message)
  ) {
    return {
      code: WRITE_ERROR_CODES.PERSISTENCE_UNAVAILABLE,
      message: "Profile persistence is unavailable (Supabase client not configured)",
    };
  }

  if (/cannot self-modify identity_verification/i.test(message)) {
    return {
      code: WRITE_ERROR_CODES.UNAUTHORIZED,
      message: "Not authorized to modify identity verification status",
    };
  }

  if (
    pgCode === "42501" ||
    /permission denied|row-level security|rls|violates row-level security/i.test(lower)
  ) {
    return {
      code: WRITE_ERROR_CODES.RLS_DENIED,
      message: "Row-level security denied this profile update",
    };
  }

  if (
    pgCode === "23514" ||
    /check constraint|profiles_birth_date_not_future|profiles_handedness_check|profiles_privacy|profiles_activity_region|profiles_identity_verification/i.test(
      lower
    )
  ) {
    return {
      code: WRITE_ERROR_CODES.CONSTRAINT_VIOLATION,
      message: message || "Profile update violated a database constraint",
    };
  }

  if (pgCode === "23505" || /duplicate key|unique constraint/i.test(lower)) {
    return {
      code: WRITE_ERROR_CODES.CONSTRAINT_VIOLATION,
      message: "Profile update violated a uniqueness constraint",
    };
  }

  // PostgREST: .single() with 0 rows — often RLS hide or missing profile
  if (
    pgCode === "PGRST116" ||
    /0 rows|cannot coerce|json object requested|not found/i.test(lower)
  ) {
    if (context.preferNotFound) {
      return {
        code: WRITE_ERROR_CODES.PLAYER_NOT_FOUND,
        message: "Player profile row was not found",
      };
    }
    return {
      code: WRITE_ERROR_CODES.RLS_DENIED,
      message: "Profile update returned no row (RLS denial or missing profile)",
    };
  }

  if (pgCode === "PROFILE_UPDATE_FAILED" || pgCode === "22P02") {
    return {
      code: WRITE_ERROR_CODES.CONSTRAINT_VIOLATION,
      message: message || "Profile update failed validation at the database",
    };
  }

  return {
    code: WRITE_ERROR_CODES.UNKNOWN_DATABASE_FAILURE,
    message: message || "Unknown database failure during profile persistence",
  };
}
