import { useCallback, useEffect, useMemo, useState } from "react";

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
import { isPlatformAthleteViewer } from "../auth/roles.js";
import { loadClubs } from "../data/club.js";
import { savePlayersForClub, loadPlayersForClub } from "../domain/clubStorage.js";
import { setInitialSkillLevel } from "../domain/skillLevelChangeService.js";
import { canViewPlayerSkillLevel } from "../auth/rbac.js";
import { loadPlayersFromStorage } from "./selectPlayers.data";
import { normalizePlayers } from "../models/player.js";
import {
  getPlatformAthletes,
  PLATFORM_ATHLETE_LINK_STATUS,
} from "../features/club/index.js";
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
  const { activeClubId, activeClub, revision, clubs } = useClub();
  const { can, rbacEnabled, isAuthenticated, user } = useAuth();
  const platformMode = isPlatformAthleteViewer(user?.role);

  const canViewClubSkillLevels =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.SKILL_LEVEL_VIEW_PRIVATE, {
      clubId: activeClubId,
      venueId: activeClub?.venueId || null,
    });

  const canViewPlayerSkill = (playerId) =>
    canViewPlayerSkillLevel(
      user,
      { clubId: activeClubId, playerId },
      { rbacEnabled }
    );

  const canManagePlayers =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.PLAYER_UPDATE, {
      clubId: activeClubId,
      venueId: activeClub?.venueId || null,
    });
  const [players, setPlayers] = useState(() => normalizePlayers(loadPlayersFromStorage()));
  const [platformWarning, setPlatformWarning] = useState(null);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [clubFilter, setClubFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState("all");
  const [form, setForm] = useState(defaultPlayerForm);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [deletePlayer, setDeletePlayer] = useState(null);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [levelRange, setLevelRange] = useState([2.0, 6.5]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [formError, setFormError] = useState(null);

  const loadPlatformPlayers = useCallback(async () => {
    setPlatformLoading(true);
    const result = await getPlatformAthletes();
    setPlatformLoading(false);

    if (!result.ok) {
      setPlatformWarning(result.error || "Không tải được danh sách VĐV toàn hệ thống.");
      setPlayers([]);
      return;
    }

    setPlayers(normalizePlayers(result.players || []));
    setPlatformWarning(result.warning || null);
  }, []);

  useEffect(() => {
    if (platformMode) {
      void loadPlatformPlayers();
      return;
    }

    const nextPlayers = loadPlayersFromStorage(activeClubId);
    setPlayers(normalizePlayers(nextPlayers));
    setPlatformWarning(null);
  }, [activeClubId, revision, platformMode, loadPlatformPlayers]);

  const clubFilterOptions = useMemo(() => {
    if (!platformMode) {
      return [];
    }

    const registry = new Map();
    for (const club of clubs || loadClubs()) {
      if (!club?.isDefault) {
        registry.set(club.id, club.name);
      }
    }

    for (const player of players) {
      if (player.sourceClubId && !registry.has(player.sourceClubId)) {
        registry.set(player.sourceClubId, player.clubName || player.sourceClubId);
      }
    }

    return Array.from(registry.entries()).map(([id, name]) => ({ id, name }));
  }, [clubs, platformMode, players]);

  const scopedPlayers = useMemo(() => {
    if (!platformMode) {
      return players;
    }

    return players.filter((player) => {
      if (clubFilter !== "all") {
        const sourceClubId = player.sourceClubId || player.clubId || null;
        if (sourceClubId !== clubFilter) {
          return false;
        }
      }

      if (linkFilter === "linked") {
        return player.linkStatus !== PLATFORM_ATHLETE_LINK_STATUS.ACCOUNT_ONLY;
      }

      if (linkFilter === "account_only") {
        return player.linkStatus === PLATFORM_ATHLETE_LINK_STATUS.ACCOUNT_ONLY;
      }

      return true;
    });
  }, [clubFilter, linkFilter, platformMode, players]);

  const activeClubPlayers = useMemo(() => {
    if (!platformMode) {
      return players;
    }

    return loadPlayersForClub(activeClubId);
  }, [activeClubId, platformMode, revision]);

  const canManagePlayer = (player) => {
    if (!canManagePlayers) {
      return false;
    }

    if (!platformMode) {
      return true;
    }

    if (player.linkStatus === PLATFORM_ATHLETE_LINK_STATUS.ACCOUNT_ONLY) {
      return false;
    }

    return String(player.sourceClubId || "") === String(activeClubId || "");
  };

  const checkedInIds = useMemo(
    () => getTodayCheckedInPlayerIds(activeClubId),
    [activeClubId, revision, players]
  );

  const stats = useMemo(
    () => computePlayerDashboardStats(scopedPlayers, platformMode ? null : activeClubId),
    [scopedPlayers, activeClubId, platformMode]
  );

  const filteredPlayers = useMemo(() => {
    const filtered = filterPlayers(scopedPlayers, {
      search,
      genderFilter,
      levelRange,
      statusFilter,
      checkedInIds,
    });
    return sortPlayers(filtered, "name", "asc");
  }, [scopedPlayers, search, genderFilter, levelRange, statusFilter, checkedInIds]);

  const savePlayers = (updatedPlayers) => {
    if (platformMode) {
      savePlayersForClub(updatedPlayers, activeClubId);
      void loadPlatformPlayers();
      return;
    }

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
    const level = Number(form.level);
    const baseData = {
      name,
      gender: form.gender,
      phone: form.phone.trim(),
    };

    const updatedPlayers = editingPlayer
      ? activeClubPlayers.map((player) =>
          player.id === editingPlayer.id ? { ...player, ...baseData } : player
        )
      : [
          ...activeClubPlayers,
          setInitialSkillLevel(
            { id: Date.now(), ...baseData },
            level,
            new Date().toISOString()
          ),
        ];

    savePlayers(updatedPlayers);
    setEditingPlayer(null);
    setForm(defaultPlayerForm);
    setOpen(false);
  };

  const handleDelete = () => {
    if (!deletePlayer) return;
    savePlayers(activeClubPlayers.filter((player) => player.id !== deletePlayer.id));
    setDeletePlayer(null);
  };

  const handleLockPlayer = (player) => {
    const updated = activeClubPlayers.map((p) =>
      p.id === player.id
        ? { ...p, status: "archived", active: false }
        : p
    );
    savePlayers(updated);
  };

  const clearFilters = () => {
    setGenderFilter("all");
    setLevelRange([2.0, 6.5]);
    setStatusFilter("all");
    setSearch("");
    setClubFilter("all");
    setLinkFilter("all");
  };

  const contextLine = platformMode
    ? "Toàn hệ thống"
    : activeClub?.name
      ? `CLB ${activeClub.name}`
      : undefined;

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
        title={platformMode ? "Vận động viên toàn hệ thống" : "Quản lý người chơi"}
        description={
          platformMode
            ? "Xem mọi VĐV đã đăng ký tài khoản và VĐV trong danh sách CLB trên hệ thống."
            : "Theo dõi trình độ, giới tính, trạng thái tham gia và dữ liệu để AI xếp sân cân bằng."
        }
        contextLine={contextLine}
        action={headerActions}
      />

      {platformMode && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Chế độ toàn hệ thống — hiển thị mọi VĐV đã đăng ký và VĐV trong CLB. Danh sách CLB
          phụ thuộc dữ liệu đã đồng bộ trên thiết bị này; tài khoản Supabase vẫn hiển thị khi có
          quyền truy vấn.
        </Alert>
      )}

      {platformWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {platformWarning}
        </Alert>
      )}

      {platformLoading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Đang tải danh sách VĐV toàn hệ thống...
        </Typography>
      )}

      <PlayerStats stats={stats} />

      {platformMode && (
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            select
            label="CLB"
            size="small"
            value={clubFilter}
            onChange={(event) => setClubFilter(event.target.value)}
            sx={{ minWidth: { md: 220 } }}
          >
            <MenuItem value="all">Tất cả CLB</MenuItem>
            {clubFilterOptions.map((club) => (
              <MenuItem key={club.id} value={club.id}>
                {club.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Liên kết"
            size="small"
            value={linkFilter}
            onChange={(event) => setLinkFilter(event.target.value)}
            sx={{ minWidth: { md: 220 } }}
          >
            <MenuItem value="all">Tất cả</MenuItem>
            <MenuItem value="linked">Đã gắn CLB</MenuItem>
            <MenuItem value="account_only">Chỉ có tài khoản</MenuItem>
          </TextField>
        </Stack>
      )}

      <PlayerFilters
        search={search}
        onSearchChange={setSearch}
        genderFilter={genderFilter}
        onGenderFilterChange={setGenderFilter}
        levelRange={levelRange}
        onLevelRangeChange={setLevelRange}
        showLevelFilter={canViewClubSkillLevels}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        filteredCount={filteredPlayers.length}
        totalCount={scopedPlayers.length}
        onClearFilters={clearFilters}
      />

      <Grid container spacing={TOURNAMENT_LAYOUT.gridSpacing}>
        {filteredPlayers.map((player) => (
          <Grid key={player.id} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
            <PlayerCard
              player={player}
              clubId={platformMode ? player.sourceClubId || activeClubId : activeClubId}
              players={scopedPlayers}
              checkedInIds={checkedInIds}
              canViewSkillLevel={canViewPlayerSkill(player.id)}
              showPlatformMeta={platformMode}
              onEdit={canManagePlayer(player) ? openEditDialog : undefined}
              onDelete={canManagePlayer(player) ? setDeletePlayer : undefined}
              onLock={canManagePlayer(player) ? handleLockPlayer : undefined}
            />
          </Grid>
        ))}
      </Grid>

      {filteredPlayers.length === 0 && (
        <Box sx={{ mt: TOURNAMENT_LAYOUT.sectionGap }}>
          <TournamentEmptyState
            icon={GroupsOutlinedIcon}
            title={players.length === 0 ? "Chưa có vận động viên" : "Không tìm thấy người chơi"}
            description={
              players.length === 0
                ? platformMode
                  ? "Chưa có VĐV nào trong hệ thống hoặc chưa tải được dữ liệu."
                  : "Thêm người chơi mới để bắt đầu."
                : "Thử đổi bộ lọc hoặc thêm người chơi mới."
            }
          />
        </Box>
      )}

      <PlayerImportExportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        items={platformMode ? activeClubPlayers : players}
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
            {editingPlayer ? (
              <Alert severity="info">
                Điểm trình độ đã khóa sau lần tạo. VĐV có thể gửi yêu cầu thay đổi qua hồ sơ cá
                nhân; Admin sẽ duyệt.
              </Alert>
            ) : (
              <>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle2" fontWeight={900}>
                    Điểm trình độ (chỉ nhập một lần)
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
                  min={2.0}
                  max={6.5}
                  step={0.5}
                  valueLabelDisplay="auto"
                  onChange={(_, v) => updateForm("level", v)}
                />
              </>
            )}
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
