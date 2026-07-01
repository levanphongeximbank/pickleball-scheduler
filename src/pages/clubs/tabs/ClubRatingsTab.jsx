import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

import { useAuth } from "../../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import {
  getClubRatings,
  getTenantPlayers,
  updateClubRating,
} from "../../../features/club/index.js";

export default function ClubRatingsTab({ club, tenantId, onRefresh }) {
  const { can, rbacEnabled, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [sortBy, setSortBy] = useState("elo");
  const [editTarget, setEditTarget] = useState(null);
  const [newElo, setNewElo] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);

  const canEditElo =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.PLAYER_UPDATE, { clubId: club.id, venueId: tenantId });

  const playersById = useMemo(() => {
    const players = getTenantPlayers(tenantId);
    return new Map(players.map((p) => [p.id, p]));
  }, [tenantId, revision]);

  const rows = useMemo(() => {
    let ratings = getClubRatings(club.id, tenantId).map((r, index) => {
      const player = playersById.get(r.playerId);
      const winRate =
        r.matchesPlayed > 0 ? Math.round((r.wins / r.matchesPlayed) * 100) : 0;
      return {
        ...r,
        rank: index + 1,
        name: player?.name || r.playerId,
        level: r.level ?? player?.level,
        winRate,
      };
    });

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      ratings = ratings.filter((r) => r.name.toLowerCase().includes(q));
    }

    if (levelFilter) {
      ratings = ratings.filter((r) => String(r.level) === levelFilter);
    }

    ratings.sort((a, b) => {
      switch (sortBy) {
        case "matches":
          return b.matchesPlayed - a.matchesPlayed;
        case "winRate":
          return b.winRate - a.winRate;
        default:
          return b.elo - a.elo;
      }
    });

    return ratings.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [club.id, tenantId, search, levelFilter, sortBy, playersById, revision]);

  const handleSaveElo = () => {
    const result = updateClubRating(
      club.id,
      editTarget.playerId,
      Number(newElo),
      reason,
      tenantId
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditTarget(null);
    setRevision((v) => v + 1);
    onRefresh?.();
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2}>
        <TextField
          size="small"
          label="Tìm player"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Lọc level"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          sx={{ minWidth: 120 }}
        />
        <TextField
          select
          size="small"
          label="Sắp xếp"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          SelectProps={{ native: true }}
          sx={{ minWidth: 140 }}
        >
          <option value="elo">ELO</option>
          <option value="matches">Số trận</option>
          <option value="winRate">Tỷ lệ thắng</option>
        </TextField>
      </Stack>

      {rows.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">Chưa có dữ liệu xếp hạng.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Hạng</TableCell>
                <TableCell>Tên</TableCell>
                <TableCell align="right">ELO</TableCell>
                <TableCell align="right">Level</TableCell>
                <TableCell align="right">Trận</TableCell>
                <TableCell align="right">Thắng</TableCell>
                <TableCell align="right">Thua</TableCell>
                <TableCell align="right">Tỷ lệ thắng</TableCell>
                <TableCell>Cập nhật</TableCell>
                {canEditElo && <TableCell align="right" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.playerId} hover>
                  <TableCell>{row.rank}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell align="right">{row.elo}</TableCell>
                  <TableCell align="right">{row.level ?? "—"}</TableCell>
                  <TableCell align="right">{row.matchesPlayed}</TableCell>
                  <TableCell align="right">{row.wins}</TableCell>
                  <TableCell align="right">{row.losses}</TableCell>
                  <TableCell align="right">{row.winRate}%</TableCell>
                  <TableCell>
                    {new Date(row.lastUpdatedAt).toLocaleDateString("vi-VN")}
                  </TableCell>
                  {canEditElo && (
                    <TableCell align="right">
                      <Tooltip title="Chỉnh ELO">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditTarget(row);
                            setNewElo(String(row.elo));
                            setReason("");
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Chỉnh ELO — {editTarget?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="ELO mới"
              type="number"
              value={newElo}
              onChange={(e) => setNewElo(e.target.value)}
            />
            <TextField
              label="Lý do"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Chỉnh thủ công"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>Hủy</Button>
          <Button variant="contained" onClick={handleSaveElo}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
