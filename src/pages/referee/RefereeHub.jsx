import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import SportsIcon from "@mui/icons-material/Sports";
import QrCode2Icon from "@mui/icons-material/QrCode2";

import { useClub } from "../../context/ClubContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { listRefereeAssignments } from "../../features/identity/services/refereeSessionService.js";
import { touchButtonSx, MOBILE_PAGE_GUTTER } from "../../components/tournament/mobileUi.js";
import { useIsMobile } from "../../features/mobile/hooks/useIsMobile.js";

export default function RefereeHub() {
  const { activeClubId } = useClub();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [matches, setMatches] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listRefereeAssignments({ clubId: activeClubId });
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      setMatches([]);
      return;
    }

    setMatches(result.matches);
  }, [activeClubId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box sx={{ px: isMobile ? MOBILE_PAGE_GUTTER : 0, pb: isMobile ? 8 : 0 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <SportsIcon color="primary" />
        <Typography variant={isMobile ? "h5" : "h4"} fontWeight={800}>
          Trọng tài — Trận được phân công
        </Typography>
      </Stack>

      {isMobile && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button
            component={RouterLink}
            to="/mobile/qr-scan"
            variant="outlined"
            startIcon={<QrCode2Icon />}
            sx={touchButtonSx}
            fullWidth
          >
            Quét QR trận
          </Button>
        </Stack>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        Đăng nhập bằng role REFEREE. Link token cũ <code>/referee/:token</code> vẫn dùng được
        (legacy).
      </Alert>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      {loading && <Typography color="text.secondary">Đang tải…</Typography>}

      <Stack spacing={2}>
        {matches.map((match) => (
          <Card key={`${match.tournamentId}-${match.matchId}`}>
            <CardContent>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Typography fontWeight={700}>
                    {match.team1Name} vs {match.team2Name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {match.tournamentName} — Sân {match.courtId || "?"}
                  </Typography>
                  <Typography variant="body2">
                    Tỷ số: {match.score1} - {match.score2}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={match.status || "playing"} />
                  <Button
                    component={RouterLink}
                    to={`/referee/match/${match.matchId}`}
                    state={{ refereeToken: match.refereeToken, tournamentId: match.tournamentId }}
                    variant="contained"
                    fullWidth={isMobile}
                    sx={isMobile ? touchButtonSx : undefined}
                  >
                    Chấm điểm
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}

        {!loading && matches.length === 0 && (
          <Typography color="text.secondary">
            Chưa có trận live được phân công cho {user?.displayName || "bạn"}.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
