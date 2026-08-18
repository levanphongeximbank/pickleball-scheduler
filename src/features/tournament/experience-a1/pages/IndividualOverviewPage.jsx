import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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

import { useClub } from "../../../../context/ClubContext.jsx";
import TournamentPageHeader from "../../../../components/tournament/TournamentPageHeader.jsx";
import { tournamentCardSx } from "../../../../components/tournament/tournamentLayout.js";
import { touchButtonSx } from "../../../../components/tournament/mobileUi.js";
import { isIndividualTournament, isTeamTournament } from "../../../../config/tournamentRoutes.js";
import { TOURNAMENT_MODE } from "../../../../models/tournament/constants.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import TournamentIdentityBlock from "../components/TournamentIdentityBlock.jsx";
import TournamentKpiCard, { TournamentRightRailCard } from "../components/TournamentKpiCard.jsx";
import { deriveOverviewModel } from "../deriveOverview.js";
import { individualSettingsPath, resolveA1OperationLinks } from "../routes.js";

export default function IndividualOverviewPage() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);

  if (loading) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Đang tải tổng quan giải từ cloud...
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!tournament) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Không tìm thấy giải.
      </Alert>
    );
  }

  if (!isIndividualTournament(tournament)) {
    const fallback =
      isTeamTournament(tournament)
        ? `/tournaments/${encodeURIComponent(tournament.id)}`
        : tournament.mode === TOURNAMENT_MODE.DAILY_PLAY
          ? `/tournament/daily/${encodeURIComponent(tournament.id)}`
          : "/tournament";
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Tổng quan Wave A1 chỉ dành cho giải cá nhân / chính thức.{" "}
        <Button component={RouterLink} to={fallback} size="small">
          Mở trang hiện tại
        </Button>
      </Alert>
    );
  }

  const model = deriveOverviewModel(tournament, { clubName: activeClub?.name || "" });
  const operations = resolveA1OperationLinks(tournament);
  const meta = [
    model.modeLabel,
    model.officialMode ? `Chế độ: ${model.officialMode}` : null,
    model.compatibility.internalSingleContent ? "Tương thích một nội dung" : null,
    model.compatibility.officialMultiContent ? "Nhiều nội dung" : null,
  ].filter(Boolean);

  return (
    <Box sx={{ width: "100%", minWidth: 0, overflowX: "hidden" }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/tournament")} sx={{ mb: 1 }}>
        Trung tâm giải đấu
      </Button>
      <TournamentPageHeader
        title="Tổng quan giải đấu"
        description="Chỉ đọc dữ liệu canonical. Không có thao tác khóa / công bố / hoàn tất mới."
        action={
          <Button
            variant="contained"
            size="small"
            component={RouterLink}
            to={individualSettingsPath(tournament.id)}
            sx={touchButtonSx}
          >
            Cài đặt
          </Button>
        }
      />

      <TournamentIdentityBlock
        title={model.name}
        subtitle={model.venue.label || "Chưa có địa điểm trên hồ sơ giải"}
        mode={model.mode}
        status={model.status}
        meta={meta}
      />

      <TournamentExperienceWorkspace
        rail={
          <>
            <TournamentRightRailCard title="Hồ sơ vòng đời">
              <Typography variant="body2">Trạng thái: {model.statusLabel}</Typography>
              <Typography variant="body2">
                Đăng ký trên hồ sơ: {model.recordState.registrationLockedAt ? "đã khóa (payload)" : "chưa khóa"}
              </Typography>
              <Typography variant="body2">
                Bốc thăm trên hồ sơ: {model.recordState.drawStatus || "chưa có"}
              </Typography>
              <Typography variant="body2">
                Lịch trên hồ sơ: {model.recordState.scheduleStatus || "chưa có"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {model.recordState.note}
              </Typography>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Thao tác hiện có">
              {operations.map((item) => (
                <Button
                  key={item.key}
                  component={RouterLink}
                  to={item.to}
                  size="small"
                  variant="text"
                  sx={{ justifyContent: "flex-start", ...touchButtonSx }}
                >
                  {item.label}
                </Button>
              ))}
            </TournamentRightRailCard>
          </>
        }
      >
        <Grid container spacing={1.25} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <TournamentKpiCard label="Nội dung" value={model.kpis.eventCount} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TournamentKpiCard label="Đăng ký / cặp" value={model.kpis.entryCount} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TournamentKpiCard
              label="Trận trên hồ sơ"
              value={model.kpis.matchCount}
              hint={model.kpis.matchCount ? `${model.kpis.completedMatchCount} đã xong` : undefined}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TournamentKpiCard
              label="Sân đã khóa lịch"
              value={model.kpis.courtCount}
              unavailable={!model.kpis.courtConfigured}
              hint={model.kpis.courtConfigured ? "Từ courtSchedule của giải" : undefined}
            />
          </Grid>
        </Grid>

        <Paper variant="outlined" sx={{ ...tournamentCardSx, p: 1.75, mb: 2 }}>
          <Typography fontWeight={700} sx={{ mb: 1 }}>
            Thời gian
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="body2">Tạo: {model.dates.createdAt || "—"}</Typography>
            <Typography variant="body2">Cập nhật: {model.dates.updatedAt || "—"}</Typography>
            <Typography variant="body2">
              Cửa sổ đăng ký: {model.dates.registrationOpensAt || "chưa cấu hình"} →{" "}
              {model.dates.registrationClosesAt || "chưa cấu hình"}
            </Typography>
            <Typography variant="body2">
              Ngày trên lịch sân: {model.dates.scheduleDate || "Chưa cấu hình ngày thi đấu"}
            </Typography>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ ...tournamentCardSx, p: 1.75 }}>
          <Typography fontWeight={700} sx={{ mb: 1 }}>
            Nội dung
          </Typography>
          {model.compatibility.internalSingleContent ? (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Giải nội bộ đang ở chế độ tương thích một nội dung.
            </Alert>
          ) : null}
          {model.events.length === 0 ? (
            <Alert severity="info">Chưa có nội dung trên hồ sơ giải.</Alert>
          ) : (
            <Stack spacing={1}>
              {model.events.map((event) => (
                <Stack
                  key={event.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: 1.25 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700}>{event.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {event.eventTypeLabel} · {event.entryCount} đăng ký · {event.matchCount} trận
                    </Typography>
                  </Box>
                  <Chip size="small" variant="outlined" label={event.status || "draft"} />
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>
      </TournamentExperienceWorkspace>
    </Box>
  );
}
