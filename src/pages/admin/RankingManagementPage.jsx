import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { listTournaments } from "../../domain/tournamentService.js";
import { PERMISSIONS } from "../../auth/permissions.js";
import { VPR_CATEGORY_OPTIONS } from "../../features/vpr-ranking/constants/vprCategories.js";
import { VPR_PLACEMENT_LABELS } from "../../features/vpr-ranking/constants/vprPlacements.js";
import {
  listVprLedger,
  manualAdjustVprPoints,
  recalculateTournamentVpr,
} from "../../features/vpr-ranking/services/vprAwardService.js";
import { queryPublicLeaderboard } from "../../features/vpr-ranking/services/vprLeaderboardService.js";
import { listVprAuditLogs } from "../../features/vpr-ranking/storage/vprLocalStore.js";

export default function RankingManagementPage() {
  const { can, user } = useAuth();
  const { activeClubId, refreshClubs } = useClub();
  const [tab, setTab] = useState(0);
  const [category, setCategory] = useState("men_single");
  const [tournamentId, setTournamentId] = useState("");
  const [manualAthleteId, setManualAthleteId] = useState("");
  const [manualDelta, setManualDelta] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const canView = can(PERMISSIONS.RANKING_VIEW);
  const canManage = can(PERMISSIONS.RANKING_MANAGE);

  const leaderboard = useMemo(
    () => queryPublicLeaderboard({ category }),
    [category]
  );
  const ledger = useMemo(() => listVprLedger({ category }), [category]);
  const auditLogs = useMemo(() => listVprAuditLogs().slice(0, 100), [tab, message]);

  const tournaments = useMemo(() => listTournaments(activeClubId), [activeClubId, message]);

  if (!canView) {
    return <Alert severity="warning">Bạn không có quyền xem quản trị VPR.</Alert>;
  }

  const handleRecalculate = async () => {
    if (!tournamentId || !canManage) {
      return;
    }
    setError(null);
    const result = await recalculateTournamentVpr(activeClubId, tournamentId, {
      actorUserId: user?.id,
    });
    refreshClubs();
    if (!result.ok) {
      setError(result.error || result.reason);
      return;
    }
    setMessage("Đã tính lại điểm VPR cho giải.");
  };

  const handleManualAdjust = () => {
    if (!canManage) {
      return;
    }
    const result = manualAdjustVprPoints({
      vprAthleteId: manualAthleteId,
      category,
      delta: Number(manualDelta),
      reason: manualReason,
      actorUserId: user?.id,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Đã điều chỉnh điểm thủ công.");
    setManualDelta("");
    setManualReason("");
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        Quản trị VPR Ranking
      </Typography>
      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="BXH" />
        <Tab label="Lịch sử điểm" />
        <Tab label="Tính lại" />
        {canManage && <Tab label="Điều chỉnh" />}
        <Tab label="Audit" />
      </Tabs>

      <FormControl size="small" sx={{ minWidth: 200, mb: 2 }}>
        <InputLabel>Nội dung</InputLabel>
        <Select label="Nội dung" value={category} onChange={(e) => setCategory(e.target.value)}>
          {VPR_CATEGORY_OPTIONS.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {item.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {tab === 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Hạng</TableCell>
                <TableCell>VĐV</TableCell>
                <TableCell>CLB</TableCell>
                <TableCell>Khu vực</TableCell>
                <TableCell align="right">Điểm</TableCell>
                <TableCell align="right">Giải</TableCell>
                <TableCell>TT tốt nhất</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaderboard.map((row) => (
                <TableRow key={`${row.category}-${row.vprAthleteId}`}>
                  <TableCell>{row.rank}</TableCell>
                  <TableCell>{row.displayName}</TableCell>
                  <TableCell>{row.clubName}</TableCell>
                  <TableCell>{row.region}</TableCell>
                  <TableCell align="right">{row.totalPoints}</TableCell>
                  <TableCell align="right">{row.tournamentsCount}</TableCell>
                  <TableCell>
                    {VPR_PLACEMENT_LABELS[row.bestPlacement] || row.bestPlacement || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 1 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Thời gian</TableCell>
                <TableCell>Giải</TableCell>
                <TableCell>VĐV</TableCell>
                <TableCell>Thành tích</TableCell>
                <TableCell align="right">Điểm</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ledger.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.awardedAt).toLocaleString("vi-VN")}</TableCell>
                  <TableCell>{row.tournamentName}</TableCell>
                  <TableCell>{row.displayName}</TableCell>
                  <TableCell>{VPR_PLACEMENT_LABELS[row.placement] || row.placement}</TableCell>
                  <TableCell align="right">{row.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 2 && canManage && (
        <Stack spacing={2} maxWidth={480}>
          <FormControl fullWidth size="small">
            <InputLabel>Giải</InputLabel>
            <Select
              label="Giải"
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
            >
              {tournaments.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" disabled={!tournamentId} onClick={handleRecalculate}>
            Tính lại điểm VPR
          </Button>
        </Stack>
      )}

      {tab === 3 && canManage && (
        <Stack spacing={2} maxWidth={480}>
          <TextField
            label="VPR Athlete ID"
            size="small"
            value={manualAthleteId}
            onChange={(e) => setManualAthleteId(e.target.value)}
          />
          <TextField
            label="Điểm (+/-)"
            size="small"
            type="number"
            value={manualDelta}
            onChange={(e) => setManualDelta(e.target.value)}
          />
          <TextField
            label="Lý do"
            size="small"
            value={manualReason}
            onChange={(e) => setManualReason(e.target.value)}
          />
          <Button variant="contained" onClick={handleManualAdjust}>
            Áp dụng điều chỉnh
          </Button>
        </Stack>
      )}

      {tab === (canManage ? 4 : 3) && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Thời gian</TableCell>
                <TableCell>Hành động</TableCell>
                <TableCell>Giải</TableCell>
                <TableCell>VĐV</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditLogs.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.createdAt).toLocaleString("vi-VN")}</TableCell>
                  <TableCell>{row.action}</TableCell>
                  <TableCell>{row.tournamentId || "—"}</TableCell>
                  <TableCell>{row.vprAthleteId || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
