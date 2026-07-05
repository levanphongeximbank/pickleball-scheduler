import { useMemo, useState } from "react";
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

import {
  computeTeamRosterStats,
  findPlayerTeam,
  getTeamRosterWarnings,
  getVisibleTeams,
} from "../../features/team-tournament/engines/teamRosterEngine.js";
import {
  addPlayerToTeamRoster,
  assignCaptainToTeam,
  assignDeputiesToTeam,
  createTeamInTournament,
  removePlayerFromTeamRoster,
  updateTeamDetails,
} from "../../features/team-tournament/services/teamTournamentService.js";

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
  players,
  clubPlayers,
  canManage,
  clubId,
  tournamentId,
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

  const teamPlayers = useMemo(
    () =>
      team.playerIds
        .map((playerId) => clubPlayers.find((player) => String(player.id) === String(playerId)))
        .filter(Boolean),
    [clubPlayers, team.playerIds]
  );

  const stats = useMemo(() => computeTeamRosterStats(team, clubPlayers), [team, clubPlayers]);
  const warnings = useMemo(
    () => getTeamRosterWarnings(team, teamData, clubPlayers),
    [team, teamData, clubPlayers]
  );

  const availablePlayers = useMemo(() => {
    const allowCrossTeam = teamData.settings?.allowPlayerCrossTeam === true;
    return clubPlayers.filter((player) => {
      const playerId = String(player.id);
      if (team.playerIds.includes(playerId)) {
        return false;
      }
      if (allowCrossTeam) {
        return true;
      }
      return !findPlayerTeam(teamData, playerId);
    });
  }, [clubPlayers, team.playerIds, teamData]);

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
        </Stack>

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

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Autocomplete
                options={availablePlayers}
                value={selectedPlayer}
                onChange={(_, value) => setSelectedPlayer(value)}
                getOptionLabel={(option) => playerLabel(option)}
                renderInput={(params) => <TextField {...params} label="Thêm VĐV vào đội" />}
                sx={{ flex: 1 }}
              />
              <Button startIcon={<PersonAddIcon />} variant="contained" onClick={handleAddPlayer}>
                Thêm
              </Button>
            </Stack>

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
  teamData,
  clubPlayers = [],
  canManage = false,
  canViewAll = false,
  viewerPlayerId = null,
  onUpdated,
  onError,
  onMessage,
}) {
  const [teamName, setTeamName] = useState("");

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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            label="Tên đội mới"
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={handleCreateTeam}>
            Tạo đội
          </Button>
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
            players={clubPlayers}
            clubPlayers={clubPlayers}
            canManage={canManage}
            clubId={clubId}
            tournamentId={tournamentId}
            onUpdated={onUpdated}
            onError={onError}
            onMessage={onMessage}
          />
        ))
      )}
    </Stack>
  );
}
