/**
 * Composition binding — Club auth session projection → Platform auth hooks.
 */
import { registerAuthSessionLoadProjector } from "../../../auth/authSessionHooks.js";
import { projectClubAuthSessionUser } from "../services/authSessionClubProjection.js";

export function registerClubAuthSessionProjection() {
  registerAuthSessionLoadProjector(projectClubAuthSessionUser);
}
