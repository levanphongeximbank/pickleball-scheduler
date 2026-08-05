import { useContext } from "react";

import { CanonicalShellContext } from "../context/canonicalShellContext.js";

export function useCanonicalShell() {
  const ctx = useContext(CanonicalShellContext);
  if (!ctx) {
    throw new Error("useCanonicalShell must be used within CanonicalShellProvider");
  }
  return ctx;
}
