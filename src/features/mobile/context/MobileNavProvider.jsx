import { MobileNavContext } from "./mobileNavContext.js";

export function MobileNavProvider({ children, openDrawer }) {
  return (
    <MobileNavContext.Provider value={{ openDrawer }}>
      {children}
    </MobileNavContext.Provider>
  );
}
