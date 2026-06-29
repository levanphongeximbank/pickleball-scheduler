import { useMemo } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useClub } from "../context/ClubContext.jsx";
import { loadPlayerHistoryProfileForClub } from "../tournament/engines/playerHistoryEngine.js";

function StatCard({ label, value, helper }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight="bold">
        {value}
      </Typography>
      {helper && (
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      )}
    </Paper>
  );
}

function RelationshipList({ title, items }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chua co du lieu.
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          {items.map((item) => (
            <Stack
              key={item.playerId}
              direction="row"
              justifyContent="space-between"
              spacing={1}
            >
              <Typography variant="body2">{item.name}</Typography>
              <Chip size="small" label={`${item.count} lan`} />
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export default function PlayerProfile() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { activeClubId, activeClub, revision } = useClub();

  const profile = useMemo(() => {
    void revision;
    return loadPlayerHistoryProfileForClub(activeClubId, playerId, { recentLimit: 12 });
  }, [activeClubId, playerId, revision]);

  if (!profile.ok) {
    return (
      <Box>
        <Alert severity="error">{profile.error}</Alert>
        <Button component={RouterLink} to="/players" sx={{ mt: 2 }}>
          Quay lai danh sach
        </Button>
      </Box>
    );
  }

  const { player, stats, recentMatches, topPartners, topOpponents } = profile;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/players")} sx={{ mb: 2 }}>
        Quay lai Nguoi choi
      </Button>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Box>
            <Typography variant="h5" fontWeight="bold">
              {player.name}
            </Typography>
            <Typography color="text.secondary">
              {activeClub?.name || "CLB"} • {player.gender || "?"} • Trình công khai{" "}
              {player.level ?? player.rating}
              {player.ratingInternal != null && (
                <> • Rating nội bộ {Number(player.ratingInternal).toFixed(2)}</>
              )}
            </Typography>
            {player.clubName && (
              <Typography variant="body2" color="text.secondary">
                CLB dai dien: {player.clubName}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {player.playerType && <Chip label={player.playerType} size="small" />}
            {player.unitName && <Chip label={player.unitName} size="small" variant="outlined" />}
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="So tran" value={stats.matchesPlayed} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Thang / Thua / Hoa" value={`${stats.wins}/${stats.losses}/${stats.draws}`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Ty le thang" value={`${stats.winRate}%`} helper="Tinh tren tran co thang/thua" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Hieu so diem"
            value={stats.pointDiff}
            helper={`${stats.pointsFor} - ${stats.pointsAgainst}`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <RelationshipList title="Dong doi thuong gap" items={topPartners} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <RelationshipList title="Doi thu thuong gap" items={topOpponents} />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
          Tran gan day
        </Typography>
        {recentMatches.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chua co lich su tran tu Daily Play hoac giai V3.3.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {recentMatches.map((match) => (
              <Paper key={match.id} variant="outlined" sx={{ p: 1.25 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {match.tournamentName} • {match.eventName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {match.stageLabel} • {match.scoreA}-{match.scoreB}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    color={match.outcome?.won ? "success" : match.outcome?.lost ? "error" : "default"}
                    label={match.resultLabel}
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
