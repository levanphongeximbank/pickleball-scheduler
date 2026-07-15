/**
 * Phase 45A.3D — map Phase 42 Club command RPC tokens → registered API_ERROR_CODES.
 * No ad-hoc codes. Server tokens stay in `result.code` only after remapping here.
 */
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";

const SERVER_TO_API = Object.freeze({
  NOT_AUTHENTICATED: API_ERROR_CODES.UNAUTHORIZED,
  REQUEST_ID_REQUIRED: API_ERROR_CODES.VALIDATION_ERROR,
  NOT_FOUND: API_ERROR_CODES.NOT_FOUND,
  VERSION_CONFLICT: API_ERROR_CODES.CONFLICT,
  FORBIDDEN: API_ERROR_CODES.FORBIDDEN,
  NAME_REQUIRED: API_ERROR_CODES.VALIDATION_ERROR,
  INVALID_STATUS: API_ERROR_CODES.VALIDATION_ERROR,
  DUPLICATE_NAME: API_ERROR_CODES.CONFLICT,
  DUPLICATE_CODE: API_ERROR_CODES.CONFLICT,
  DUPLICATE_CLUB: API_ERROR_CODES.CONFLICT,
  UPDATE_FAILED: API_ERROR_CODES.INTERNAL_ERROR,
  CREATE_FAILED: API_ERROR_CODES.INTERNAL_ERROR,
  TENANT_NOT_FOUND: API_ERROR_CODES.NOT_FOUND,
  TENANT_FORBIDDEN: API_ERROR_CODES.TENANT_MISMATCH,
  PLAN_CLUB_LIMIT: API_ERROR_CODES.FORBIDDEN,
  // Transport / client
  NO_SUPABASE: API_ERROR_CODES.V2_DISABLED,
  RPC_NOT_DEPLOYED: API_ERROR_CODES.INTERNAL_ERROR,
  RPC_FAILED: API_ERROR_CODES.INTERNAL_ERROR,
  EMPTY_RESPONSE: API_ERROR_CODES.INTERNAL_ERROR,
  CLUB_REQUIRED: API_ERROR_CODES.CLUB_REQUIRED,
  CLOUD_CREATE_FAILED: API_ERROR_CODES.INTERNAL_ERROR,
  CLOUD_UPDATE_FAILED: API_ERROR_CODES.INTERNAL_ERROR,
});

/**
 * @param {{ ok?: boolean, code?: string, error?: string }} result
 * @param {{ fallbackCode?: string, fallbackError?: string }} [options]
 */
export function mapClubCommandError(result, options = {}) {
  const serverCode = String(result?.code || "").trim();
  const mapped =
    SERVER_TO_API[serverCode] ||
    options.fallbackCode ||
    API_ERROR_CODES.INTERNAL_ERROR;

  return {
    ok: false,
    code: mapped,
    error:
      result?.error ||
      options.fallbackError ||
      "Không thực hiện được lệnh CLB trên cloud.",
    serverCode: serverCode || null,
  };
}
