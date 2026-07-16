import { useEffect, useMemo, useState } from "react";
import {
  listAvailableAthletes,
  TEAM_TOURNAMENT_ATHLETE_SCOPE,
} from "../../features/team-tournament/services/teamTournamentAthletePoolService.js";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import SaveIcon from "@mui/icons-material/Save";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import AddIcon from "@mui/icons-material/Add";

import { getPlayerGenderKey } from "../../models/player.js";
import {
  computeTeamRosterStats,
  findPlayerTeam,
  getTeamRosterWarnings,
  getVisibleTeams,
} from "../../features/team-tournament/engines/teamRosterEngine.js";
import { isMlpFormat } from "../../features/team-tournament/engines/mlpPresetEngine.js";
import {
  addPlayerToTeamRoster,
  assignCaptainToTeam,
  assignDeputiesToTeam,
  createTeamInTournament,
  patchTeamTournament,
  removePlayerFromTeamRoster,
  updateTeamDetails,
} from "../../features/team-tournament/services/teamTournamentService.js";
import TeamAiPairingDialog from "../tournament/team/TeamAiPairingDialog.jsx";
import TournamentPlayerQuickAddDialog from "./TournamentPlayerQuickAddDialog.jsx";
import ExistingTeamClonePanel from "./ExistingTeamClonePanel.jsx";
import TeamSubstitutionPanel from "./TeamSubstitutionPanel.jsx";
import { FORMAT_PRESET } from "../../features/team-tournament/constants.js";
import { COMPETITION_CLASS } from "../../features/private-pairing-rules/index.js";
import { getAuthOptions } from "../../auth/guardAction.js";
import { getPermissionsForRole } from "../../features/identity/matrix/rolePermissions.js";

const ALL_CLUBS_FILTER = "__all__";

const GENDER_FILTER_OPTIONS = [
  { value: "all", label: "Tất cả giới tính" },
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
];

function playerLabel(player) {
  if (!player) {
    return "";
  }
  const gender = player.gender ? ` · ${player.gender}` : "";
  return `${player.name || player.id}${gender}`;
}

function TeamCard({
  team,
  teamData,
  clubPlayers,
  allTenantPlayers = [],
  clubs = [],
  canManage,
  clubId,
  tournamentId,
  tenantId = null,
  defaultClubName = "",
  onUpdated,
  onError,
  onMessage,
}) {
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color || "#7c3aed");
  const [logoUrl, setLogoUrl] = useState(team.logoUrl || "");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [captainId, setCaptainId] = useState(team.captainPlayerId || "");
  const [deputyIds, setDeputyIds] = useState(team.deputyPlayerIds || []);
  const [sourceClubFilter, setSourceClubFilter] = useState(ALL_CLUBS_FILTER);
  const [genderFilter, setGenderFilter] = useState("all");
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const playerById = useMemo(() => {
    const map = new Map();
    [...allTenantPlayers, ...clubPlayers].forEach((player) => {
      map.set(String(player.id), player);
    });
    return map;
  }, [allTenantPlayers, clubPlayers]);

  const rosterPlayers = useMemo(
    () => [...playerById.values()],
    [playerById]
  );

  const teamPlayers = useMemo(
    () =>
      team.playerIds
        .map((playerId) => playerById.get(String(playerId)))
        .filter(Boolean),
    [playerById, team.playerIds]
  );

  const [filteredClubPlayers, setFilteredClubPlayers] = useState([]);
  const [filteredClubError, setFilteredClubError] = useState(null);
  const [filteredClubEmptyMessage, setFilteredClubEmptyMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (sourceClubFilter === ALL_CLUBS_FILTER || !sourceClubFilter) {
      setFilteredClubPlayers([]);
      setFilteredClubError(null);
      setFilteredClubEmptyMessage(null);
      return undefined;
    }
    listAvailableAthletes({
      tournamentId,
      clubId: sourceClubFilter,
      tenantId,
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
      callerName: "TeamRosterPanel.TeamCard.clubFilter",
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setFilteredClubPlayers([]);
        setFilteredClubEmptyMessage(null);
        setFilteredClubError(
          result.message ||
            "Không tải được danh sách VĐV CLB. Không dùng roster blob."
        );
        return;
      }
      setFilteredClubPlayers(result.athletes || []);
      setFilteredClubError(null);
      setFilteredClubEmptyMessage(result.empty ? result.emptyMessage || null : null);
    });
    return () => {
      cancelled = true;
    };
  }, [sourceClubFilter, tournamentId, tenantId]);

  const pickerPlayers = useMemo(() => {
    if (sourceClubFilter === ALL_CLUBS_FILTER) {
      return allTenantPlayers.length > 0 ? allTenantPlayers : clubPlayers;
    }
    return filteredClubPlayers;
  }, [sourceClubFilter, allTenantPlayers, clubPlayers, filteredClubPlayers]);

  const stats = useMemo(
    () => computeTeamRosterStats(team, rosterPlayers),
    [team, rosterPlayers]
  );
  const warnings = useMemo(
    () => getTeamRosterWarnings(team, teamData, rosterPlayers),
    [team, teamData, rosterPlayers]
  );
  const mlpRoster = isMlpFormat(teamData);

  const availablePlayers = useMemo(() => {
    const allowCrossTeam = teamData.settings?.allowPlayerCrossTeam === true;
    return pickerPlayers.filter((player) => {
      const playerId = String(player.id);
      if (team.playerIds.includes(playerId)) {
        return false;
      }
      if (genderFilter === "male" && getPlayerGenderKey(player.gender) !== "male") {
        return false;
      }
      if (genderFilter === "female" && getPlayerGenderKey(player.gender) !== "female") {
        return false;
      }
      if (allowCrossTeam) {
        return true;
      }
      return !findPlayerTeam(teamData, playerId);
    });
  }, [pickerPlayers, team.playerIds, teamData, genderFilter]);

  const availableEmptyText = useMemo(() => {
    if (filteredClubError) return filteredClubError;
    if (filteredClubEmptyMessage) return filteredClubEmptyMessage;
    if (availablePlayers.length === 0) {
      return "Không có VĐV phù hợp — xem diagnostics trên trang giải.";
    }
    return "Không có VĐV phù hợp";
  }, [filteredClubError, filteredClubEmptyMessage, availablePlayers.length]);

  async function handleResult(action, successMessage) {
    const result = await action;
    if (!result?.ok) {
      onError(result?.error || "Thao tác thất bại.");
      return;
    }
    onMessage(successMessage);
    onUpdated();
  }

  function handleSaveProfile() {
    handleResult(
      updateTeamDetails(clubId, tournamentId, {
        teamId: team.id,
        patch: { name, color, logoUrl },
      }),
      `Đã cập nhật đội ${name}.`
    );
  }

  function handleAddPlayer() {
    if (!selectedPlayer) {
      onError("Chọn VĐV để thêm vào đội.");
      return;
    }
    handleResult(
      addPlayerToTeamRoster(clubId, tournamentId, {
        teamId: team.id,
        playerId: selectedPlayer.id,
      }),
      `Đã thêm ${selectedPlayer.name} vào ${team.name}.`
    );
    setSelectedPlayer(null);
  }

  async function handleQuickAddSaved(player) {
    if (!player?.id) {
      return;
    }

    onUpdated();

    const result = await addPlayerToTeamRoster(clubId, tournamentId, {
      teamId: team.id,
      playerId: player.id,
    });

    if (!result?.ok) {
      onError(result?.error || "Không thêm được VĐV vào đội.");
      return;
    }

    onMessage(`Đã thêm ${player.name} vào ${team.name}.`);
    onUpdated();
  }

  function handleRemovePlayer(playerId) {
    handleResult(
      removePlayerFromTeamRoster(clubId, tournamentId, {
        teamId: team.id,
        playerId,
      }),
      "Đã xóa VĐV khỏi đội."
    );
  }

  function handleAssignCaptain() {
    handleResult(
      assignCaptainToTeam(clubId, tournamentId, {
        teamId: team.id,
        playerId: captainId,
      }),
      "Đã gán đội trưởng."
    );
  }

  function handleAssignDeputies() {
    handleResult(
      assignDeputiesToTeam(clubId, tournamentId, {
        teamId: team.id,
        deputyPlayerIds: deputyIds,
      }),
      "Đã gán đội phó."
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Typography variant="h6" fontWeight={700}>
            {team.name}
          </Typography>
          <Chip size="small" label={`${stats.total} VĐV`} />
          <Chip size="small" color="info" label={`${stats.males} nam`} />
          <Chip size="small" color="secondary" label={`${stats.females} nữ`} />
          {mlpRoster ? (
            <Chip size="small" color="success" label="MLP 4 người" variant="outlined" />
          ) : null}
        </Stack>

        {mlpRoster ? (
          <Alert severity="info">
            MLP: tối đa 4 VĐV (2 nam + 2 nữ). Mỗi VĐV đánh 2 trận/tie.
          </Alert>
        ) : null}

        {filteredClubError ? <Alert severity="error">{filteredClubError}</Alert> : null}
        {!filteredClubError && filteredClubEmptyMessage ? (
          <Alert severity="warning">{filteredClubEmptyMessage}</Alert>
        ) : null}

        {warnings.map((warning) => (
          <Alert key={warning} severity="warning">
            {warning}
          </Alert>
        ))}

        {filteredClubError ? (
          <Alert severity="error">{filteredClubError}</Alert>
        ) : null}

        {canManage ? (
          <>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField
                label="Tên đội"
                value={name}
                onChange={(event) => setName(event.target.value)}
                fullWidth
              />
              <TextField
                label="Màu đội"
                type="color"
                value={color || "#7c3aed"}
                onChange={(event) => setColor(event.target.value)}
                sx={{ width: { xs: "100%", md: 120 } }}
              />
              <TextField
                label="Logo URL"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                fullWidth
              />
              <Button startIcon={<SaveIcon />} variant="outlined" onClick={handleSaveProfile}>
                Lưu
              </Button>
            </Stack>

            {logoUrl ? (
              <Box
                component="img"
                src={logoUrl}
                alt={team.name}
                sx={{ width: 48, height: 48, objectFit: "contain", borderRadius: 1 }}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : null}

            <Divider />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <FormControl fullWidth size="small">
                <InputLabel id={`club-filter-${team.id}`}>Câu lạc bộ</InputLabel>
                <Select
                  labelId={`club-filter-${team.id}`}
                  label="Câu lạc bộ"
                  value={sourceClubFilter}
                  onChange={(event) => {
                    setSourceClubFilter(event.target.value);
                    setSelectedPlayer(null);
                  }}
                >
                  <MenuItem value={ALL_CLUBS_FILTER}>Toàn bộ CLB</MenuItem>
                  {clubs.map((club) => (
                    <MenuItem key={club.id} value={club.id}>
                      {club.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id={`gender-filter-${team.id}`}>Giới tính</InputLabel>
                <Select
                  labelId={`gender-filter-${team.id}`}
                  label="Giới tính"
                  value={genderFilter}
                  onChange={(event) => {
                    setGenderFilter(event.target.value);
                    setSelectedPlayer(null);
                  }}
                >
                  {GENDER_FILTER_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Autocomplete
                options={availablePlayers}
                value={selectedPlayer}
                onChange={(_, value) => setSelectedPlayer(value)}
                getOptionLabel={(option) => playerLabel(option)}
                renderInput={(params) => <TextField {...params} label="Thêm VĐV vào đội" />}
                sx={{ flex: 1 }}
                noOptionsText={availableEmptyText}
              />
              <Button
                startIcon={<PersonAddIcon />}
                variant="contained"
                onClick={handleAddPlayer}
                disabled={!selectedPlayer}
              >
                Thêm
              </Button>
              <Button
                startIcon={<AddIcon />}
                variant="outlined"
                onClick={() => setQuickAddOpen(true)}
                disabled={!clubId}
              >
                Thêm mới
              </Button>
            </Stack>

            <TournamentPlayerQuickAddDialog
              open={quickAddOpen}
              onClose={() => setQuickAddOpen(false)}
              hostClubId={clubId}
              defaultClubName={defaultClubName}
              onSaved={handleQuickAddSaved}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <FormControl fullWidth>
                <InputLabel>Đội trưởng</InputLabel>
                <Select
                  label="Đội trưởng"
                  value={captainId}
                  onChange={(event) => setCaptainId(event.target.value)}
                >
                  <MenuItem value="">
                    <em>Chưa chọn</em>
                  </MenuItem>
                  {teamPlayers.map((player) => (
                    <MenuItem key={player.id} value={String(player.id)}>
                      {playerLabel(player)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="outlined" onClick={handleAssignCaptain} disabled={!captainId}>
                Gán đội trưởng
              </Button>
            </Stack>

            <FormControl fullWidth>
              <InputLabel>Đội phó</InputLabel>
              <Select
                multiple
                label="Đội phó"
                value={deputyIds}
                onChange={(event) => setDeputyIds(event.target.value)}
                renderValue={(selected) =>
                  selected
                    .map((id) => playerLabel(teamPlayers.find((player) => String(player.id) === String(id))))
                    .join(", ")
                }
              >
                {teamPlayers
                  .filter((player) => String(player.id) !== String(captainId))
                  .map((player) => (
                    <MenuItem key={player.id} value={String(player.id)}>
                      {playerLabel(player)}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={handleAssignDeputies}>
              Lưu đội phó
            </Button>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Đội trưởng: {team.captainPlayerId || "Chưa gán"}
            {(team.deputyPlayerIds || []).length > 0
              ? ` · Đội phó: ${team.deputyPlayerIds.join(", ")}`
              : ""}
          </Typography>
        )}

        <Divider />

        <Typography variant="subtitle2">Danh sách VĐV</Typography>
        {teamPlayers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa có VĐV trong đội.
          </Typography>
        ) : (
          teamPlayers.map((player) => (
            <Stack
              key={player.id}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ py: 0.5 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography>{playerLabel(player)}</Typography>
                {String(team.captainPlayerId) === String(player.id) ? (
                  <Chip size="small" color="primary" label="Đội trưởng" />
                ) : null}
                {(team.deputyPlayerIds || []).includes(String(player.id)) ? (
                  <Chip size="small" label="Đội phó" />
                ) : null}
              </Stack>
              {canManage ? (
                <IconButton
                  size="small"
                  color="error"
                  aria-label="Xóa VĐV"
                  onClick={() => handleRemovePlayer(player.id)}
                >
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              ) : null}
            </Stack>
          ))
        )}
      </Stack>
    </Paper>
  );
}

export default function TeamRosterPanel({
  clubId,
  tournamentId,
  tournament = null,
  teamData,
  clubPlayers = [],
  allTenantPlayers = [],
  clubs = [],
  tenantId = null,
  clubFromQuery = null,
  activeClubId = null,
  canManage = false,
  canViewAll = false,
  viewerPlayerId = null,
  onUpdated,
  onError,
  onMessage,
}) {
  const [teamName, setTeamName] = useState("");
  const [aiPairingOpen, setAiPairingOpen] = useState(false);
  const [mlpAthletePool, setMlpAthletePool] = useState([]);
  const [mlpPoolState, setMlpPoolState] = useState({
    status: "idle",
    message: null,
  });
  const [mlpDiagnostics, setMlpDiagnostics] = useState(null);

  const permissions = useMemo(() => {
    const { user } = getAuthOptions();
    return getPermissionsForRole(user?.role || "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    // AI “Toàn bộ CLB” uses the same tenant pool as manual; fall back to club scope.
    const scopeMode = tenantId
      ? TEAM_TOURNAMENT_ATHLETE_SCOPE.TENANT
      : TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB;
    if (!clubId && scopeMode === TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB) {
      setMlpAthletePool([]);
      setMlpDiagnostics(null);
      setMlpPoolState({ status: "idle", message: null });
      return undefined;
    }

    setMlpPoolState({ status: "loading", message: null });
    (async () => {
      const result = await listAvailableAthletes({
        tournamentId,
        clubId,
        tenantId,
        scopeMode,
        callerName: "TeamRosterPanel.aiPairing",
      });
      if (cancelled) return;
      setMlpDiagnostics(result.diagnostics || null);
      if (!result.ok) {
        setMlpAthletePool([]);
        setMlpPoolState({
          status: "error",
          message:
            result.message ||
            "Không tải được Athlete canonical cho ghép đội. Không dùng roster blob.",
        });
        return;
      }
      const athletes = result.athletes || [];
      setMlpAthletePool(athletes);
      setMlpPoolState({
        status: result.empty || athletes.length === 0 ? "empty" : "ready",
        message: result.empty ? result.emptyMessage || result.message : null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [clubId, tournamentId, tenantId]);

  /** Shared unified pool for substitution + AI (same base IDs as manual). */
  const drawPlayerPool = useMemo(() => {
    const pool = new Map();
    [...allTenantPlayers, ...clubPlayers].forEach((player) => {
      if (player?.id) {
        pool.set(String(player.id), player);
      }
    });
    return [...pool.values()];
  }, [allTenantPlayers, clubPlayers]);

  const mlpPairingPool = useMemo(() => {
    if (mlpAthletePool.length > 0) return mlpAthletePool;
    return drawPlayerPool;
  }, [mlpAthletePool, drawPlayerPool]);

  const hostClubName = useMemo(
    () => clubs.find((club) => String(club.id) === String(clubId))?.name || "",
    [clubs, clubId]
  );

  const isMlp = teamData?.settings?.formatPreset === FORMAT_PRESET.MLP_4;

  const visibleTeams = useMemo(
    () =>
      getVisibleTeams(teamData, {
        canManage,
        canViewAll,
        viewerPlayerId: canManage ? null : viewerPlayerId,
      }),
    [teamData, canManage, canViewAll, viewerPlayerId]
  );

  async function handleResult(action, successMessage) {
    const result = await action;
    if (!result?.ok) {
      onError(result?.error || "Thao tác thất bại.");
      return false;
    }
    onMessage(successMessage);
    onUpdated();
    return true;
  }

  function handleCreateTeam() {
    const trimmed = teamName.trim();
    if (!trimmed) {
      onError("Nhập tên đội.");
      return;
    }

    void handleResult(
      createTeamInTournament(clubId, tournamentId, { name: trimmed }),
      `Đã tạo đội ${trimmed}.`
    ).then((ok) => {
      if (ok) {
        setTeamName("");
      }
    });
  }

  return (
    <Stack spacing={2}>
      {!canManage && viewerPlayerId && visibleTeams.length === 0 ? (
        <Alert severity="info">
          Bạn chỉ xem được đội mà mình là đội trưởng/đội phó.
        </Alert>
      ) : null}

      {canManage ? (
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
            <TextField
              label="Tên đội mới"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              fullWidth
              sx={{ flex: 1, minWidth: 200 }}
            />
            <Button
              variant="contained"
              onClick={handleCreateTeam}
              sx={{ minHeight: { xs: 44, md: 36 } }}
            >
              Tạo đội
            </Button>
            {isMlp ? (
              <Button
                variant="outlined"
                onClick={() => {
                  if (mlpPoolState.status === "error") {
                    onError?.(
                      mlpPoolState.message ||
                        "Không tải được Athlete canonical cho ghép đội."
                    );
                    return;
                  }
                  if (mlpPairingPool.length === 0) {
                    onError?.(
                      mlpPoolState.message ||
                        "Chưa có Athlete đủ điều kiện của CLB này để ghép đội MLP."
                    );
                    return;
                  }
                  setAiPairingOpen(true);
                }}
                sx={{ minHeight: { xs: 44, md: 36 } }}
              >
                AI ghép đội
              </Button>
            ) : null}
          </Stack>
          {isMlp && mlpPoolState.status === "error" ? (
            <Alert severity="error">{mlpPoolState.message}</Alert>
          ) : null}
          {isMlp && mlpPoolState.status === "empty" ? (
            <Alert severity="warning">
              {mlpPoolState.message ||
                "Chưa có Athlete đủ điều kiện của CLB này để ghép đội MLP."}
            </Alert>
          ) : null}
          {isMlp && mlpPoolState.status === "ready" ? (
            <Alert severity="info">
              Pool ghép đội MLP (unified): {mlpPairingPool.length} Athlete
              {mlpDiagnostics
                ? ` · source=${mlpDiagnostics.sourceCount} eligible=${mlpDiagnostics.eligibleCount} WRONG_SCOPE=${mlpDiagnostics.WRONG_SCOPE}`
                : ""}
            </Alert>
          ) : null}
          <ExistingTeamClonePanel
            clubId={clubId}
            targetTournamentId={tournamentId}
            permissions={permissions}
            dense
            onUpdated={onUpdated}
            onError={onError}
            onMessage={onMessage}
          />
          <TeamSubstitutionPanel
            clubId={clubId}
            tournamentId={tournamentId}
            teamData={teamData}
            players={drawPlayerPool}
            permissions={permissions}
            mode="btc"
            onUpdated={onUpdated}
            onError={onError}
            onMessage={onMessage}
          />
        </Stack>
      ) : null}

      {visibleTeams.length === 0 ? (
        <Typography color="text.secondary">Chưa có đội nào.</Typography>
      ) : (
        visibleTeams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            teamData={teamData}
            clubPlayers={clubPlayers}
            allTenantPlayers={allTenantPlayers}
            clubs={clubs}
            canManage={canManage}
            clubId={clubId}
            tournamentId={tournamentId}
            tenantId={tenantId}
            defaultClubName={hostClubName}
            onUpdated={onUpdated}
            onError={onError}
            onMessage={onMessage}
          />
        ))
      )}

      <TeamAiPairingDialog
        open={aiPairingOpen}
        onClose={() => setAiPairingOpen(false)}
        teamData={teamData}
        players={mlpPairingPool}
        clubs={clubs}
        clubId={clubId}
        tournamentId={tournamentId}
        tournament={tournament}
        tenantId={tenantId}
        clubFromQuery={clubFromQuery}
        activeClubId={activeClubId}
        competitionClass={COMPETITION_CLASS.INTERNAL}
        defaultClubName={hostClubName}
        onPlayersRefresh={onUpdated}
        onMessage={onMessage}
        onError={onError}
        onApply={async (nextTeamData) => {
          const result = await patchTeamTournament(clubId, tournamentId, {
            teamData: nextTeamData,
          });
          if (!result.ok) {
            onError(result.error || "Không áp dụng được ghép đội.");
            return;
          }
          onMessage?.("Đã AI ghép đội và lưu danh sách đội.");
          onUpdated?.();
        }}
      />
    </Stack>
  );
}
