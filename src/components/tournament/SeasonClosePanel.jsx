import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../context/SeasonContext.jsx";
import {
  buildSeasonExport,
  closeSeason,
} from "../../domain/seasonCloseService.js";
import { archiveSeason } from "../../domain/seasonService.js";
import {
  downloadSeasonExportCsv,
  downloadSeasonExportJson,
} from "../../pages/seasonExport.logic.js";
import SeasonStandingsTable from "./SeasonStandingsTable.jsx";
import { touchButtonSx } from "./mobileUi.js";
import PermissionGate from "../auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";

const STATUS_LABELS = {
  draft: "Nháp",
  active: "Đang diễn ra",
  completed: "Đã chốt",
  archived: "Lưu trữ",
};

export default function SeasonClosePanel({ onMessage }) {
  const { activeClubId, refreshClubs } = useClub();
  const { seasons, activeSeasonId } = useSeasonLeague();
  const [seasonId, setSeasonId] = useState(activeSeasonId || "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exportPackage, setExportPackage] = useState(null);

  const selectedSeason = useMemo(
    () => seasons.find((season) => season.id === seasonId) || null,
    [seasons, seasonId]
  );

  const isActiveSeason = seasonId && seasonId === activeSeasonId;
  const isClosed =
    selectedSeason?.status === "completed" || selectedSeason?.status === "archived";

  const handlePreviewExport = () => {
    if (!seasonId) {
      onMessage?.({ type: "error", text: "Chọn mùa giải trước." });
      return;
    }

    const result = buildSeasonExport(activeClubId, seasonId);
    if (!result.ok) {
      onMessage?.({ type: "error", text: result.error });
      return;
    }

    setExportPackage(result.package);
    onMessage?.({ type: "success", text: "Đã tải bản xem trước kết quả mùa." });
  };

  const handleDownloadJson = () => {
    if (!seasonId) {
      onMessage?.({ type: "error", text: "Chọn mùa giải trước." });
      return;
    }

    const result = exportPackage
      ? { ok: true, package: exportPackage }
      : buildSeasonExport(activeClubId, seasonId);

    if (!result.ok) {
      onMessage?.({ type: "error", text: result.error });
      return;
    }

    downloadSeasonExportJson(result.package);
    onMessage?.({ type: "success", text: "Đã tải file JSON kết quả mùa." });
  };

  const handleDownloadCsv = () => {
    if (!seasonId) {
      onMessage?.({ type: "error", text: "Chọn mùa giải trước." });
      return;
    }

    const result = exportPackage
      ? { ok: true, package: exportPackage }
      : buildSeasonExport(activeClubId, seasonId);

    if (!result.ok) {
      onMessage?.({ type: "error", text: result.error });
      return;
    }

    downloadSeasonExportCsv(result.package);
    onMessage?.({ type: "success", text: "Đã tải CSV BXH mùa." });
  };

  const handleArchiveSeason = () => {
    const result = archiveSeason(activeClubId, seasonId);
    if (!result.ok) {
      onMessage?.({ type: "error", text: result.error });
      return;
    }

    refreshClubs();
    onMessage?.({ type: "success", text: "Đã lưu trữ mùa giải." });
  };

  const handleCloseSeason = () => {
    const result = closeSeason(activeClubId, seasonId);
    setConfirmOpen(false);

    if (!result.ok) {
      onMessage?.({ type: "error", text: result.error });
      return;
    }

    if (result.export) {
      setExportPackage(result.export);
    }

    refreshClubs();
    onMessage?.({
      type: "success",
      text: `Đã chốt mùa "${result.season?.name || ""}". Có thể tải JSON/CSV bên dưới.`,
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight="bold">
            Chốt mùa &amp; Export
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tổng hợp BXH, vòng giải và giải đấu trong mùa. Chốt mùa sẽ đánh dấu mùa/giải/vòng là
            hoàn thành.
          </Typography>
        </Box>

        <FormControl fullWidth size="small">
          <InputLabel id="season-close-select-label">Mùa giải</InputLabel>
          <Select
            labelId="season-close-select-label"
            label="Mùa giải"
            value={seasonId}
            onChange={(event) => {
              setSeasonId(event.target.value);
              setExportPackage(null);
            }}
          >
            {seasons.map((season) => (
              <MenuItem key={season.id} value={season.id}>
                {season.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedSeason && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Chip
              size="small"
              label={STATUS_LABELS[selectedSeason.status] || selectedSeason.status}
              color={selectedSeason.status === "completed" ? "success" : "default"}
            />
            {selectedSeason.startDate && (
              <Chip size="small" variant="outlined" label={`Bắt đầu: ${selectedSeason.startDate}`} />
            )}
            {selectedSeason.endDate && (
              <Chip size="small" variant="outlined" label={`Kết thúc: ${selectedSeason.endDate}`} />
            )}
          </Stack>
        )}

        {isActiveSeason && !isClosed && (
          <Alert severity="warning">
            Mùa này đang active. Hãy chuyển sang mùa khác trước khi chốt.
          </Alert>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexWrap: "wrap" }}>
          <PermissionGate permission={PERMISSIONS.STATISTICS_EXPORT}>
            <Button variant="outlined" sx={touchButtonSx} onClick={handlePreviewExport}>
              Xem trước
            </Button>
            <Button variant="outlined" sx={touchButtonSx} onClick={handleDownloadJson}>
              Tải JSON đầy đủ
            </Button>
            <Button variant="outlined" sx={touchButtonSx} onClick={handleDownloadCsv}>
              Tải CSV BXH
            </Button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.SEASONS_MANAGE}>
            <Button
              variant="contained"
              color="success"
              sx={touchButtonSx}
              disabled={!seasonId || isActiveSeason || isClosed}
              onClick={() => setConfirmOpen(true)}
            >
              Chốt mùa
            </Button>
            {selectedSeason?.status === "completed" && (
              <Button
                variant="outlined"
                color="inherit"
                sx={touchButtonSx}
                disabled={isActiveSeason}
                onClick={handleArchiveSeason}
              >
                Lưu trữ mùa
              </Button>
            )}
          </PermissionGate>
        </Stack>

        {exportPackage && (
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">
              {exportPackage.summary?.leagueCount || 0} giải •{" "}
              {exportPackage.summary?.roundCount || 0} vòng •{" "}
              {exportPackage.summary?.tournamentCount || 0} giải đấu
            </Typography>

            {(exportPackage.leagues || []).map((leagueSection) => (
              <Box key={leagueSection.league.id}>
                <Typography fontWeight="bold" sx={{ mb: 1 }}>
                  {leagueSection.league.name}
                </Typography>
                <SeasonStandingsTable
                  rows={leagueSection.standings || []}
                  leagueName={leagueSection.league.name}
                  seasonName={exportPackage.season?.name}
                  pointsSystem={leagueSection.league.pointsSystem}
                />
                {leagueSection.tournaments?.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    {leagueSection.tournaments.length} giải đấu trong giải này
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Stack>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Chốt mùa giải?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Mùa &quot;{selectedSeason?.name}&quot; sẽ chuyển sang trạng thái <strong>Đã chốt</strong>.
            Các giải và vòng trong mùa cũng được đánh dấu hoàn thành. Bạn vẫn có thể export sau
            khi chốt.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Hủy</Button>
          <Button variant="contained" color="success" onClick={handleCloseSeason}>
            Chốt mùa
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
