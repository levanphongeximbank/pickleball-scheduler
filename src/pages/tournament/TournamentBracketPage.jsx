import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Typography } from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { loadCourtsForClub } from "../../domain/clubStorage.js";
import { getTournament } from "../../domain/tournamentService.js";
import { resolveBracketProgress } from "../../tournament/engines/index.js";
import TournamentBracketScreen from "../../components/tournament/bracket/TournamentBracketScreen.jsx";

const MODE_LABELS = {
  internal: "Giải nội bộ",
  official: "Giải mở",
};

const LIVE_REFRESH_MS = 2500;

export default function TournamentBracketPage() {
  const { tournamentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const mode = location.pathname.includes("/official/") ? "official" : "internal";
  const { activeClubId, revision } = useClub();
  const [liveTick, setLiveTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveTick((value) => value + 1);
    }, LIVE_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, []);

  const tournament = useMemo(
    () => getTournament(activeClubId, tournamentId),
    [activeClubId, tournamentId, revision, liveTick]
  );

  const courts = useMemo(() => loadCourtsForClub(activeClubId), [activeClubId, revision]);
  const event = tournament?.events?.[0] || null;

  const progress = useMemo(
    () => (event ? resolveBracketProgress(event) : null),
    [event]
  );

  const knockoutMatchesByBracketId = useMemo(() => {
    const map = {};
    (event?.matches || []).forEach((match) => {
      if (match.bracketMatchId) {
        map[match.bracketMatchId] = match;
      }
    });
    return map;
  }, [event]);

  const backPath =
    mode === "official"
      ? `/tournament/official/${tournamentId}`
      : `/tournament/internal/${tournamentId}`;

  if (!tournament) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">Không tìm thấy giải đấu.</Alert>
      </Box>
    );
  }

  if (!progress?.rounds?.length) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Chưa có sơ đồ thi đấu. Nhập đủ điểm vòng bảng — bracket sẽ được tạo tự động từ BXH.
        </Alert>
        <Typography
          variant="body2"
          color="primary"
          sx={{ cursor: "pointer", textDecoration: "underline" }}
          onClick={() => navigate(backPath)}
        >
          Quay lại thiết lập giải
        </Typography>
      </Box>
    );
  }

  return (
    <TournamentBracketScreen
      tournament={tournament}
      event={event}
      progress={progress}
      knockoutMatchesByBracketId={knockoutMatchesByBracketId}
      courts={courts}
      categoryLabel={MODE_LABELS[mode] || ""}
      onBack={() => navigate(backPath)}
      onOpenResults={() => navigate(backPath)}
      onOpenDetails={() => navigate(backPath)}
      autoPlayReveal={false}
    />
  );
}
