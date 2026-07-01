import { PERMISSIONS } from "../constants/permissions.js";
import { ROLES, denormalizeRoleForDb, normalizeRole, CANONICAL_ROLES } from "../constants/roles.js";
import { guardPermission } from "../../../auth/guardAction.js";
import { getCurrentUser, isDevAuthAllowed, listDevUsers } from "../../../auth/authService.js";
import {
  fetchProfileByUserId,
  mapProfileRowToUser,
  mapUserToProfileRow,
  upsertProfileRow,
} from "../../../auth/profileService.js";
import { getSupabaseAuthClient, hasSupabaseConfig, PROFILES_TABLE } from "../../../auth/supabaseClient.js";
import { createUserRecord, normalizeUser, USER_STATUS } from "../../../models/user.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";
import { requestPasswordReset } from "./passwordService.js";
import { rpcAdminUpdateUser, rpcListUsers } from "./identityRpcService.js";

const DEV_REGISTRY_KEY = "pickleball-dev-user-registry-v1";

function loadDevRegistry() {
  try {
    const raw = localStorage.getItem(DEV_REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((user) => normalizeUser(user)) : [];
  } catch {
    return [];
  }
}

function saveDevRegistry(users) {
  localStorage.setItem(DEV_REGISTRY_KEY, JSON.stringify(users));
}

function mergeDevUsers() {
  const registry = loadDevRegistry();
  const builtIn = listDevUsers();
  const map = new Map();

  builtIn.forEach((user) => map.set(user.email, user));
  registry.forEach((user) => map.set(user.email, user));

  return Array.from(map.values());
}

function guardUserManage(scope = {}) {
  return guardPermission(PERMISSIONS.USER_MANAGE, scope);
}

function guardRoleManage() {
  return guardPermission(PERMISSIONS.ROLE_MANAGE, {});
}

export function listManageableRoles() {
  return [...CANONICAL_ROLES];
}

export async function listUsers({ search = "", role = "", status = "" } = {}) {
  const check = guardUserManage({});
  if (!check.ok) {
    return check;
  }

  const currentUser = getCurrentUser();
  let users;

  if (hasSupabaseConfig()) {
    const rpcResult = await rpcListUsers({ search, role, status });
    if (rpcResult.ok) {
      return rpcResult;
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }

    const client = getSupabaseAuthClient();
    if (!client) {
      return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
    }

    let query = client.from(PROFILES_TABLE).select("*").order("created_at", { ascending: false });

    if (currentUser?.venueId && normalizeRole(currentUser.role) !== ROLES.SUPER_ADMIN) {
      query = query.eq("venue_id", currentUser.venueId);
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, error: error.message, code: "USERS_FETCH_FAILED" };
    }

    users = (data || []).map((row) => mapProfileRowToUser(row));
  } else if (isDevAuthAllowed()) {
    users = mergeDevUsers();
  } else {
    return { ok: false, error: "Không có nguồn user.", code: "NO_SOURCE" };
  }

  const term = String(search || "").trim().toLowerCase();
  const filtered = users.filter((user) => {
    if (role && normalizeRole(user.role) !== normalizeRole(role)) {
      return false;
    }
    if (status && user.status !== status) {
      return false;
    }
    if (!term) {
      return true;
    }
    return (
      user.email.includes(term) ||
      user.displayName.toLowerCase().includes(term) ||
      (user.phone || "").includes(term)
    );
  });

  return { ok: true, users: filtered };
}

export async function createManagedUser({
  email,
  password,
  displayName,
  role,
  venueId = null,
  clubId = null,
  phone = "",
} = {}) {
  const scope = venueId ? { venueId } : {};
  const check = guardUserManage(scope);
  if (!check.ok) {
    return check;
  }

  const roleCheck = guardRoleManage();
  const targetRole = normalizeRole(role || ROLES.PLAYER);
  if (!CANONICAL_ROLES.includes(targetRole)) {
    return { ok: false, error: "Role không hợp lệ.", code: "INVALID_ROLE" };
  }
  if (targetRole !== ROLES.PLAYER && !roleCheck.ok) {
    return roleCheck;
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, error: "Email bắt buộc.", code: "EMAIL_REQUIRED" };
  }

  const currentUser = getCurrentUser();
  const resolvedVenueId = venueId || currentUser?.venueId || null;

  if (hasSupabaseConfig()) {
    const client = getSupabaseAuthClient();
    if (!client) {
      return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
    }

    const { data, error } = await client.auth.signUp({
      email: normalizedEmail,
      password: String(password || "ChangeMe123!"),
      options: {
        data: { display_name: displayName || normalizedEmail.split("@")[0] },
      },
    });

    if (error) {
      return { ok: false, error: error.message, code: "SIGNUP_FAILED" };
    }

    if (!data.user?.id) {
      return { ok: false, error: "Tạo user chưa hoàn tất.", code: "SIGNUP_INCOMPLETE" };
    }

    const profile = mapUserToProfileRow(
      createUserRecord({
        id: data.user.id,
        email: normalizedEmail,
        displayName,
        role: targetRole,
        venueId: resolvedVenueId,
        clubId,
        phone,
        status: USER_STATUS.INVITED,
      })
    );

    const upsert = await upsertProfileRow(profile);
    if (!upsert.ok) {
      return upsert;
    }

    await writeAuditLog({
      action: AUDIT_ACTIONS.CREATE,
      resourceType: "user",
      resourceId: data.user.id,
      metadata: { email: normalizedEmail, role: targetRole },
    });

    return { ok: true, user: upsert.user };
  }

  if (!isDevAuthAllowed()) {
    return { ok: false, error: "Dev registry không khả dụng.", code: "DEV_DISABLED" };
  }

  const user = createUserRecord({
    email: normalizedEmail,
    displayName,
    role: targetRole,
    venueId: resolvedVenueId,
    clubId,
    phone,
    status: USER_STATUS.ACTIVE,
  });

  const registry = loadDevRegistry();
  if (registry.some((item) => item.email === user.email) || mergeDevUsers().some((item) => item.email === user.email)) {
    return { ok: false, error: "Email đã tồn tại.", code: "DUPLICATE_EMAIL" };
  }

  registry.push(user);
  saveDevRegistry(registry);

  await writeAuditLog({
    action: AUDIT_ACTIONS.CREATE,
    resourceType: "user",
    resourceId: user.id,
    metadata: { email: user.email, role: user.role },
  });

  return { ok: true, user };
}

export async function updateManagedUser(userId, patch = {}) {
  const check = guardUserManage({});
  if (!check.ok) {
    return check;
  }

  if (!userId) {
    return { ok: false, error: "Thiếu user id.", code: "USER_ID_REQUIRED" };
  }

  const currentUser = getCurrentUser();
  if (currentUser?.id === userId && patch.role && normalizeRole(patch.role) !== normalizeRole(currentUser.role)) {
    return { ok: false, error: "Không thể tự đổi role.", code: "SELF_ROLE_FORBIDDEN" };
  }

  if (patch.role) {
    const roleCheck = guardRoleManage();
    if (!roleCheck.ok) {
      return roleCheck;
    }
  }

  if (hasSupabaseConfig()) {
    const rpcPatch = {
      displayName: patch.displayName,
      phone: patch.phone,
      avatarUrl: patch.avatarUrl,
      role: patch.role,
      status: patch.status,
      clubId: patch.clubId,
    };

    const rpcResult = await rpcAdminUpdateUser(userId, rpcPatch);
    if (rpcResult.ok) {
      if (patch.role) {
        await writeAuditLog({
          action: AUDIT_ACTIONS.ASSIGN_ROLE,
          resourceType: "user",
          resourceId: userId,
          metadata: { role: rpcResult.user.role },
        });
      } else {
        await writeAuditLog({
          action: AUDIT_ACTIONS.UPDATE,
          resourceType: "user",
          resourceId: userId,
        });
      }
      return { ok: true, user: rpcResult.user };
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
      return rpcResult;
    }

    const existing = await fetchProfileByUserId(userId);
    if (!existing.ok) {
      return existing;
    }

    const next = normalizeUser({
      ...existing.user,
      displayName: patch.displayName ?? existing.user.displayName,
      phone: patch.phone ?? existing.user.phone ?? "",
      venueId: patch.venueId ?? existing.user.venueId,
      clubId: patch.clubId ?? existing.user.clubId,
      role: patch.role ? normalizeRole(patch.role) : existing.user.role,
      status: patch.status ?? existing.user.status,
    });

    const row = {
      ...mapUserToProfileRow(next),
      display_name: next.displayName,
      phone: next.phone || "",
      avatar_url: patch.avatarUrl ?? existing.profile?.avatar_url ?? "",
    };

    const result = await upsertProfileRow(row);
    if (!result.ok) {
      return result;
    }

    if (patch.role && normalizeRole(patch.role) !== normalizeRole(existing.user.role)) {
      await writeAuditLog({
        action: AUDIT_ACTIONS.ASSIGN_ROLE,
        resourceType: "user",
        resourceId: userId,
        metadata: { from: existing.user.role, to: next.role },
      });
    } else {
      await writeAuditLog({
        action: AUDIT_ACTIONS.UPDATE,
        resourceType: "user",
        resourceId: userId,
      });
    }

    return { ok: true, user: result.user };
  }

  if (!isDevAuthAllowed()) {
    return { ok: false, error: "Dev registry không khả dụng.", code: "DEV_DISABLED" };
  }

  const registry = loadDevRegistry();
  const builtIn = mergeDevUsers();
  const target = builtIn.find((user) => user.id === userId);
  if (!target) {
    return { ok: false, error: "Không tìm thấy user.", code: "USER_NOT_FOUND" };
  }

  const updated = normalizeUser({
    ...target,
    displayName: patch.displayName ?? target.displayName,
    phone: patch.phone ?? target.phone ?? "",
    role: patch.role ? normalizeRole(patch.role) : target.role,
    status: patch.status ?? target.status,
  });

  const idx = registry.findIndex((user) => user.id === userId);
  if (idx >= 0) {
    registry[idx] = updated;
  } else {
    registry.push(updated);
  }
  saveDevRegistry(registry);

  await writeAuditLog({
    action: patch.role ? AUDIT_ACTIONS.ASSIGN_ROLE : AUDIT_ACTIONS.UPDATE,
    resourceType: "user",
    resourceId: userId,
    metadata: patch.role ? { role: updated.role } : {},
  });

  return { ok: true, user: updated };
}

export async function setManagedUserStatus(userId, status) {
  if (![USER_STATUS.ACTIVE, USER_STATUS.SUSPENDED, USER_STATUS.INVITED].includes(status)) {
    return { ok: false, error: "Status không hợp lệ.", code: "INVALID_STATUS" };
  }

  const result = await updateManagedUser(userId, { status });
  if (result.ok) {
    await writeAuditLog({
      action: AUDIT_ACTIONS.UPDATE,
      resourceType: "user",
      resourceId: userId,
      metadata: { status },
    });
  }
  return result;
}

export async function requestManagedPasswordReset(email) {
  const check = guardUserManage({});
  if (!check.ok) {
    return check;
  }

  return requestPasswordReset(email);
}

export { USER_STATUS, ROLES, denormalizeRoleForDb, normalizeRole };
