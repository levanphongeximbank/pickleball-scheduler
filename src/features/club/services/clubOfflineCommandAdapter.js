/**
 * Offline / V2-OFF Club command adapter.
 * Phase 45A.3D — the only UI-facing import surface for domain blob Club writes.
 * Cloud mode must use clubTenantService instead.
 */
export {
  createClub,
  renameClub,
  updateClubMeta,
} from "../../../domain/clubService.js";
