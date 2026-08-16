/**
 * Cross-session Internal canonical snapshot refresh.
 * Shared generic with Team: short poll + tab-visible reload. No full-page wipe.
 */
import { useEffect } from "react";
import { INTERNAL_SNAPSHOT_POLL_MS } from "./internalKnockoutLiveRefresh.js";

export function useInternalCanonicalSnapshotRefresh({
  enabled = false,
  reload,
  mutationInFlightRef,
  pollMs = INTERNAL_SNAPSHOT_POLL_MS,
} = {}) {
  useEffect(() => {
    if (!enabled || typeof reload !== "function") return undefined;

    const tick = () => {
      if (mutationInFlightRef?.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void reload({ silent: true });
    };

    const timer = setInterval(tick, pollMs);
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        tick();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [enabled, mutationInFlightRef, pollMs, reload]);
}
