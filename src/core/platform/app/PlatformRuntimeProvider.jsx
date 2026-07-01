import { useMemo } from "react";
import { createPlatformRuntime } from "./index.js";
import { PlatformRuntimeContext } from "./PlatformRuntimeContext.js";

export function PlatformRuntimeProvider({ children, namespace = "pickleball-platform" }) {
  const runtime = useMemo(() => createPlatformRuntime({ namespace }), [namespace]);

  return (
    <PlatformRuntimeContext.Provider value={runtime}>{children}</PlatformRuntimeContext.Provider>
  );
}
