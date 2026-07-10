import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { subscribeToSupabaseAuth } from "../../../auth/authService.js";
import { clearMembershipCacheForUser } from "../services/clubActiveMembershipService.js";
import { useMyClubMembership } from "./useMyClubMembership.js";

const MyClubMembershipContext = createContext(null);

/**
 * Phase 42J.2.1 — single app-wide membership SSOT (one RPC stream per session).
 * Mounted once in router.jsx — does not remount on route changes.
 */
export function MyClubMembershipRootProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [revision, setRevision] = useState(0);
  const prevUserIdRef = useRef(null);
  const membership = useMyClubMembership(revision);

  useEffect(() => {
    const uid = user?.id || null;
    if (!uid) {
      if (prevUserIdRef.current) {
        clearMembershipCacheForUser(prevUserIdRef.current);
        prevUserIdRef.current = null;
      }
      return;
    }
    if (prevUserIdRef.current && prevUserIdRef.current !== uid) {
      clearMembershipCacheForUser(prevUserIdRef.current);
      setRevision((current) => current + 1);
    }
    prevUserIdRef.current = uid;
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }
    return subscribeToSupabaseAuth(({ event, user: nextUser }) => {
      if (event === "SIGNED_OUT") {
        if (prevUserIdRef.current) {
          clearMembershipCacheForUser(prevUserIdRef.current);
          prevUserIdRef.current = null;
        }
        return;
      }
      if (event === "TOKEN_REFRESHED") {
        return;
      }
      if (nextUser?.id && prevUserIdRef.current && nextUser.id !== prevUserIdRef.current) {
        clearMembershipCacheForUser(prevUserIdRef.current);
        prevUserIdRef.current = nextUser.id;
        setRevision((current) => current + 1);
      }
    });
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({
      ...membership,
      revision,
      bumpRevision: () => setRevision((current) => current + 1),
    }),
    [membership, revision]
  );

  if (!isAuthenticated || !user?.id) {
    return children;
  }

  return (
    <MyClubMembershipContext.Provider value={value}>{children}</MyClubMembershipContext.Provider>
  );
}

/** @returns {import("./useMyClubMembership.js").MyClubMembershipState & { revision: number, bumpRevision: () => void } | null} */
export function useMyClubMembershipFromContext() {
  return useContext(MyClubMembershipContext);
}

/** Required on club routes — throws if root provider missing. */
export function useRequiredMyClubMembership() {
  const value = useContext(MyClubMembershipContext);
  if (!value) {
    throw new Error("MyClubMembershipRootProvider is required for club routes.");
  }
  return value;
}
