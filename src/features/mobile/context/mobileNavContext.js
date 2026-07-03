import { createContext, useContext } from "react";

export const MobileNavContext = createContext({
  openDrawer: () => {},
});

export function useMobileNav() {
  return useContext(MobileNavContext);
}
