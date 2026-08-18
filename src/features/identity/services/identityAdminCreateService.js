import { randomBytes } from "node:crypto";

import { mapProfileRowToUser, mapUserToProfileRow } from "../../../auth/profileService.js";
import { createUserRecord, USER_STATUS } from "../../../models/user.js";
import { getResetPasswordRedirectUrl } from "../../../config/authConfig.js";
import { getSupabaseAdminClient } from "../../api/repositories/supabaseApiKeyRepository.js";
import { denormalizeRoleForDb, normalizeRole, ROLES, CANONICAL_ROLES } from "../constants/roles.js";
import {
  projectRawIdentitySubjectRecord,
} from "./subjectIdentityPersistence.js";
import { resolveSubjectIdentityRecord } from "./subjectIdentityLookupService.js";
import {
  normalizeManagedUserStatus,
  resolveManagedUserTenantTarget,
} from "./identityManagedUserTargetPolicy.js";

function createTemporaryPassword() {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

function resolveRedirectTo(redirectTo) {
  const configured = String(redirectTo || getResetPasswordRedirectUrl() || "").trim();
  return configured || undefined;
}

function evidenceMatchesIntent(evidence, intent) {
  if (!evidence) return false;
  if (String(evidence.subjectId) !== String(intent.subjectId)) return false;
  if (normalizeRole(evidence.role) !== normalizeRole(intent.role)) return false;
  if (String(evidence.status) !== String(intent.status)) return false;
  if (Boolean(evidence.active) !== (intent.status === USER_STATUS.ACTIVE)) return false;
  const expectedTenant = intent.tenantId || null;
  const actualTenant = evidence.tenantId || null;
  if (expectedTenant !== actualTenant) return false;
  const expectedVenue = intent.venueId || null;
  const actualVenue = evidence.venueId || null;
  if (expectedVenue !== actualVenue) return false;
  return true;
}

async function compensateCreatedAuthUser(admin, authUserId) {
  if (!authUserId || typeof admin?.auth?.admin?.deleteUser !== "function") {
    return { attempted: false, ok: false, code: "COMPENSATION_UNAVAILABLE" };
  }
  const { error } = await admin.auth.admin.deleteUser(authUserId);
  if (error) {
    return {
      attempted: true,
      ok: false,
      code: "AUTH_COMPENSATION_FAILED",
      error: error.message || "Không xóa được Auth user vừa tạo.",
    };
  }
  return { attempted: true, ok: true };
}

/**
 * Tạo auth user qua Supabase Admin API (email_confirm=true), upsert profile theo auth.users.id.
 * Không có password → mật khẩu tạm + must_change_password (không gửi email reset).
 * tenantId and venueId persist independently. Venue is never copied onto Tenant.
 */
export async function adminCreateManagedUser(
  {
    email,
    password = "",
    displayName = "",
    role = ROLES.PLAYER,
    status,
    tenantId = null,
    venueId = null,
    clubId = null,
    phone = "",
    redirectTo = "",
    sendPasswordSetupEmail = false,
    actor = null,
  } = {},
  deps = {}
) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, error: "Email bắt buộc.", code: "EMAIL_REQUIRED" };
  }

  const targetRole = normalizeRole(role || ROLES.PLAYER);
  if (!CANONICAL_ROLES.includes(targetRole)) {
    return { ok: false, error: "Role không hợp lệ.", code: "INVALID_ROLE" };
  }

  const statusResult = normalizeManagedUserStatus(status);
  if (!statusResult.ok) {
    return statusResult;
  }
  const targetStatus = statusResult.status;
  const explicitTenantId = String(tenantId || "").trim() || null;
  const explicitVenueId = String(venueId || "").trim() || null;

  const getAdmin = typeof deps.getAdminClient === "function" ? deps.getAdminClient : getSupabaseAdminClient;
  const admin = getAdmin();

  const target = await resolveManagedUserTenantTarget({
    client: admin,
    actor,
    tenantId: explicitTenantId,
    venueId: explicitVenueId,
  });
  if (!target.ok) {
    return target;
  }

  const resolvedDisplayName =
    String(displayName || "").trim() || normalizedEmail.split("@")[0];
  const providedPassword = String(password || "").trim();
  const useTemporaryPassword = !providedPassword;
  const authPassword = providedPassword || createTemporaryPassword();
  const mustChangePassword = useTemporaryPassword;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: authPassword,
    email_confirm: true,
    user_metadata: {
      display_name: resolvedDisplayName,
      must_change_password: mustChangePassword,
    },
  });

  if (authError) {
    const message = String(authError.message || "");
    if (message.toLowerCase().includes("already")) {
      return { ok: false, error: "Email đã tồn tại.", code: "DUPLICATE_EMAIL" };
    }
    return { ok: false, error: message || "Tạo user thất bại.", code: "ADMIN_CREATE_FAILED" };
  }

  const authUserId = authData?.user?.id;
  if (!authUserId) {
    return { ok: false, error: "Tạo user chưa hoàn tất.", code: "SIGNUP_INCOMPLETE" };
  }

  const profileRow = mapUserToProfileRow(
    createUserRecord({
      id: authUserId,
      email: normalizedEmail,
      displayName: resolvedDisplayName,
      role: targetRole,
      tenantId: target.tenantId,
      venueId: target.venueId,
      clubId,
      phone,
      status: targetStatus,
      mustChangePassword,
    })
  );

  if (phone) {
    profileRow.phone = phone;
  }

  profileRow.role = denormalizeRoleForDb(targetRole);
  profileRow.status = targetStatus;
  profileRow.tenant_id = target.tenantId;
  profileRow.venue_id = target.venueId;
  profileRow.must_change_password = mustChangePassword;

  const { data: profileData, error: profileError } = await admin
    .from("profiles")
    .upsert(profileRow, { onConflict: "id" })
    .select("*")
    .single();

  if (profileError) {
    const compensation = await compensateCreatedAuthUser(admin, authUserId);
    return {
      ok: false,
      error: profileError.message || "Không thể tạo profile.",
      code: compensation.ok ? "PROFILE_UPSERT_FAILED" : "PROFILE_UPSERT_FAILED_AUTH_COMPENSATION_FAILED",
      userId: authUserId,
      compensation,
    };
  }

  const subjectRecord = projectRawIdentitySubjectRecord(profileData);
  const evidenceResult = await resolveSubjectIdentityRecord(
    {
      subjectId: authUserId,
      requestedTenantId: target.tenantId || undefined,
    },
    {
      loadIdentitySubjectById: async () => subjectRecord,
    }
  );

  const intent = {
    subjectId: authUserId,
    role: targetRole,
    status: targetStatus,
    tenantId: target.tenantId,
    venueId: target.venueId,
  };

  if (!evidenceResult.ok || !evidenceMatchesIntent(evidenceResult.evidence, intent)) {
    const compensation = await compensateCreatedAuthUser(admin, authUserId);
    return {
      ok: false,
      error: "Contract #01 post-create evidence không khớp intent.",
      code: compensation.ok
        ? "POST_CREATE_IDENTITY_EVIDENCE_MISMATCH"
        : "POST_CREATE_IDENTITY_EVIDENCE_MISMATCH_AUTH_COMPENSATION_FAILED",
      userId: authUserId,
      compensation,
      identityEvidence: evidenceResult.evidence || null,
    };
  }

  let passwordSetupSent = false;
  let passwordSetupMessage = null;

  if (useTemporaryPassword && sendPasswordSetupEmail) {
    const resetRedirect = resolveRedirectTo(redirectTo);
    const { error: resetError } = await admin.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: resetRedirect,
    });

    if (resetError) {
      passwordSetupMessage = resetError.message || "Không gửi được email đặt mật khẩu.";
    } else {
      passwordSetupSent = true;
      passwordSetupMessage = "Đã gửi email đặt mật khẩu cho người dùng.";
    }
  }

  return {
    ok: true,
    user: mapProfileRowToUser(profileData),
    identityEvidence: evidenceResult.evidence,
    temporaryPassword: useTemporaryPassword ? authPassword : null,
    mustChangePassword,
    passwordSetupSent,
    passwordSetupMessage,
    emailConfirmed: true,
    provider: "admin_api",
  };
}
