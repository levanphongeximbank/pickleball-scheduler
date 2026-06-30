import { ROLES } from "./roles.js";
import { createUserRecord, normalizeUser } from "../models/user.js";
import {
  clearAuthSession,
  loadAuthSession,
  loadRbacConfig,
  saveAuthSession,
  saveRbacConfig,
} from "./authStorage.js";
import { hasSupabaseConfig, getSupabaseAuthClient } from "./supabaseClient.js";
import {
  fetchProfileByUserId,
  resolveAuthUserFromProfile,
} from "./profileService.js";
import { formatAuthError } from "./authErrors.js";
import { isSecureRuntime } from "./runtime.js";

/** Dev registry — chỉ dùng khi chưa cấu hình Supabase (dev local). */
const DEV_USERS = [
  createUserRecord({
    id: "dev-super-admin",
    email: "admin@pickleball.local",
    displayName: "Super Admin",
    role: ROLES.SUPER_ADMIN,
    venueId: null,
    clubId: null,
  }),
  createUserRecord({
    id: "dev-venue-owner",
    email: "owner@venue.local",
    displayName: "Chủ sân Demo",
    role: ROLES.VENUE_OWNER,
    venueId: "venue-demo",
    clubId: null,
  }),
  createUserRecord({
    id: "dev-venue-manager",
    email: "manager@venue.local",
    displayName: "Quản lý sân Demo",
    role: ROLES.VENUE_MANAGER,
    venueId: "venue-demo",
    clubId: null,
  }),
  createUserRecord({
    id: "dev-cashier",
    email: "cashier@venue.local",
    displayName: "Thu ngân Demo",
    role: ROLES.CASHIER,
    venueId: "venue-demo",
    clubId: null,
  }),
  createUserRecord({
    id: "dev-accountant",
    email: "accountant@venue.local",
    displayName: "Kế toán Demo",
    role: ROLES.ACCOUNTANT,
    venueId: "venue-demo",
    clubId: null,
  }),
  createUserRecord({
    id: "dev-club-owner",
    email: "club@club.local",
    displayName: "Chủ CLB Demo",
    role: ROLES.CLUB_OWNER,
    venueId: "venue-demo",
    clubId: "default-club",
  }),
  createUserRecord({
    id: "dev-player",
    email: "player@club.local",
    displayName: "VĐV Demo",
    role: ROLES.PLAYER,
    venueId: "venue-demo",
    clubId: "default-club",
    playerId: "player-demo",
  }),
];

export function isSupabaseAuthAvailable() {
  return hasSupabaseConfig();
}

/** Auth production = có Supabase env → bắt buộc đăng nhập (tách khỏi RBAC). */
export function isAuthProductionEnabled() {
  return hasSupabaseConfig();
}

export function isDevAuthAllowed() {
  return !isSecureRuntime();
}

export function isRbacEnabled() {
  return loadRbacConfig().enabled;
}

export function enableRbac(enabled = true) {
  if (isSecureRuntime()) {
    const locked = isRbacEnabled();
    return {
      ok: false,
      enabled: locked,
      error: "RBAC bị khóa trên Preview/Production — chỉ đổi qua VITE_RBAC_ENABLED.",
      code: "RBAC_LOCKED",
    };
  }

  saveRbacConfig({ enabled });
  return { ok: true, enabled };
}

export function getCurrentUser() {
  const session = loadAuthSession();
  return session?.user || null;
}

export function getAuthState() {
  const rbacEnabled = isRbacEnabled();
  const session = loadAuthSession();
  const authProductionEnabled = isAuthProductionEnabled();

  return {
    rbacEnabled,
    authProductionEnabled,
    user: session?.user || null,
    isAuthenticated: Boolean(session?.user),
    loggedInAt: session?.loggedInAt || null,
    authProvider: session?.provider || null,
    supabaseAvailable: authProductionEnabled,
  };
}

async function syncSupabaseUser(authUser) {
  const profileResult = await fetchProfileByUserId(authUser.id);
  const resolved = resolveAuthUserFromProfile(authUser, profileResult, {
    rbacEnabled: isRbacEnabled(),
  });

  if (!resolved.ok) {
    clearAuthSession();
    const client = getSupabaseAuthClient();
    if (client) {
      await client.auth.signOut();
    }
    return resolved;
  }

  saveAuthSession(resolved.user, { provider: "supabase" });
  return {
    ok: true,
    user: resolved.user,
    provider: "supabase",
    warning: resolved.warning || null,
  };
}

export async function restoreSupabaseSession() {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE" };
  }

  const { data, error } = await client.auth.getSession();
  if (error) {
    return { ok: false, error: error.message, code: "SESSION_ERROR" };
  }

  if (!data.session?.user) {
    return { ok: false, code: "NO_SESSION" };
  }

  return syncSupabaseUser(data.session.user);
}

export async function signInWithPassword(email, password) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: String(email || "").trim().toLowerCase(),
    password: String(password || ""),
  });

  if (error) {
    return {
      ok: false,
      error: formatAuthError(error.message, "AUTH_FAILED"),
      code: "AUTH_FAILED",
    };
  }

  return syncSupabaseUser(data.user);
}

export async function signUpWithPassword(email, password, profileMeta = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
  }

  const { data, error } = await client.auth.signUp({
    email: String(email || "").trim().toLowerCase(),
    password: String(password || ""),
    options: {
      data: {
        display_name:
          profileMeta.display_name ||
          profileMeta.displayName ||
          String(email || "").split("@")[0],
      },
    },
  });

  if (error) {
    return {
      ok: false,
      error: formatAuthError(error.message, "SIGNUP_FAILED"),
      code: "SIGNUP_FAILED",
    };
  }

  if (!data.user) {
    return { ok: false, error: "Đăng ký chưa hoàn tất.", code: "SIGNUP_INCOMPLETE" };
  }

  if (!data.session) {
    return {
      ok: true,
      needsEmailConfirmation: true,
      message: "Kiểm tra email để xác nhận tài khoản.",
    };
  }

  return syncSupabaseUser(data.user);
}

/**
 * Đăng nhập dev — chỉ khi chưa có Supabase env (không dùng production).
 */
export function signInDev(email) {
  if (!isDevAuthAllowed()) {
    return {
      ok: false,
      error: "Dev login không khả dụng khi Supabase Auth đã bật.",
      code: "DEV_AUTH_DISABLED",
    };
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const found = DEV_USERS.find((user) => user.email === normalizedEmail);

  if (!found) {
    return { ok: false, error: "Email không tồn tại trong dev registry", code: "USER_NOT_FOUND" };
  }

  saveAuthSession(found, { provider: "dev" });
  return { ok: true, user: normalizeUser(found), provider: "dev" };
}

export function signInAs(userLike, meta = {}) {
  if (!isDevAuthAllowed()) {
    return {
      ok: false,
      error: "Dev sign-in không khả dụng trên Preview/Production.",
      code: "DEV_AUTH_DISABLED",
    };
  }

  const user = normalizeUser(userLike);
  if (!user.id || !user.role) {
    return { ok: false, error: "User không hợp lệ", code: "INVALID_USER" };
  }

  saveAuthSession(user, { provider: meta.provider || "dev" });
  return { ok: true, user, provider: meta.provider || "dev" };
}

export async function signOut() {
  clearAuthSession();

  const client = getSupabaseAuthClient();
  if (client) {
    await client.auth.signOut();
  }

  return { ok: true };
}

export function subscribeToSupabaseAuth(onChange) {
  const client = getSupabaseAuthClient();
  if (!client || typeof onChange !== "function") {
    return () => {};
  }

  const { data } = client.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_OUT") {
      clearAuthSession();
      onChange({ event, user: null });
      return;
    }

    if (session?.user) {
      const synced = await syncSupabaseUser(session.user);
      onChange({
        event,
        user: synced.ok ? synced.user : null,
        error: synced.ok ? null : synced.error,
      });
    }
  });

  return () => data.subscription.unsubscribe();
}

export function listDevUsers() {
  if (!isDevAuthAllowed()) {
    return [];
  }

  return DEV_USERS.map((user) => normalizeUser(user));
}
