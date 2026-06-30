import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";

import { useClub } from "../context/ClubContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import PermissionGate from "../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../auth/permissions.js";
import { savePlayersForClub } from "../domain/clubStorage.js";
import {
  approveSkillLevelProposal,
  ensureMonthlySkillLevelProposals,
  listPendingSkillLevelProposals,
  rejectSkillLevelProposal,
} from "../domain/skillLevelService.js";
import { loadPlayersFromStorage } from "./selectPlayers.data";
import { normalizePlayers } from "../models/player.js";
import PlayerStats from "../components/players/PlayerStats.jsx";
import PlayerFilters from "../components/players/PlayerFilters.jsx";
import PlayerCard from "../components/players/PlayerCard.jsx";
import PlayerImportExportDialog, {
  PlayerImportExportButton,
} from "../components/players/PlayerImportExport.jsx";
import {
  computePlayerDashboardStats,
  filterPlayers,
  getLevelColor,
  getLevelLabel,
  getTodayCheckedInPlayerIds,
  sortPlayers,
} from "../utils/playerHelpers.js";

const defaultPlayerForm = {
  name: "",
  gender: "Nam",
  phone: "",
  level: 3.5,
};

export default function Players() {
  const { activeClubId, activeClub, revision, refreshClubs } = useClub();
  const { can, rbacEnabled, isAuthenticated } = useAuth();

  const canManagePlayers =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.PLAYERS_MANAGE, {
      clubId: activeClubId,
      venueId: activeClub?.venueId || null,
    });
  const [players, setPlayers] = useState(() => normalizePlayers(loadPlayersFromStorage()));
  const [form, setForm] = useState(defaultPlayerForm);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [deletePlayer, setDeletePlayer] = useState(null);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [levelRange, setLevelRange] = useState([1.5, 6]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [formError, setFormError] = useState(null);
  const [reviewMessage, setReviewMessage] = useState(null);

  useEffect(() => {
    const nextPlayers = loadPlayersFromStorage(activeClubId);
    setPlayers(normalizePlayers(nextPlayers));
  }, [activeClubId, revision]);

  useEffect(() => {
    if (!activeClubId) {
      return;
    }

    const result = ensureMonthlySkillLevelProposals(activeClubId);
    if (!result.ok || result.skipped || result.proposalCount <= 0) {
      return;
    }

    setReviewMessage({
      type: "info",
      text: `Hệ thống đã tự tạo ${result.proposalCount} đề xuất đổi trình. Admin duyệt để áp dụng.`,
    });
  }, [activeClubId]);

  const pendingProposals = useMemo(() => {
    void revision;
    return listPendingSkillLevelProposals(activeClubId);
  }, [activeClubId, revision]);

  const checkedInIds = useMemo(
    () => getTodayCheckedInPlayerIds(activeClubId),
    [activeClubId, revision, players]
  );

  const stats = useMemo(
    () => computePlayerDashboardStats(players, activeClubId),
    [players, activeClubId]
  );

  const filteredPlayers = useMemo(() => {
    const filtered = filterPlayers(players, {
      search,
      genderFilter,
      levelRange,
      statusFilter,
      checkedInIds,
    });
    return sortPlayers(filtered, "name", "asc");
  }, [players, search, genderFilter, levelRange, statusFilter, checkedInIds]);

  const savePlayers = (updatedPlayers) => {
    setPlayers(updatedPlayers);
    savePlayersForClub(updatedPlayers, activeClubId);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreateDialog = () => {
    setEditingPlayer(null);
    setForm(defaultPlayerForm);
    setFormError(null);
    setOpen(true);
  };

  const openEditDialog = (player) => {
    setEditingPlayer(player);
    setForm({
      name: player.name,
      gender: player.gender || "Nam",
      phone: player.phone || "",
      level: Number(player.level) || 3.5,
    });
    setFormError(null);
    setOpen(true);
  };

  const handleSave = () => {
    const name = form.name.trim();
    if (name === "") {
      setFormError("Vui lòng nhập họ tên");
      return;
    }

    setFormError(null);
    const playerData = {
      name,
      gender: form.gender,
      phone: form.phone.trim(),
      level: Number(form.level),
      rating: Number(form.level),
    };

    const updatedPlayers = editingPlayer
      ? players.map((player) =>
          player.id === editingPlayer.id ? { ...player, ...playerData } : player
        )
      : [...players, { id: Date.now(), ...playerData }];

    savePlayers(updatedPlayers);
    setEditingPlayer(null);
    setForm(defaultPlayerForm);
    setOpen(false);
  };

  const handleDelete = () => {
    if (!deletePlayer) return;
    savePlayers(players.filter((player) => player.id !== deletePlayer.id));
    setDeletePlayer(null);
  };

  const handleLockPlayer = (player) => {
    const updated = players.map((p) =>
      p.id === player.id
        ? { ...p, status: "archived", active: false }
        : p
    );
    savePlayers(updated);
  };

  const handleApproveProposal = (proposalId) => {
    const result = approveSkillLevelProposal(activeClubId, proposalId);
    if (!result.ok) {
      setReviewMessage({ type: "error", text: result.error || "Không thể duyệt." });
      return;
    }
    refreshClubs();
    setReviewMessage({ type: "success", text: "Đã duyệt và cập nhật trình công khai." });
  };

  const handleRejectProposal = (proposalId) => {
    const result = rejectSkillLevelProposal(activeClubId, proposalId);
    if (!result.ok) {
      setReviewMessage({ type: "error", text: result.error || "Không thể từ chối." });
      return;
    }
    refreshClubs();
    setReviewMessage({ type: "info", text: "Đã từ chối đề xuất. Trình công khai giữ nguyên." });
  };

  const clearFilters = () => {
    setGenderFilter("all");
    setLevelRange([1.5, 6]);
    setStatusFilter("all");
    setSearch("");
  };

  return (
    <Box
      sx={{
        minHeight: "100%",
        mx: -3,
        my: -3,
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
        background: "linear-gradient(135deg, #f8fafc 0%, #eef6f1 48%, #f7fbff 100%)",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 2,
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          color: "#ffffff",
          background: "linear-gradient(135deg, #0f3f2e 0%, #157347 52%, #0f766e 100%)",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0.18,
            backgroundImage:
              "linear-gradient(90deg, transparent 49%, #ffffff 49%, #ffffff 51%, transparent 51%), linear-gradient(0deg, transparent 49%, #ffffff 49%, #ffffff 51%, transparent 51%)",
            backgroundSize: "140px 90px",
          }}
        />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          sx={{ position: "relative" }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={0.75}>
              <SportsTennisIcon fontSize="small" />
              <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
                AI Director · Roster
              </Typography>
            </Stack>
            <Typography
              variant="h4"
              sx={{ fontWeight: 900, fontSize: { xs: 28, md: 36 }, lineHeight: 1.1 }}
            >
              Quản lý người chơi
            </Typography>
            <Typography
              sx={{
                mt: 1,
                maxWidth: 620,
                color: "rgba(255,255,255,0.85)",
                fontSize: { xs: 14, md: 15 },
              }}
            >
              Theo dõi trình độ, giới tính, trạng thái tham gia và dữ liệu để AI xếp sân cân bằng.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <PermissionGate permission={PERMISSIONS.PLAYERS_MANAGE}>
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={openCreateDialog}
                sx={{
                  minWidth: 170,
                  borderRadius: 1.5,
                  bgcolor: "#ffffff",
                  color: "#0f3f2e",
                  fontWeight: 800,
                  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.2)",
                  "&:hover": { bgcolor: "#f8fafc" },
                }}
              >
                Thêm người chơi
              </Button>
              <PlayerImportExportButton onClick={() => setImportOpen(true)} />
            </PermissionGate>
          </Stack>
        </Stack>
      </Paper>

      {reviewMessage && (
        <Alert
          severity={reviewMessage.type}
          onClose={() => setReviewMessage(null)}
          sx={{ mb: 2 }}
        >
          {reviewMessage.text}
        </Alert>
      )}

      {pendingProposals.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
            Đề xuất đổi trình ({pendingProposals.length})
          </Typography>
          <Stack spacing={1}>
            {pendingProposals.map((proposal) => (
              <Stack
                key={proposal.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                sx={{ py: 0.5 }}
              >
                <Box>
                  <Typography fontWeight={700}>
                    {proposal.playerName || `VĐV #${proposal.playerId}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {Number(proposal.currentLevel).toFixed(1)} →{" "}
                    {Number(proposal.proposedLevel).toFixed(1)} • Rating nội bộ{" "}
                    {Number(proposal.ratingInternal).toFixed(2)} • Tháng {proposal.reviewMonth}
                  </Typography>
                </Box>
                {canManagePlayers && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleApproveProposal(proposal.id)}
                    >
                      Duyệt
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleRejectProposal(proposal.id)}
                    >
                      Từ chối
                    </Button>
                  </Stack>
                )}
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      <PlayerStats stats={stats} />

      <PlayerFilters
        search={search}
        onSearchChange={setSearch}
        genderFilter={genderFilter}
        onGenderFilterChange={setGenderFilter}
        levelRange={levelRange}
        onLevelRangeChange={setLevelRange}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        filteredCount={filteredPlayers.length}
        totalCount={players.length}
        onClearFilters={clearFilters}
      />

      <Grid container spacing={2}>
        {filteredPlayers.map((player) => (
          <Grid key={player.id} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
            <PlayerCard
              player={player}
              clubId={activeClubId}
              players={players}
              checkedInIds={checkedInIds}
              onEdit={canManagePlayers ? openEditDialog : undefined}
              onDelete={canManagePlayers ? setDeletePlayer : undefined}
              onLock={canManagePlayers ? handleLockPlayer : undefined}
            />
          </Grid>
        ))}
      </Grid>

      {filteredPlayers.length === 0 && (
        <Paper
          elevation={0}
          sx={{
            mt: 2,
            p: 4,
            textAlign: "center",
            borderRadius: 2,
            border: "1px dashed rgba(15, 23, 42, 0.18)",
          }}
        >
          <Typography variant="h6" fontWeight={900}>
            Không tìm thấy người chơi
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Thử đổi bộ lọc hoặc thêm người chơi mới.
          </Typography>
        </Paper>
      )}

      <PlayerImportExportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        items={players}
        onImport={savePlayers}
      />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>
          {editingPlayer ? "Sửa người chơi" : "Thêm người chơi"}
        </DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <TextField
            label="Họ và tên"
            fullWidth
            margin="normal"
            value={form.name}
            onChange={(e) => updateForm("name", e.target.value)}
          />
          <TextField
            select
            label="Giới tính"
            fullWidth
            margin="normal"
            value={form.gender}
            onChange={(e) => updateForm("gender", e.target.value)}
          >
            <MenuItem value="Nam">Nam</MenuItem>
            <MenuItem value="Nữ">Nữ</MenuItem>
          </TextField>
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" fontWeight={900}>
                Level
              </Typography>
              <Chip
                label={`${Number(form.level).toFixed(1)} · ${getLevelLabel(Number(form.level))}`}
                sx={{
                  bgcolor: `${getLevelColor(Number(form.level))}18`,
                  color: getLevelColor(Number(form.level)),
                  fontWeight: 800,
                }}
              />
            </Stack>
            <Slider
              value={form.level}
              min={1.5}
              max={6}
              step={0.1}
              valueLabelDisplay="auto"
              onChange={(_, v) => updateForm("level", v)}
            />
          </Box>
          <TextField
            label="Số điện thoại"
            fullWidth
            margin="normal"
            value={form.phone}
            onChange={(e) => updateForm("phone", e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSave}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deletePlayer !== null} onClose={() => setDeletePlayer(null)}>
        <DialogTitle sx={{ fontWeight: 900 }}>Xác nhận xóa</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc muốn xóa <strong>{deletePlayer?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeletePlayer(null)}>Hủy</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
