import { useMemo } from "react";
import { createPlatformRuntime } from "./index.js";
import { PlatformRuntimeContext } from "./PlatformRuntimeContext.js";

/**
 * Platform Core runtime provider — no Business Module imports.
 * Optional onRuntimeReady lets the app composition root wire external
 * bridges without Platform Core depending on feature modules.
 */
export function PlatformRuntimeProvider({
  children,
  namespace = "pickleball-platform",
  onRuntimeReady,
}) {
  const runtime = useMemo(() => {
    const nextRuntime = createPlatformRuntime({ namespace });
    if (typeof onRuntimeReady === "function") {
      onRuntimeReady(nextRuntime);
    }
    return nextRuntime;
  }, [namespace, onRuntimeReady]);

  return (
    <PlatformRuntimeContext.Provider value={runtime}>{children}</PlatformRuntimeContext.Provider>
  );
}
