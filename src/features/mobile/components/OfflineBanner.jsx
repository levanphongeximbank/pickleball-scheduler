import { useState } from "react";
import { Alert, AlertTitle, Button, Chip, Stack } from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import SyncIcon from "@mui/icons-material/Sync";

import { useOfflineStatus } from "../hooks/useOfflineStatus.js";
import { flushOfflineQueue } from "../services/offlineQueue.js";
import { buildOfflineQueueBannerModel } from "../utils/offlineQueueStatus.js";

export default function OfflineBanner() {
  const { isOffline, pendingCount, refreshPending } = useOfflineStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    const result = await flushOfflineQueue();
    refreshPending();
    setIsSyncing(false);
    if (result.conflicts?.length > 0) {
      window.alert(
        `Đồng bộ xong nhưng có ${result.conflicts.length} xung đột. Vui lòng kiểm tra thủ công.`
      );
    }
  };

  const banner = buildOfflineQueueBannerModel({
    pendingCount,
    isOffline,
    isSyncing,
  });

  if (!banner.showBanner) {
    return null;
  }

  return (
    <Alert
      severity={banner.severity}
      icon={<CloudOffIcon />}
      sx={{ mb: 2, borderRadius: 2 }}
      action={
        banner.showAction ? (
          <Button color="inherit" size="small" startIcon={<SyncIcon />} onClick={handleSync}>
            {banner.actionLabel}
          </Button>
        ) : null
      }
    >
      <AlertTitle>{banner.title}</AlertTitle>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <span>{banner.message}</span>
        {pendingCount > 0 && (
          <Chip size="small" label={`${pendingCount} chờ sync`} color="warning" />
        )}
        {!isOffline && pendingCount > 0 && (
          <Chip size="small" label="Có thể đồng bộ ngay" color="info" />
        )}
      </Stack>
    </Alert>
  );
}
