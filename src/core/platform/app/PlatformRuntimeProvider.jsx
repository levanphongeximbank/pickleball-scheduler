import { useMemo } from "react";
import { createPlatformRuntime } from "./index.js";
import { PlatformRuntimeContext } from "./PlatformRuntimeContext.js";
import { registerClubNotificationWriter } from "../../../features/club/services/clubScheduleNotificationBridge.js";

export function PlatformRuntimeProvider({ children, namespace = "pickleball-platform" }) {
  const runtime = useMemo(() => {
    const nextRuntime = createPlatformRuntime({ namespace });
    registerClubNotificationWriter((input) => {
      nextRuntime.notificationService.create(input);
    });
    return nextRuntime;
  }, [namespace]);

  return (
    <PlatformRuntimeContext.Provider value={runtime}>{children}</PlatformRuntimeContext.Provider>
  );
}
