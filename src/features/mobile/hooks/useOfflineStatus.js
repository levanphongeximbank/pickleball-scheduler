import { useCallback, useEffect, useState } from "react";

import { getPendingQueueCount } from "../services/offlineQueue.js";

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(() => {
    setPendingCount(getPendingQueueCount());
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshPending();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    refreshPending();

    const interval = setInterval(refreshPending, 5000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [refreshPending]);

  return {
    isOnline,
    isOffline: !isOnline,
    pendingCount,
    refreshPending,
  };
}
