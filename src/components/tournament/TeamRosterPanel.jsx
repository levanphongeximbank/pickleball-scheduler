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
  findPlayerTeamInPool,
  getTeamRosterWarnings,
  getVisibleTeams,
} from "../../features/team-tournament/engines/teamRosterEngine.js";
import {
  ROSTER_HYDRATION_STATUS,
  ROSTER_LOADING_MESSAGE,
  collectHydratedMemberKeys,
  computeHydratedRosterStats,
  formatHydratedMemberLabel,
  hydrateTeamRoster,
} from "../../features/team-tournament/engines/teamRosterHydration.js";
import { isMlpFormat } from "../../features/team-tournament/engines/mlpPresetEngine.js";
import {
  addPlayerToTeamRoster,
  applyAiGeneratedTeamsToTournament,
  assignCaptainToTeam,
  assignDeputiesToTeam,
  createTeamInTournament,
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
  const ratingLabel =
    player.ratingLabel ||
    (player.ratingValue != null
      ? String(player.ratingValue)
      : player.rating != null && player.rating !== ""
        ? String(player.rating)
        : "");
  const rating = ratingLabel ? ` · ${ratingLabel}` : "";
  return `${player.name || player.displayName || "VĐV"}${gender}${rating}`;
}

function memberLabel(member) {
  return formatHydratedMemberLabel(member);
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
  athletePoolLoading = false,
  athletePoolError = null,
  setupReady = true,
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

  const athletePool = useMemo(
    () => [...allTenantPlayers, ...clubPlayers],
    [allTenantPlayers, clubPlayers]
  );

  const hydratedRoster = useMemo(
    () =>
      hydrateTeamRoster({
        team,
        athletePool,
        setupReady,
        athletePoolLoading,
        athletePoolError,
      }),
    [team, athletePool, setupReady, athletePoolLoading, athletePoolError]
  );

  const rosterStatus = hydratedRoster.status || ROSTER_HYDRATION_STATUS.READY;
  const rosterLoading = rosterStatus === ROSTER_HYDRATION_STATUS.LOADING;
  const teamMembers = rosterLoading
    ? []
    : hydratedRoster.members.filter((member) => !member.pending);
  const assignedMemberKeys = useMemo(
    () => collectHydratedMemberKeys(hydratedRoster),
    [hydratedRoster]
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
    () => computeHydratedRosterStats(hydratedRoster),
    [hydratedRoster]
  );
  const warnings = useMemo(() => {
    if (rosterLoading) return [];
    return getTeamRosterWarnings(team, teamData, athletePool);
  }, [rosterLoading, team, teamData, athletePool]);
  const mlpRoster = isMlpFormat(teamData);

  const availablePlayers = useMemo(() => {
    const allowCrossTeam = teamData.settings?.allowPlayerCrossTeam === true;
    return pickerPlayers.filter((player) => {
      const playerId = String(player.id);
      const athleteId = String(player.athleteId || player.pairingIdentityId || "");
      if (
        assignedMemberKeys.has(playerId) ||
        (athleteId && assignedMemberKeys.has(athleteId))
      ) {
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
      return !findPlayerTeamInPool(teamData, playerId, athletePool);
    });
  }, [pickerPlayers, assignedMemberKeys, teamData, genderFilter, athletePool]);

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
          {rosterLoading ? (
            <Chip size="small" label="Đang tải VĐV…" />
          ) : (
            <>
              <Chip size="small" color="info" label={`${stats.males} nam`} />
              <Chip size="small" color="secondary" label={`${stats.females} nữ`} />
            </>
          )}
          {mlpRoster ? (
            <Chip size="small" color="success" label="MLP 4 người" variant="outlined" />
          ) : null}
        </Stack>

        {mlpRoster ? (
          <Alert severity="info">
            MLP: tối đa 4 VĐV (2 nam + 2 nữ). Mỗi VĐV đánh 2 trận/tie.
          </Alert>
        ) : null}

        {rosterLoading ? (
          <Alert severity="info">{ROSTER_LOADING_MESSAGE}</Alert>
        ) : null}

        {!rosterLoading && hydratedRoster.unresolvedCount > 0 ? (
          <Alert severity="warning">
            {hydratedRoster.unresolvedCount} VĐV thiếu identity canonical
            {hydratedRoster.diagnostics.length > 0
              ? ` (${hydratedRoster.diagnostics.slice(0, 3).join(", ")})`
              : ""}
            . Không dùng roster blob làm nguồn thay thế.
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
                  {teamMembers.map((member) => (
                    <MenuItem
                      key={member.storedPlayerId}
                      value={String(member.storedPlayerId)}
                    >
                      {memberLabel(member)}
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
                    .map((id) =>
                      memberLabel(
                        teamMembers.find(
                          (member) => String(member.storedPlayerId) === String(id)
                        )
                      )
                    )
                    .join(", ")
                }
              >
                {teamMembers
                  .filter(
                    (member) => String(member.storedPlayerId) !== String(captainId)
                  )
                  .map((member) => (
                    <MenuItem
                      key={member.storedPlayerId}
                      value={String(member.storedPlayerId)}
                    >
                      {memberLabel(member)}
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
            Đội trưởng:{" "}
            {teamMembers.find((member) => member.isCaptain)?.displayName ||
              team.captainPlayerId ||
              "Chưa gán"}
            {teamMembers.some((member) => member.isDeputy)
              ? ` · Đội phó: ${teamMembers
                  .filter((member) => member.isDeputy)
                  .map((member) => member.displayName)
                  .join(", ")}`
              : ""}
          </Typography>
        )}

        <Divider />

        <Typography variant="subtitle2">Danh sách VĐV</Typography>
        {rosterLoading ? (
          <Typography variant="body2" color="text.secondary">
            {ROSTER_LOADING_MESSAGE}
          </Typography>
        ) : teamMembers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa có VĐV trong đội.
          </Typography>
        ) : (
          teamMembers.map((member) => (
            <Stack
              key={member.storedPlayerId}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ py: 0.5 }}
            >
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography>{memberLabel(member)}</Typography>
                {member.isCaptain ? (
                  <Chip size="small" color="primary" label="Đội trưởng" />
                ) : null}
                {member.isDeputy ? <Chip size="small" label="Đội phó" /> : null}
                {!member.resolved ? (
                  <Chip
                    size="small"
                    color="warning"
                    label={member.diagnostic || "thiếu identity"}
                  />
                ) : null}
              </Stack>
              {canManage ? (
                <IconButton
                  size="small"
                  color="error"
                  aria-label="Xóa VĐV"
                  onClick={() => handleRemovePlayer(member.storedPlayerId)}
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
  athletePoolLoading = false,
  athletePoolError = null,
  setupReady = true,
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
            athletePoolLoading={athletePoolLoading}
            athletePoolError={athletePoolError}
            setupReady={setupReady}
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
          const result = await applyAiGeneratedTeamsToTournament(
            clubId,
            tournamentId,
            nextTeamData
          );
          if (!result.ok) {
            onError(
              result.error ||
                "Không áp dụng được ghép đội — cloud/local chưa ghi nhận."
            );
            return { ok: false, ...result };
          }

          // 1) Await cloud setup reload.
          const reloaded =
            typeof onUpdated === "function" ? await onUpdated() : null;
          const teamsAfterReload =
            reloaded?.teamData?.teams ||
            reloaded?.tournament?.teamData?.teams ||
            result.teamData?.teams ||
            result.tournament?.teamData?.teams ||
            [];

          if (!Array.isArray(teamsAfterReload) || teamsAfterReload.length === 0) {
            onError(
              "Đã lưu đội nhưng danh sách trống sau khi tải lại — không báo thành công."
            );
            return { ok: false, code: "RELOAD_EMPTY_TEAMS" };
          }

          const expectedIds = new Set(
            (result.teamData?.teams || []).map((team) => String(team.id))
          );
          const visibleExpected = teamsAfterReload.filter((team) =>
            expectedIds.has(String(team.id))
          );
          if (expectedIds.size > 0 && visibleExpected.length === 0) {
            onError(
              "Đã lưu đội nhưng UI không đọc được đội vừa tạo sau khi tải lại."
            );
            return { ok: false, code: "RELOAD_MISSING_TEAMS" };
          }

          // 2) Await canonical athlete pool refresh before claiming full completion.
          const scopeMode = tenantId
            ? TEAM_TOURNAMENT_ATHLETE_SCOPE.TENANT
            : TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB;
          const poolResult = await listAvailableAthletes({
            tournamentId,
            clubId,
            tenantId,
            scopeMode,
            callerName: "TeamRosterPanel.aiPairing.afterPersist",
          });

          if (!poolResult.ok) {
            onMessage?.(
              `Đã lưu ${teamsAfterReload.length} đội. ${ROSTER_LOADING_MESSAGE}`
            );
            return {
              ok: true,
              teamCount: teamsAfterReload.length,
              tournament: result.tournament,
              hydrationStatus: ROSTER_HYDRATION_STATUS.LOADING,
              code: "HYDRATION_POOL_PENDING",
            };
          }

          const poolAthletes = poolResult.athletes || [];
          const sampleTeam = teamsAfterReload[0];
          const hydratedSample = hydrateTeamRoster({
            team: sampleTeam,
            athletePool: poolAthletes,
            setupReady: true,
            athletePoolLoading: false,
            athletePoolError: null,
          });

          onMessage?.(
            `Đã AI ghép đội và tải thông tin VĐV (${teamsAfterReload.length} đội).`
          );
          return {
            ok: true,
            teamCount: teamsAfterReload.length,
            tournament: result.tournament,
            hydrationStatus: hydratedSample.status,
            unresolvedCount: hydratedSample.unresolvedCount,
          };
        }}
      />
    </Stack>
  );
}
