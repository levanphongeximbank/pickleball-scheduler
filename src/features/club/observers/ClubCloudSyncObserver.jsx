/**
 * Business/composition observer — club cloud auto-pull + conflict recovery.
 * Consumes AI sync services; must not live inside Platform ClubContext.
 * Kept outside src/ai/ so AI engines remain free of React/MUI (architecture lock).
 */
import { useEffect, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { isClubDataDirty } from "../../../domain/clubSyncMetadata.js";
import { pullClubFromCloud } from "../../../ai/cloudSync.js";
import { autoPullOnClubActivate, isAiAutoCloudSyncEnabled } from "../../../ai/autoCloudSync.js";

export function ClubCloudSyncObserver() {
  const { isAuthenticated } = useAuth();
  const { activeClubId, refreshClubs } = useClub();
  const [syncConflictMessage, setSyncConflictMessage] = useState(null);

  useEffect(() => {
    if (!activeClubId || !isAuthenticated || !isAiAutoCloudSyncEnabled()) {
      return undefined;
    }

    let cancelled = false;

    void autoPullOnClubActivate(activeClubId)
      .then((result) => {
        if (!cancelled && result?.ok && !result.skipped && !result.error) {
          refreshClubs();
        }
      })
      .catch(() => {
        // AI absence/failure must not invalidate Platform Club context.
      });

    const onClubConflict = (event) => {
      const conflictClubId = event?.detail?.clubId || activeClubId;

      if (isClubDataDirty(conflictClubId)) {
        setSyncConflictMessage(
          "Dữ liệu CLB đã được cập nhật trên cloud trong khi máy bạn có thay đổi chưa đồng bộ. Vào Cài đặt để đẩy lên hoặc tải lại."
        );
        return;
      }

      setSyncConflictMessage("Dữ liệu CLB đã được cập nhật bởi người khác — đang tải lại...");
      void pullClubFromCloud({
        clubId: conflictClubId,
        permission: PERMISSIONS.SCHEDULING_RUN,
      })
        .then((result) => {
          if (!cancelled && result?.ok) {
            refreshClubs();
            setSyncConflictMessage("Đã tải dữ liệu CLB mới nhất từ cloud.");
          } else if (!cancelled && result?.error) {
            setSyncConflictMessage(result.error);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSyncConflictMessage("Không thể tải dữ liệu CLB từ cloud.");
          }
        });
    };

    window.addEventListener("club-data:version-conflict", onClubConflict);

    return () => {
      cancelled = true;
      window.removeEventListener("club-data:version-conflict", onClubConflict);
    };
  }, [activeClubId, isAuthenticated, refreshClubs]);

  return (
    <Snackbar
      open={Boolean(syncConflictMessage)}
      autoHideDuration={6000}
      onClose={() => setSyncConflictMessage(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        onClose={() => setSyncConflictMessage(null)}
        severity="warning"
        variant="filled"
        sx={{ width: "100%" }}
      >
        {syncConflictMessage}
      </Alert>
    </Snackbar>
  );
}
