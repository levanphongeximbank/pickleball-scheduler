import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../context/SeasonContext.jsx";
import { loadClubData } from "../../domain/clubStorage.js";
import {
  createLeagueRound,
  getTournamentsForRound,
  linkTournamentToRound,
  listLeagueRounds,
  listLeagueTournaments,
  setActiveLeagueRound,
  unlinkTournamentFromRound,
  updateLeagueRound,
} from "../../domain/leagueRoundService.js";
import { TOURNAMENT_MODE } from "../../models/tournament/index.js";
import { touchButtonSx } from "./mobileUi.js";

const MODE_LABELS = {
  [TOURNAMENT_MODE.DAILY_PLAY]: "Daily",
  [TOURNAMENT_MODE.INTERNAL_TOURNAMENT]: "Nội bộ",
  [TOURNAMENT_MODE.OFFICIAL_TOURNAMENT]: "Chính thức",
};

function resolveTournamentPath(tournament) {
  if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    return `/tournament/daily/${tournament.id}`;
  }
  if (tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return `/tournament/internal/${tournament.id}`;
  }
  if (tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
    return `/tournament/official/${tournament.id}`;
  }
  return "/tournament";
}

function RoundCard({
  round,
  isActive,
  tournaments,
  unassignedTournaments,
  onRename,
  onSetActive,
  onAssign,
  onUnlink,
}) {
  const navigate = useNavigate();
  const [draftName, setDraftName] = useState(round.name);
  const [assignTournamentId, setAssignTournamentId] = useState("");

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1.25}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            label="Tên vòng"
            value={draftName}
            sx={{ flex: 1 }}
            onChange={(event) => setDraftName(event.target.value)}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => onRename(round.id, draftName)}
            disabled={!draftName.trim() || draftName.trim() === round.name}
          >
            Lưu tên
          </Button>
          {!isActive ? (
            <Button size="small" variant="contained" onClick={() => onSetActive(round.id)}>
              Đặt vòng active
            </Button>
          ) : (
            <Chip size="small" color="success" label="Vòng đang active" />
          )}
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {(round.tournamentIds || []).length} giải trong vòng này
        </Typography>

        {tournaments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa có giải nào gắn vòng này.
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {tournaments.map((tournament) => (
              <Stack
                key={tournament.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "stretch", sm: "center" }}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight="medium" sx={{ wordBreak: "break-word" }}>
                    {tournament.name}
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      label={MODE_LABELS[tournament.mode] || tournament.mode}
                    />
                    <Chip size="small" variant="outlined" label={tournament.status} />
                  </Stack>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => navigate(resolveTournamentPath(tournament))}>
                    Mở
                  </Button>
                  <Button
                    size="small"
                    color="warning"
                    onClick={() => onUnlink(tournament.id)}
                  >
                    Gỡ
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}

        {unassignedTournaments.length > 0 ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <FormControl fullWidth size="small">
              <InputLabel>Gán giải vào vòng</InputLabel>
              <Select
                label="Gán giải vào vòng"
                value={assignTournamentId}
                onChange={(event) => setAssignTournamentId(event.target.value)}
              >
                <MenuItem value="">
                  <em>Chọn giải</em>
                </MenuItem>
                {unassignedTournaments.map((tournament) => (
                  <MenuItem key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              disabled={!assignTournamentId}
              sx={{ ...touchButtonSx, whiteSpace: "nowrap" }}
              onClick={() => {
                onAssign(round.id, assignTournamentId);
                setAssignTournamentId("");
              }}
            >
              Gán giải
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default function LeagueRoundManager({ onMessage }) {
  const { activeClubId, revision, refreshClubs } = useClub();
  const { seasons, leagues, activeSeason, activeLeague } = useSeasonLeague();
  const [seasonId, setSeasonId] = useState(activeSeason?.id || "");
  const [leagueId, setLeagueId] = useState(activeLeague?.id || "");
  const [newRoundName, setNewRoundName] = useState("");

  useEffect(() => {
    if (activeSeason?.id) {
      setSeasonId(activeSeason.id);
    }
  }, [activeSeason?.id]);

  useEffect(() => {
    if (activeLeague?.id) {
      setLeagueId(activeLeague.id);
    }
  }, [activeLeague?.id]);

  const clubData = useMemo(
    () => loadClubData(activeClubId),
    [activeClubId, revision]
  );

  const leaguesForSeason = useMemo(
    () => leagues.filter((league) => String(league.seasonId) === String(seasonId)),
    [leagues, seasonId]
  );

  const rounds = useMemo(
    () => listLeagueRounds(activeClubId, { seasonId, leagueId }),
    [activeClubId, seasonId, leagueId, revision]
  );

  const leagueTournaments = useMemo(
    () => listLeagueTournaments(activeClubId, { seasonId, leagueId }),
    [activeClubId, seasonId, leagueId, revision]
  );

  const unassignedTournaments = useMemo(
    () => leagueTournaments.filter((tournament) => !tournament.roundId),
    [leagueTournaments]
  );

  const activeRoundId = clubData.active?.roundSlot || "";

  const notify = (type, text) => {
    if (onMessage) {
      onMessage({ type, text });
    }
  };

  const handleSeasonChange = (nextSeasonId) => {
    setSeasonId(nextSeasonId);
    const nextLeagues = leagues.filter(
      (league) => String(league.seasonId) === String(nextSeasonId)
    );
    setLeagueId(nextLeagues[0]?.id || "");
  };

  const handleCreateRound = () => {
    const name = newRoundName.trim() || `Vòng ${rounds.length + 1}`;
    const result = createLeagueRound(activeClubId, {
      seasonId,
      leagueId,
      name,
    });

    if (!result.ok) {
      notify("error", result.error || "Không tạo được vòng.");
      return;
    }

    setNewRoundName("");
    refreshClubs();
    notify("success", `Đã tạo ${result.round.name}.`);
  };

  const handleRename = (roundId, name) => {
    const result = updateLeagueRound(activeClubId, roundId, { name: name.trim() });
    if (!result.ok) {
      notify("error", result.error || "Không đổi được tên vòng.");
      return;
    }
    refreshClubs();
    notify("success", "Đã cập nhật tên vòng.");
  };

  const handleSetActive = (roundId) => {
    const result = setActiveLeagueRound(activeClubId, roundId);
    if (!result.ok) {
      notify("error", result.error || "Không đặt được vòng active.");
      return;
    }
    refreshClubs();
    notify("success", "Đã đặt vòng active. Giải mới sẽ gắn vào vòng này.");
  };

  const handleAssign = (roundId, tournamentId) => {
    const result = linkTournamentToRound(activeClubId, tournamentId, roundId);
    if (!result.ok) {
      notify("error", result.error || "Không gán được giải.");
      return;
    }
    refreshClubs();
    notify("success", "Đã gán giải vào vòng.");
  };

  const handleUnlink = (tournamentId) => {
    const result = unlinkTournamentFromRound(activeClubId, tournamentId);
    if (!result.ok) {
      notify("error", result.error || "Không gỡ được giải.");
      return;
    }
    refreshClubs();
    notify("success", "Đã gỡ giải khỏi vòng.");
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Mỗi vòng mùa gom các giải V3.3. Giải mới tự gắn vào vòng đang active.
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Mùa giải</InputLabel>
          <Select
            label="Mùa giải"
            value={seasonId}
            onChange={(event) => handleSeasonChange(event.target.value)}
          >
            {seasons.map((season) => (
              <MenuItem key={season.id} value={season.id}>
                {season.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Giải / League</InputLabel>
          <Select
            label="Giải / League"
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
          >
            {leaguesForSeason.map((league) => (
              <MenuItem key={league.id} value={league.id}>
                {league.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          size="small"
          label="Tên vòng mới"
          placeholder={`Vòng ${rounds.length + 1}`}
          value={newRoundName}
          sx={{ flex: 1 }}
          onChange={(event) => setNewRoundName(event.target.value)}
        />
        <Button variant="contained" sx={touchButtonSx} onClick={handleCreateRound}>
          Tạo vòng
        </Button>
        <Button variant="outlined" sx={touchButtonSx} component={RouterLink} to="/tournament">
          Tới Giải đấu
        </Button>
        <Button variant="outlined" sx={touchButtonSx} component={RouterLink} to="/club">
          CLB & Giải
        </Button>
      </Stack>

      {unassignedTournaments.length > 0 ? (
        <AlertLike text={`${unassignedTournaments.length} giải chưa gắn vòng trong mùa/giải này.`} />
      ) : null}

      {rounds.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có vòng nào. Bấm &quot;Tạo vòng&quot; hoặc tạo giải mới để hệ thống tự tạo vòng.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {rounds.map((round) => (
            <RoundCard
              key={round.id}
              round={round}
              isActive={String(round.id) === String(activeRoundId)}
              tournaments={getTournamentsForRound(activeClubId, round.id)}
              unassignedTournaments={unassignedTournaments}
              onRename={handleRename}
              onSetActive={handleSetActive}
              onAssign={handleAssign}
              onUnlink={handleUnlink}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function AlertLike({ text }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, bgcolor: "warning.50" }}>
      <Typography variant="body2">{text}</Typography>
    </Paper>
  );
}
