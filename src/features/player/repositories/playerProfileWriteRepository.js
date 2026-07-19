/**
 * Phase 1C player profile write repository interface + implementations.
 *
 * - Unconfigured default: explicit operational failure (no silent durable write)
 * - Memory double: tests / explicitly injected non-production only
 * - Phase1C deferred: optional Identity birthYear writer; gap fields fail closed
 *   with SCHEMA_MIGRATION_REQUIRED (legacy path; prefer supabase durable repo)
 * - Durable: createSupabaseProfilesPlayerWriteRepository (separate module)
 *
 * Does not create a second player identity store.
 * Privileged identity verification updates are not part of this normal write path.
 */
import { WRITE_ERROR_CODES } from "../constants/writableFields.js";
import { normalizePlayerProfile } from "../models/playerProfile.js";

/** Fields that have no profiles/athletes column today (except birthYear). */
export const SCHEMA_GAP_FIELDS = Object.freeze([
  "birthDate",
  "handedness",
  "activityRegion",
  "privacySettings",
  "verificationStatus",
]);

/**
 * Default production-safe repository: no writer configured.
 * Never persists; never invents durable success.
 */
export { createSupabaseProfilesPlayerWriteRepository } from "./supabaseProfilesPlayerWriteRepository.js";

export function createUnconfiguredPlayerProfileWriteRepository() {
  return {
    kind: "unconfigured",
    durable: false,
    async getByPlayerId() {
      return null;
    },
    async saveProfileFields() {
      return {
        ok: false,
        code: WRITE_ERROR_CODES.PERSISTENCE_NOT_CONFIGURED,
        message:
          "Player profile write repository is not configured; no production persistence is available in Phase 1C",
        persistedFields: [],
        deferredFields: [],
        schemaGaps: [...SCHEMA_GAP_FIELDS],
        migrationRequired: true,
        durable: false,
      };
    },
  };
}

/**
 * In-memory write repository for tests / explicitly injected non-production doubles.
 * Results are marked durable:false so callers cannot treat them as Production writes.
 */
export function createMemoryPlayerProfileWriteRepository(seed = {}) {
  /** @type {Map<string, object>} */
  const store = new Map();
  for (const [id, row] of Object.entries(seed)) {
    store.set(String(id), normalizePlayerProfile({ ...row, playerId: id }));
  }

  return {
    kind: "memory",
    durable: false,
    async getByPlayerId(playerId) {
      const id = String(playerId || "").trim();
      if (!id) return null;
      return store.has(id) ? { ...store.get(id) } : null;
    },
    async saveProfileFields(playerId, patch, meta = {}) {
      const id = String(playerId || "").trim();
      if (!id) {
        return {
          ok: false,
          code: WRITE_ERROR_CODES.PLAYER_ID_REQUIRED,
          message: "playerId is required",
          durable: false,
        };
      }
      const existing = store.get(id) || normalizePlayerProfile({ playerId: id });
      if (existing.playerId && existing.playerId !== id) {
        return {
          ok: false,
          code: WRITE_ERROR_CODES.DUPLICATE_IDENTITY_FORBIDDEN,
          message: "Refusing to create or rebind a second player identity",
          durable: false,
        };
      }
      const next = normalizePlayerProfile({
        ...existing,
        ...patch,
        playerId: id,
        authUserId: meta.authUserId ?? existing.authUserId,
        updatedAt: new Date().toISOString(),
        createdAt: existing.createdAt || new Date().toISOString(),
      });
      store.set(id, next);
      return {
        ok: true,
        profile: { ...next },
        persistedFields: Object.keys(patch),
        deferredFields: [],
        schemaGaps: [],
        durable: false,
        message: "Stored in non-durable in-memory test double only",
      };
    },
    /** @internal test helper */
    _dump() {
      return new Map(store);
    },
  };
}

/**
 * Phase 1C deferred repository:
 * - May persist birthYear through Identity when identityBirthYearWriter provided
 * - SCHEMA_GAP_FIELDS → explicit SCHEMA_MIGRATION_REQUIRED failure (not silent success)
 * - Never creates a new player id / localStorage identity store
 *
 * @param {object} [deps]
 * @param {(args: { authUserId: string, birthYear: number|null }) => Promise<object>} [deps.identityBirthYearWriter]
 */
export function createPhase1cPlayerProfileWriteRepository(deps = {}) {
  const { identityBirthYearWriter = null } = deps;

  return {
    kind: "phase1c_deferred",
    durable: Boolean(identityBirthYearWriter),
    async getByPlayerId() {
      return null;
    },
    async saveProfileFields(playerId, patch, meta = {}) {
      const id = String(playerId || "").trim();
      if (!id) {
        return {
          ok: false,
          code: WRITE_ERROR_CODES.PLAYER_ID_REQUIRED,
          message: "playerId is required",
          durable: false,
        };
      }

      const gapTouched = SCHEMA_GAP_FIELDS.filter((f) =>
        Object.prototype.hasOwnProperty.call(patch, f)
      );
      const otherOwned = Object.keys(patch).filter((k) => !SCHEMA_GAP_FIELDS.includes(k));

      if (gapTouched.length > 0) {
        return {
          ok: false,
          code: WRITE_ERROR_CODES.SCHEMA_MIGRATION_REQUIRED,
          message:
            "Durable persistence for foundation profile fields requires an approved profiles schema migration",
          persistedFields: [],
          deferredFields: gapTouched,
          schemaGaps: gapTouched,
          migrationRequired: true,
          durable: false,
        };
      }

      if ("birthYear" in patch && typeof identityBirthYearWriter === "function" && meta.authUserId) {
        try {
          await identityBirthYearWriter({
            authUserId: meta.authUserId,
            birthYear: patch.birthYear,
          });
          const remaining = otherOwned.filter((k) => k !== "birthYear");
          if (remaining.length > 0) {
            return {
              ok: false,
              code: WRITE_ERROR_CODES.SCHEMA_MIGRATION_REQUIRED,
              message:
                "birthYear persisted via Identity; remaining fields lack durable storage pending migration",
              persistedFields: ["birthYear"],
              deferredFields: remaining,
              schemaGaps: remaining,
              migrationRequired: true,
              durable: true,
            };
          }
          return {
            ok: true,
            profile: normalizePlayerProfile({
              playerId: id,
              authUserId: meta.authUserId,
              birthYear: patch.birthYear,
            }),
            persistedFields: ["birthYear"],
            deferredFields: [],
            schemaGaps: [],
            migrationRequired: false,
            durable: true,
          };
        } catch (error) {
          return {
            ok: false,
            code: WRITE_ERROR_CODES.PERSISTENCE_ERROR,
            message: error?.message || "Identity birthYear write failed",
            durable: false,
          };
        }
      }

      return {
        ok: false,
        code: WRITE_ERROR_CODES.PERSISTENCE_NOT_CONFIGURED,
        message:
          "No durable Player profile writer is configured for these fields; inject a repository only for tests or wait for approved migration",
        persistedFields: [],
        deferredFields: Object.keys(patch),
        schemaGaps: SCHEMA_GAP_FIELDS.filter((f) => f in patch),
        migrationRequired: true,
        durable: false,
      };
    },
  };
}
