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
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";

import { useClub } from "../context/ClubContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import PermissionGate from "../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../auth/permissions.js";
import { savePlayersForClub } from "../domain/clubStorage.js";
import { loadPlayersFromStorage } from "./selectPlayers.data";
import { normalizePlayers } from "../models/player.js";
import PlayerStats from "../components/players/PlayerStats.jsx";
import PlayerFilters from "../components/players/PlayerFilters.jsx";
import PlayerCard from "../components/players/PlayerCard.jsx";
import PlayerImportExportDialog, {
  PlayerImportExportButton,
} from "../components/players/PlayerImportExport.jsx";
import TournamentPageHeader from "../components/tournament/TournamentPageHeader.jsx";
import TournamentEmptyState from "../components/tournament/TournamentEmptyState.jsx";
import { TOURNAMENT_LAYOUT } from "../components/tournament/tournamentLayout.js";
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
  const { activeClubId, activeClub, revision } = useClub();
  const { can, rbacEnabled, isAuthenticated } = useAuth();

  const canManagePlayers =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.PLAYER_UPDATE, {
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

  useEffect(() => {
    const nextPlayers = loadPlayersFromStorage(activeClubId);
    setPlayers(normalizePlayers(nextPlayers));
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

  const clearFilters = () => {
    setGenderFilter("all");
    setLevelRange([1.5, 6]);
    setStatusFilter("all");
    setSearch("");
  };

  const contextLine = activeClub?.name ? `CLB ${activeClub.name}` : undefined;

  const headerActions = (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap>
      <PermissionGate permission={PERMISSIONS.PLAYER_UPDATE}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Thêm người chơi
        </Button>
        <PlayerImportExportButton onClick={() => setImportOpen(true)} />
      </PermissionGate>
    </Stack>
  );

  return (
    <Box>
      <TournamentPageHeader
        title="Quản lý người chơi"
        description="Theo dõi trình độ, giới tính, trạng thái tham gia và dữ liệu để AI xếp sân cân bằng."
        contextLine={contextLine}
        action={headerActions}
      />

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

      <Grid container spacing={TOURNAMENT_LAYOUT.gridSpacing}>
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
        <Box sx={{ mt: TOURNAMENT_LAYOUT.sectionGap }}>
          <TournamentEmptyState
            icon={GroupsOutlinedIcon}
            title="Không tìm thấy người chơi"
            description="Thử đổi bộ lọc hoặc thêm người chơi mới."
          />
        </Box>
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
