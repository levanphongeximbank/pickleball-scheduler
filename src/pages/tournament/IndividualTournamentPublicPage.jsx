import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { officialGetPublicResultsCommand } from "../../features/tournament/official-lifecycle/officialOpenLifecycleCommands.js";
import {
  TournamentEmptyState,
  TournamentErrorState,
  TournamentLoadingState,
} from "../../components/tournament/TournamentUiState.jsx";
import { MOBILE_PAGE_GUTTER, touchButtonSx } from "../../components/tournament/mobileUi.js";
import { useIsMobile } from "../../features/mobile/hooks/useIsMobile.js";

/**
 * Authenticated public results — sanitized DTO only. No full canonical blob in UI.
 */
export default function IndividualTournamentPublicPage() {
  const { tournamentId } = useParams();
  const { activeClub } = useClub();
  const isMobile = useIsMobile();
  const [dto, setDto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tournamentId || !activeClub?.id) {
        setLoading(false);
        setError("Thiếu giải hoặc CLB.");
        return;
      }
      setLoading(true);
      const result = await officialGetPublicResultsCommand({
        tenantId: activeClub.tenantId || activeClub.venueId || "",
        clubId: activeClub.id,
        tournamentId,
      });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error || "Không tải được kết quả công khai.");
        setDto(null);
        setLoading(false);
        return;
      }
      setDto(result.data && result.data.ok !== false ? result.data : result);
      setError(null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, activeClub]);

  if (!tournamentId) {
    return <TournamentErrorState title="Thiếu mã giải" />;
  }

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <TournamentLoadingState label="Đang tải trang công khai…" />
      </Box>
    );
  }

  const publicDto = dto && dto.ok !== false ? dto : null;

  if (error || !publicDto) {
    return (
      <Box sx={{ p: 3 }}>
        <TournamentErrorState title={error || "Không tìm thấy giải công khai"} />
        <Alert severity="info" sx={{ mt: 2 }}>
          Trang này chỉ nhận DTO kết quả đã lọc. Truy cập ẩn danh chưa mở.
        </Alert>
      </Box>
    );
  }

  const groups = publicDto.groups || [];
  const champion = publicDto.champion;
  const runnerUp = publicDto.runnerUp;

  return (
    <Box sx={{ px: isMobile ? MOBILE_PAGE_GUTTER : 3, py: 3, pb: 8, maxWidth: 960, mx: "auto" }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="h4" fontWeight={800}>
              {publicDto.name}
            </Typography>
            <Typography color="text.secondary">Kết quả công khai (DTO đã lọc)</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={publicDto.publicStatus || publicDto.status} />
              {publicDto.completed ? <Chip size="small" color="success" label="Đã hoàn tất" /> : null}
              <Chip size="small" label="Rally" />
            </Stack>
          </Box>
          <Button
            component={RouterLink}
            to={`/tournament/my/${tournamentId}`}
            variant="outlined"
            sx={touchButtonSx}
          >
            Cổng VĐV
          </Button>
        </Stack>

        {champion ? (
          <Alert severity="success">
            Vô địch: <strong>{champion.name}</strong>
            {runnerUp?.name ? <> · Á quân: <strong>{runnerUp.name}</strong></> : null}
          </Alert>
        ) : null}

        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={700} sx={{ mb: 1 }}>
            Bảng xếp hạng
          </Typography>
          {groups.length === 0 ? (
            <TournamentEmptyState title="Chưa có BXH" />
          ) : (
            groups.map((group) => (
              <Box key={group.groupId || group.group} sx={{ mb: 1.5 }}>
                <Typography fontWeight={700}>Bảng {group.group}</Typography>
                {(group.standing || []).map((row, index) => (
                  <Typography key={`${group.group}-${index}`} variant="body2">
                    {index + 1}. {row.name} — {row.matchPoints} điểm
                  </Typography>
                ))}
              </Box>
            ))
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
