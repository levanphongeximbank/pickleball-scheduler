import { createContext, useContext, useMemo, useState } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useMyClubMembership } from "./useMyClubMembership.js";

const MyClubMembershipContext = createContext(null);

/**
 * Phase 42J.2 — single app-wide membership SSOT (one RPC stream per session).
 */
export function MyClubMembershipRootProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [revision, setRevision] = useState(0);
  const membership = useMyClubMembership(revision);

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
