import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { can, canAccessClub, canAccessVenue, canAll, canAny } from "../auth/rbac.js";
import {
  enableRbac,
  getAuthState,
  getCurrentUser,
  isSupabaseAuthAvailable,
  restoreSupabaseSession,
  signInAs,
  signInDev,
  signInWithPassword,
  signUpWithPassword,
  signOut,
  subscribeToSupabaseAuth,
} from "../auth/authService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => getAuthState());
  const [authLoading, setAuthLoading] = useState(() => isSupabaseAuthAvailable());

  const refresh = useCallback(() => {
    setState(getAuthState());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        if (isSupabaseAuthAvailable()) {
          await restoreSupabaseSession();
        }
      } catch {
        // Supabase env sai hoặc mạng lỗi — không văng app, dev fallback vẫn dùng được.
      }

      if (!cancelled) {
        refresh();
        setAuthLoading(false);
      }
    };

    bootstrap();

    const unsubscribe = subscribeToSupabaseAuth(() => {
      if (!cancelled) {
        refresh();
      }
    });

    return () => {
      cancelled = true;
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

  const value = useMemo(
    () => ({
      ...state,
      authLoading,
      getCurrentUser,
      refresh,
      signInDev: handleSignInDev,
      signInAs: handleSignInAs,
      signInWithPassword: handleSignInWithPassword,
      signUpWithPassword: handleSignUpWithPassword,
      signOut: handleSignOut,
      enableRbac: handleEnableRbac,
      can: (permission, scope = {}) => can(state.user, permission, scope, rbacOptions),
      canAll: (permissions, scope = {}) =>
        canAll(state.user, permissions, scope, rbacOptions),
      canAny: (permissions, scope = {}) =>
        canAny(state.user, permissions, scope, rbacOptions),
      canAccessVenue: (venueId) => canAccessVenue(state.user, venueId, rbacOptions),
      canAccessClub: (clubId, clubMeta = {}) =>
        canAccessClub(state.user, clubId, clubMeta, rbacOptions),
    }),
    [state, authLoading, refresh, handleSignInDev, handleSignInAs, handleSignInWithPassword, handleSignUpWithPassword, handleSignOut, handleEnableRbac, rbacOptions]
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
