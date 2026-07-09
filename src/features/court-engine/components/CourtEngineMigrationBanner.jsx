import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

import {
  isCourtEngineCloudEnabled,
  isCourtEngineMigrated,
  migrateLocalCourtEngineToCloud,
} from "../storage/courtEngineCloudStore.js";
import { loadCourtEngineStore } from "../storage/courtEngineStorage.js";

/**
 * One-time prompt: đồng bộ Court Engine local lên cloud (Phase 22 wizard).
 */
export function CourtEngineMigrationBanner({ clubId, tenantId, onMigrated }) {
  if (!isCourtEngineCloudEnabled() || !clubId || !tenantId) {
    return null;
  }

  if (isCourtEngineMigrated(clubId, tenantId)) {
    return null;
  }

  const localStore = loadCourtEngineStore(clubId, { tenantId });
  const sessionCount = localStore?.sessions?.length || 0;

  if (sessionCount === 0) {
    return null;
  }

  const handleMigrate = async () => {
    const result = await migrateLocalCourtEngineToCloud(clubId, tenantId);
    if (result.ok && onMigrated) {
      onMigrated(result);
    }
  };

  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      <Stack spacing={1}>
        <Typography variant="body2">
          Court Engine đang lưu {sessionCount} phiên trên máy này. Đồng bộ lên cloud để staff khác
          cùng thấy dữ liệu.
        </Typography>
        <Box>
          <Button
            size="small"
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => void handleMigrate()}
          >
            Đồng bộ lên cloud
          </Button>
        </Box>
      </Stack>
    </Alert>
  );
}
