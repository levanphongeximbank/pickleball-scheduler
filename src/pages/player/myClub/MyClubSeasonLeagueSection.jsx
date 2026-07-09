import { useMemo } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import { useClub } from "../../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../../context/SeasonContext.jsx";
import { filterLeaguesBySeason } from "../../clubManagement.logic.js";
import { getClubById } from "../../../features/club/index.js";

const SEASON_STATUS_LABELS = {
  draft: "Nháp",
  active: "Đang diễn ra",
  archived: "Lưu trữ",
};

export default function MyClubSeasonLeagueSection({ clubId, tenantId, clubRecord }) {
  const { activeClub } = useClub();
  const { seasons, leagues, activeSeason, activeLeague } = useSeasonLeague();

  const club = useMemo(() => {
    if (clubRecord) {
      return clubRecord;
    }
    if (clubId) {
      return getClubById(clubId, tenantId) || activeClub;
    }
    return activeClub;
  }, [clubRecord, clubId, tenantId, activeClub]);

  const leaguesForSeason = useMemo(
    () => filterLeaguesBySeason(leagues, activeSeason?.id),
    [leagues, activeSeason?.id]
  );

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        Mùa giải & Giải nội bộ
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {club?.name || "CLB của bạn"} — chỉ xem lịch mùa giải và giải nội bộ.
      </Typography>

      {activeSeason && (
        <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" fontWeight={700}>
                {activeSeason.name}
              </Typography>
              <Chip
                size="small"
                label={SEASON_STATUS_LABELS[activeSeason.status] || activeSeason.status || "—"}
                color={activeSeason.status === "active" ? "success" : "default"}
              />
            </Stack>
            {activeSeason.startDate && (
              <Typography variant="body2" color="text.secondary">
                {activeSeason.startDate}
                {activeSeason.endDate ? ` → ${activeSeason.endDate}` : ""}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {seasons.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          CLB chưa có mùa giải nào được thiết lập.
        </Alert>
      )}

      {activeLeague && (
        <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Giải hiện tại: {activeLeague.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {activeLeague.format ? `Hình thức: ${activeLeague.format}` : ""}
              {activeLeague.competitionType ? ` · Loại: ${activeLeague.competitionType}` : ""}
            </Typography>
          </CardContent>
        </Card>
      )}

      {leaguesForSeason.length > 0 && (
        <Stack spacing={1.5}>
          {leaguesForSeason.map((league) => (
            <Card key={league.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography fontWeight={600}>{league.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {league.format || "—"}
                  {league.competitionType ? ` · ${league.competitionType}` : ""}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {seasons.length > 0 && leaguesForSeason.length === 0 && (
        <Alert severity="info">Mùa giải hiện tại chưa có giải nội bộ nào.</Alert>
      )}
    </Box>
  );
}
