/**
 * Offline / V2-OFF / no-Supabase Club command adapter.
 * Phase 45A.3E — the ONLY UI-facing import surface for domain blob Club writers.
 *
 * Cloud-authoritative mode (VITE_CLUB_STORAGE_V2 + Supabase) must use
 * clubTenantService → clubStorageV2RpcService → club_create / club_update.
 *
 * updateClubMeta remains available under V2 solely for deferred blob-only
 * fields (e.g. note). It is not Club entity create/update authority.
 */
import {
  createClub as createClubDomain,
  renameClub as renameClubDomain,
  updateClubMeta as updateClubMetaDomain,
  deleteClub as deleteClubDomain,
} from "../../../domain/clubService.js";
import { assertLegacyClubEntityWriteAllowed } from "./clubLegacyWriteGuard.js";
import { syncClubsForVenueToCloud } from "./clubRegistryCloudService.js";

export function createClub(name) {
  const gate = assertLegacyClubEntityWriteAllowed({ operation: "createClub (offline)" });
  if (!gate.ok) return gate;
  return createClubDomain(name);
}

export function renameClub(clubId, name) {
  const gate = assertLegacyClubEntityWriteAllowed({ operation: "renameClub (offline)" });
  if (!gate.ok) return gate;
  return renameClubDomain(clubId, name);
}

/**
 * Blob-only / offline Club meta patch. Under V2, callers must only use this for
 * deferred non-entity fields (note/timezone/slug/…). Entity fields go through
 * clubTenantService.updateClub → club_update.
 */
export function updateClubMeta(clubId, patch = {}) {
  return updateClubMetaDomain(clubId, patch);
}

/**
 * Hard-delete local registry + blob. Blocked under V2 cloud mode until
 * Phase archive/delete (canonical soft-delete).
 */
export function deleteClub(clubId) {
  const gate = assertLegacyClubEntityWriteAllowed({
    operation: "deleteClub",
    deferred: true,
  });
  if (!gate.ok) return gate;
  return deleteClubDomain(clubId);
}

/**
 * V2-OFF only — push local registry rows via club_upsert_registry.
 * Hard-blocked under V2 by clubRegistryCloudService + this gate.
 */
export async function syncClubsToLegacyRegistry(args = {}) {
  const gate = assertLegacyClubEntityWriteAllowed({
    operation: "syncClubsToLegacyRegistry",
  });
  if (!gate.ok) return gate;
  return syncClubsForVenueToCloud(args);
}
