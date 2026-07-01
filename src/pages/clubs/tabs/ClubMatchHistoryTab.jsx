import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import { useAuth } from "../../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import {
  createFriendlyClubMatch,
  getClubMatches,
  getClubMembers,
  getTenantPlayers,
} from "../../../features/club/index.js";
import { CLUB_MATCH_TYPES } from "../../../features/club/models/clubMatch.js";
import { CLUB_MEMBER_STATUSES } from "../../../features/club/constants/clubMemberRoles.js";

const TYPE_LABELS = {
  [CLUB_MATCH_TYPES.FRIENDLY]: "Giao hữu",
  [CLUB_MATCH_TYPES.INTERNAL_TOURNAMENT]: "Giải nội bộ",
};

export default function ClubMatchHistoryTab({ club, tenantId, onRefresh }) {
  const { can, rbacEnabled, isAuthenticated } = useAuth();
  const [revision, setRevision] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    teamAPlayerId: "",
    teamBPlayerId: "",
    teamAScore: "",
    teamBScore: "",
    playedAt: new Date().toISOString().slice(0, 10),
  });

  const canCreate =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.TOURNAMENT_UPDATE, { clubId: club.id, venueId: tenantId });

  const matches = useMemo(
    () => getClubMatches(club.id, tenantId),
    [club.id, tenantId, revision]
  );

  const playersById = useMemo(() => {
    const players = getTenantPlayers(tenantId);
    return new Map(players.map((p) => [p.id, p]));
  }, [tenantId, revision]);

  const activeMemberIds = useMemo(() => {
    return getClubMembers(club.id, tenantId)
      .filter((m) => m.status === CLUB_MEMBER_STATUSES.ACTIVE)
      .map((m) => m.playerId);
  }, [club.id, tenantId, revision]);

  const memberPlayers = useMemo(
    () => activeMemberIds.map((id) => playersById.get(id)).filter(Boolean),
    [activeMemberIds, playersById]
  );

  const formatPlayers = (ids) =>
    ids.map((id) => playersById.get(id)?.name || id).join(" / ");

  const handleCreate = () => {
    setError(null);
    const result = createFriendlyClubMatch(
      club.id,
      {
        teamAPlayerIds: [form.teamAPlayerId],
        teamBPlayerIds: [form.teamBPlayerId],
        teamAScore: Number(form.teamAScore),
        teamBScore: Number(form.teamBScore),
        playedAt: new Date(form.playedAt).toISOString(),
        applyElo: true,
      },
      tenantId
    );

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCreateOpen(false);
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

      <Stack direction="row" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1" fontWeight={600}>
          {matches.length} trận
        </Typography>
        {canCreate && (
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Ghi trận giao hữu
          </Button>
        )}
      </Stack>

      {matches.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary" gutterBottom>
            Chưa có lịch sử thi đấu.
          </Typography>
          {canCreate && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Ghi trận đầu tiên
            </Button>
          )}
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ngày</TableCell>
                <TableCell>Loại</TableCell>
                <TableCell>Đội A</TableCell>
                <TableCell>Đội B</TableCell>
                <TableCell align="center">Tỷ số</TableCell>
                <TableCell>Thắng</TableCell>
                <TableCell>ELO</TableCell>
                <TableCell>Chi tiết</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matches.map((match) => (
                <TableRow key={match.id} hover>
                  <TableCell>
                    {new Date(match.playedAt).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={TYPE_LABELS[match.type] || match.type} />
                  </TableCell>
                  <TableCell>{formatPlayers(match.teamAPlayerIds)}</TableCell>
                  <TableCell>{formatPlayers(match.teamBPlayerIds)}</TableCell>
                  <TableCell align="center">
                    {match.teamAScore != null && match.teamBScore != null
                      ? `${match.teamAScore} - ${match.teamBScore}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {match.winnerTeam === "A"
                      ? "Đội A"
                      : match.winnerTeam === "B"
                        ? "Đội B"
                        : "—"}
                  </TableCell>
                  <TableCell>
                    {match.eloApplied ? (
                      <Chip size="small" color="success" label="Đã cập nhật" />
                    ) : (
                      <Chip size="small" label="Chưa" />
                    )}
                  </TableCell>
                  <TableCell>
                    {match.tournamentId ? (
                      <Link component={RouterLink} to={`/tournament/internal/${match.tournamentId}`}>
                        Xem giải
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ghi trận giao hữu</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              type="date"
              label="Ngày thi đấu"
              value={form.playedAt}
              onChange={(e) => setForm((f) => ({ ...f, playedAt: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label="Đội A"
              value={form.teamAPlayerId}
              onChange={(e) => setForm((f) => ({ ...f, teamAPlayerId: e.target.value }))}
            >
              {memberPlayers.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Đội B"
              value={form.teamBPlayerId}
              onChange={(e) => setForm((f) => ({ ...f, teamBPlayerId: e.target.value }))}
            >
              {memberPlayers.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Tỷ số A"
                type="number"
                value={form.teamAScore}
                onChange={(e) => setForm((f) => ({ ...f, teamAScore: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Tỷ số B"
                type="number"
                value={form.teamBScore}
                onChange={(e) => setForm((f) => ({ ...f, teamBScore: e.target.value }))}
                fullWidth
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              ELO CLB sẽ tự cập nhật sau khi lưu (nếu có tỷ số hợp lệ).
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={
              !form.teamAPlayerId ||
              !form.teamBPlayerId ||
              form.teamAPlayerId === form.teamBPlayerId ||
              form.teamAScore === "" ||
              form.teamBScore === ""
            }
          >
            Lưu & cập nhật ELO
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
