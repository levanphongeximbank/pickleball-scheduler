import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { subscribeToSupabaseAuth } from "../../../auth/authService.js";
import { clearMembershipCacheForUser, invalidateMyActiveClubMembershipCache } from "../services/clubActiveMembershipService.js";
import { useMyClubMembership } from "./useMyClubMembership.js";

const MyClubMembershipContext = createContext(null);

/**
 * Phase 42J.2.1 — single app-wide membership SSOT.
 * Provider shell always mounted (no remount on route change).
 */
export function MyClubMembershipRootProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const userId = isAuthenticated && user?.id ? user.id : null;
  const [revision, setRevision] = useState(0);
  const prevUserIdRef = useRef(null);
  const membership = useMyClubMembership(revision, userId);

  useEffect(() => {
    if (!userId) {
      if (prevUserIdRef.current) {
        clearMembershipCacheForUser(prevUserIdRef.current);
        prevUserIdRef.current = null;
      }
      return;
    }
    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      clearMembershipCacheForUser(prevUserIdRef.current);
      setRevision((current) => current + 1);
    }
    prevUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
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
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        return;
      }
      if (nextUser?.id && prevUserIdRef.current && nextUser.id !== prevUserIdRef.current) {
        clearMembershipCacheForUser(prevUserIdRef.current);
        prevUserIdRef.current = nextUser.id;
        setRevision((current) => current + 1);
      }
    });
  }, [userId]);

  const value = useMemo(() => {
    if (!userId) {
      return null;
    }
    return {
      ...membership,
      revision,
      bumpRevision: () => {
        invalidateMyActiveClubMembershipCache(userId);
        setRevision((current) => current + 1);
      },
    };
  }, [membership, revision, userId]);

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
