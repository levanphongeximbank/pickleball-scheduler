import { useContext } from "react";
import { NotificationRuntimeContext } from "./notificationRuntimeContext.js";

export function useNotificationRuntime() {
  return useContext(NotificationRuntimeContext);
}
