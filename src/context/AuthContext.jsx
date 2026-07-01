import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { can, canAccessClub, canAccessVenue, canAll, canAny } from "../auth/rbac.js";
import { clearAuthSession, loadAuthSession } from "../auth/authStorage.js";
import { formatAuthError } from "../auth/authErrors.js";
import {
  enableRbac,
  getAuthState,
  getCurrentUser,
  restoreSupabaseSession,
  signInAs,
  signInDev,
  signInWithPassword,
  signUpWithPassword,
  signOut,
  subscribeToSupabaseAuth,
} from "../auth/authService.js";
import { getSupabaseConfigError, hasSupabaseConfig } from "../auth/supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => getAuthState());
  const [authLoading, setAuthLoading] = useState(() => hasSupabaseConfig());
  const [authError, setAuthError] = useState(() => getSupabaseConfigError());

  const refresh = useCallback(() => {
    setState(getAuthState());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;
    let unsubscribe = () => {};

    const bootstrap = async () => {
      const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
      const shouldLogAuthDebug = env.DEV || env.VITE_ENABLE_AUTH_DEBUG === "true";
      const configError = getSupabaseConfigError();

      if (configError) {
        clearAuthSession();
        if (!cancelled) {
          setAuthError(configError);
          setState(getAuthState());
          setAuthLoading(false);
        }
        return;
      }

      try {
        setAuthError(null);
        setAuthLoading(true);

        const existing = loadAuthSession();
        if (existing?.provider === "dev") {
          clearAuthSession();
        }

        const result = await Promise.race([
          restoreSupabaseSession(),
          new Promise((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new Error("AUTH_INIT_TIMEOUT")), 5000);
          }),
        ]);

        if (!cancelled) {
          if (result?.ok) {
            setAuthError(null);
          } else if (result?.code === "PROFILE_INVALID" || result?.code === "PROFILE_NOT_FOUND" || result?.code === "PROFILE_REQUIRED" || result?.code === "PROFILE_SUSPENDED") {
            clearAuthSession();
            setAuthError(formatAuthError(result.error, result.code));
          } else if (result?.code === "NO_SUPABASE") {
            clearAuthSession();
            setAuthError(getSupabaseConfigError());
          } else {
            clearAuthSession();
          }
          refresh();
        }
      } catch (error) {
        if (shouldLogAuthDebug) {
          console.error("[auth] initialization failed", error);
        }
        if (!cancelled) {
          clearAuthSession();
          setAuthError(error?.message || "Không thể khởi tạo phiên đăng nhập.");
          refresh();
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      }
    };

    const start = async () => {
      await bootstrap();
      if (!cancelled) {
        unsubscribe = subscribeToSupabaseAuth(() => {
          if (!cancelled) {
            refresh();
          }
        });
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      unsubscribe();
    };
  }, [refresh]);

  const handleSignInDev = useCallback(
    (email) => {
      const result = signInDev(email);
      if (result.ok) {
        refresh();
      }
      return result;
    },
    [refresh]
  );

  const handleSignInAs = useCallback(
    (user) => {
      const result = signInAs(user);
      if (result.ok) {
        refresh();
      }
      return result;
    },
    [refresh]
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    refresh();
    return { ok: true };
  }, [refresh]);

  const handleSignInWithPassword = useCallback(
    async (email, password) => {
      const result = await signInWithPassword(email, password);
      if (result.ok) {
        refresh();
      }
      return result;
    },
    [refresh]
  );

  const handleSignUpWithPassword = useCallback(
    async (email, password, profileMeta) => {
      const result = await signUpWithPassword(email, password, profileMeta);
      if (result.ok && !result.needsEmailConfirmation) {
        refresh();
      }
      return result;
    },
    [refresh]
  );

  const handleEnableRbac = useCallback(
    (enabled = true) => {
      const result = enableRbac(enabled);
      refresh();
      return result;
    },
    [refresh]
  );

  const rbacOptions = useMemo(
    () => ({ rbacEnabled: state.rbacEnabled }),
    [state.rbacEnabled]
  );

  const user = state.user;
  const checkCan = useCallback(
    (permission, scope = {}) => can(user, permission, scope, rbacOptions),
    [user, rbacOptions]
  );
  const checkCanAll = useCallback(
    (permissions, scope = {}) => canAll(user, permissions, scope, rbacOptions),
    [user, rbacOptions]
  );
  const checkCanAny = useCallback(
    (permissions, scope = {}) => canAny(user, permissions, scope, rbacOptions),
    [user, rbacOptions]
  );
  const checkCanAccessVenue = useCallback(
    (venueId) => canAccessVenue(user, venueId, rbacOptions),
    [user, rbacOptions]
  );
  const checkCanAccessClub = useCallback(
    (clubId, clubMeta = {}) => canAccessClub(user, clubId, clubMeta, rbacOptions),
    [user, rbacOptions]
  );

  const value = useMemo(
    () => ({
      ...state,
      authLoading,
      authError,
      getCurrentUser,
      refresh,
      signInDev: handleSignInDev,
      signInAs: handleSignInAs,
      signInWithPassword: handleSignInWithPassword,
      signUpWithPassword: handleSignUpWithPassword,
      signOut: handleSignOut,
      enableRbac: handleEnableRbac,
      can: checkCan,
      canAll: checkCanAll,
      canAny: checkCanAny,
      canAccessVenue: checkCanAccessVenue,
      canAccessClub: checkCanAccessClub,
    }),
    [
      state,
      authLoading,
      authError,
      refresh,
      handleSignInDev,
      handleSignInAs,
      handleSignInWithPassword,
      handleSignUpWithPassword,
      handleSignOut,
      handleEnableRbac,
      checkCan,
      checkCanAll,
      checkCanAny,
      checkCanAccessVenue,
      checkCanAccessClub,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth phải dùng trong AuthProvider");
  }
  return context;
}

/** Hook tiện cho kiểm tra một permission. */
export function usePermission(permission, scope = {}) {
  const { can: checkCan, rbacEnabled, user } = useAuth();
  const allowed = checkCan(permission, scope);

  return {
    allowed,
    rbacEnabled,
    user,
  };
}
