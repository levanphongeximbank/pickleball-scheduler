/**
 * Durable Player Management write repository → public.profiles (anon/authenticated client).
 *
 * - Uses getSupabaseAuthClient() only (anon / session JWT — never a privileged server key in browser code)
 * - Does not bypass RLS
 * - Refuses identityVerificationStatus / verificationStatus on this path
 * - Privileged verification updates are intentionally NOT implemented here (later phase)
 */
import { PROFILES_TABLE, getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { updateProfileRowById } from "../../../auth/profileService.js";
import { adaptProfileRow } from "../adapters/profileAdapter.js";
import { buildProfilesUpdateRow } from "../adapters/profilesWriteMapper.js";
import { WRITE_ERROR_CODES } from "../constants/writableFields.js";
import { normalizePlayerProfile } from "../models/playerProfile.js";
import { mapProfilesWriteError } from "../services/mapProfilesWriteError.js";
import { trimId } from "../utils/playerId.js";

const PRIVILEGED_VERIFICATION_KEYS = Object.freeze([
  "verificationStatus",
  "identityVerificationStatus",
  "identity_verification_status",
]);

/**
 * @param {object} [deps]
 * @param {() => object|null} [deps.getClient]
 * @param {object} [deps.supabase] — authenticated session/anon client (preferred runtime injection)
 * @param {(userId: string, patch: object) => Promise<object>} [deps.updateProfileRowById]
 * @param {() => boolean} [deps.hasConfig]
 */
export function createSupabaseProfilesPlayerWriteRepository(deps = {}) {
  const getClient =
    deps.getClient ||
    (deps.supabase ? () => deps.supabase : null) ||
    getSupabaseAuthClient;
  const updateRow = deps.updateProfileRowById || updateProfileRowById;
  const hasConfig = deps.hasConfig || hasSupabaseConfig;

  return {
    kind: "supabase_profiles",
    durable: true,

    async getByPlayerId(playerId) {
      const id = trimId(playerId);
      if (!id) return null;
      if (!hasConfig()) return null;

      const client = getClient();
      if (!client) return null;

      const { data, error } = await client
        .from(PROFILES_TABLE)
        .select("*")
        .eq("player_id", id)
        .maybeSingle();

      if (error || !data) return null;
      return normalizePlayerProfile(adaptProfileRow(data));
    },

    /**
     * @param {string} playerId — canonical player id (profiles.player_id)
     * @param {object} patch — validated camelCase fields
     * @param {object} [meta]
     * @param {string} [meta.authUserId] — profiles.id (auth uid); required for UPDATE
     */
    async saveProfileFields(playerId, patch, meta = {}) {
      const id = trimId(playerId);
      if (!id) {
        return {
          ok: false,
          code: WRITE_ERROR_CODES.PLAYER_ID_REQUIRED,
          message: "playerId is required",
          durable: false,
        };
      }

      const privileged = PRIVILEGED_VERIFICATION_KEYS.filter((k) =>
        Object.prototype.hasOwnProperty.call(patch || {}, k)
      );
      if (privileged.length > 0) {
        return {
          ok: false,
          code: WRITE_ERROR_CODES.FORBIDDEN_FIELD,
          message:
            "identity verification status cannot be set via updatePlayerProfile; use a privileged admin path (not in Phase 1C durable wave)",
          forbiddenFields: privileged,
          durable: false,
        };
      }

      if (!hasConfig()) {
        return {
          ok: false,
          code: WRITE_ERROR_CODES.PERSISTENCE_UNAVAILABLE,
          message: "Profile persistence is unavailable (Supabase client not configured)",
          durable: false,
        };
      }

      const { row, mappedFields, skippedFields } = buildProfilesUpdateRow(patch);
      if (mappedFields.length === 0) {
        return {
          ok: false,
          code: WRITE_ERROR_CODES.INVALID_PATCH,
          message:
            skippedFields.length > 0
              ? `No durable profiles columns for patch fields: ${skippedFields.join(", ")}`
              : "Patch produced an empty profiles update",
          skippedFields,
          durable: false,
        };
      }

      let authUserId = trimId(meta.authUserId);
      if (!authUserId) {
        const existing = await this.getByPlayerId(id);
        authUserId = trimId(existing?.authUserId);
      }
      if (!authUserId) {
        return {
          ok: false,
          code: WRITE_ERROR_CODES.PLAYER_NOT_FOUND,
          message: "Cannot resolve auth user id for canonical playerId; refusing invent identity",
          durable: false,
        };
      }

      try {
        const result = await updateRow(authUserId, row);
        if (!result?.ok) {
          const mapped = mapProfilesWriteError(
            { code: result?.code, message: result?.error || result?.message },
            { preferNotFound: false }
          );
          return {
            ok: false,
            code: mapped.code,
            message: mapped.message,
            persistedFields: [],
            durable: false,
          };
        }

        const profile = normalizePlayerProfile({
          ...adaptProfileRow(result.profile),
          playerId: adaptProfileRow(result.profile)?.playerId || id,
        });

        return {
          ok: true,
          profile,
          persistedFields: mappedFields,
          deferredFields: skippedFields,
          schemaGaps: [],
          migrationRequired: false,
          durable: true,
          message: null,
        };
      } catch (error) {
        const mapped = mapProfilesWriteError(error);
        return {
          ok: false,
          code: mapped.code,
          message: mapped.message,
          persistedFields: [],
          durable: false,
        };
      }
    },
  };
}
