import { Button, Stack } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";

import { useClub } from "../../context/ClubContext.jsx";
import { buildSeasonExport } from "../../domain/seasonCloseService.js";
import {
  downloadSeasonExportCsv,
  downloadSeasonExportJson,
} from "../../pages/seasonExport.logic.js";
import PermissionGate from "../auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";

/**
 * Nút export / link chốt mùa — dùng trên trang Thống kê.
 */
export default function SeasonExportActions({
  seasonId,
  onMessage,
  showCloseLink = true,
}) {
  const { activeClubId } = useClub();

  const runExport = (format) => {
    if (!seasonId) {
      onMessage?.({ type: "error", text: "Chọn mùa giải trước." });
      return;
    }

    const result = buildSeasonExport(activeClubId, seasonId);
    if (!result.ok) {
      onMessage?.({ type: "error", text: result.error });
      return;
    }

    if (format === "json") {
      downloadSeasonExportJson(result.package);
      onMessage?.({ type: "success", text: "Đã tải JSON kết quả mùa đầy đủ." });
      return;
    }

    downloadSeasonExportCsv(result.package);
    onMessage?.({ type: "success", text: "Đã tải CSV BXH toàn mùa." });
  };

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexWrap: "wrap" }}>
      <PermissionGate permission={PERMISSIONS.STATISTICS_EXPORT}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={() => runExport("json")}
        >
          JSON mùa đầy đủ
        </Button>
        <Button size="small" variant="outlined" onClick={() => runExport("csv")}>
          CSV toàn mùa
        </Button>
      </PermissionGate>
      {showCloseLink && (
        <PermissionGate permission={PERMISSIONS.SEASON_UPDATE}>
          <Button
            size="small"
            variant="text"
            component={RouterLink}
            to="/club-management"
            startIcon={<EventAvailableIcon />}
          >
            Chốt mùa → CLB &amp; Giải
          </Button>
        </PermissionGate>
      )}
    </Stack>
  );
}
