import { useContext } from "react";

import { PlatformRuntimeContext } from "./PlatformRuntimeContext.js";

export function usePlatformRuntime() {
  const context = useContext(PlatformRuntimeContext);
  if (!context) {
    throw new Error("usePlatformRuntime must be used inside PlatformRuntimeProvider");
  }
  return context;
}
