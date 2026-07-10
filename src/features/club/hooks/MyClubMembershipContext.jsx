import { createContext, useContext } from "react";

const MyClubMembershipContext = createContext(null);

export function MyClubMembershipProvider({ value, children }) {
  return <MyClubMembershipContext.Provider value={value}>{children}</MyClubMembershipContext.Provider>;
}

/** Membership resolved by route guard — avoids duplicate RPC on child mount. */
export function useMyClubMembershipFromContext() {
  return useContext(MyClubMembershipContext);
}
