import { useMemo, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { LifecycleStepper, PresentationStatusChip } from "../components/closureSurfaces.jsx";
import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import { FixtureAuthorityNote, ReadinessPanel } from "../components/prototypeSurfaces.jsx";
import { TOURNAMENT_COLOR, TOURNAMENT_ELEVATION, TOURNAMENT_RADIUS } from "../design/tournamentDesignTokens.js";
import {
  FIXTURE_CLOSE_BLOCKERS,
  FIXTURE_CLOSE_READINESS,
  FIXTURE_EVENT_COMPLETION,
  summarizeEventCompletion,
} from "../fixtures/opsFixture.js";
import { FIXTURE_TOURNAMENT_ID, getFixtureTournament } from "../fixtures/prototypeFixture.js";
import { tournamentPath } from "../navigation/tournamentNav.js";

const IMPACT = [
  "Không tạo trận thường mới",
  "Chỉnh sửa bốc thăm / lịch thông thường bị khóa",
  "Trạng thái kết quả chính thức được công bố",
  "Trạng thái trang giải đấu công khai = Đã hoàn tất",
  "Báo cáo trở nên sẵn sàng",
  "Sửa sau cần Điều chỉnh / Mở lại",
];

const CLOSE_TO_LABEL = {
  matches: "trận đấu",
  awards: "giải thưởng",
  exceptions: "sự cố",
  standings: "BXH",
};

function EventMatrixRow({ event }) {
  const checks = [
    { label: "Trận đã kết thúc", ok: event.matchesTerminal, note: `${event.done}/${event.total}` },
    { label: "Kết quả chính thức", ok: event.officialResult },
    { label: "Bảng xếp hạng", ok: event.standings },
    { label: "Giải thưởng", ok: event.awards },
    { label: "Hoàn tất nội dung", ok: event.eventComplete },
  ];
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.15,
        mb: 1,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${event.eventComplete ? TOURNAMENT_COLOR.divider : TOURNAMENT_COLOR.warning}`,
        bgcolor: event.eventComplete ? TOURNAMENT_COLOR.cardBg : TOURNAMENT_COLOR.warningSurface,
        boxShadow: TOURNAMENT_ELEVATION.card,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{event.name}</Typography>
        <PresentationStatusChip status={event.status} />
      </Stack>
      <Grid container spacing={0.75}>
        {checks.map((item) => (
          <Grid key={item.label} size={{ xs: 6, sm: true }}>
            <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{item.label}</Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: item.ok ? TOURNAMENT_COLOR.success : TOURNAMENT_COLOR.warning }}>
              {item.ok ? "Có" : "Không"}{item.note ? ` • ${item.note}` : ""}
            </Typography>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

export default function CompleteTournamentPage() {
  const tournament = getFixtureTournament();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const close = summarizeEventCompletion(FIXTURE_EVENT_COMPLETION);
  const closeReady = FIXTURE_CLOSE_READINESS.every((item) => item.ready);
  const remainingMatches = close.remainingMatches;
  const closePct = Math.round((FIXTURE_CLOSE_READINESS.filter((item) => item.ready).length / FIXTURE_CLOSE_READINESS.length) * 100);
  const cta = useMemo(
    () => (
      <Button
        variant="contained"
        size="small"
        color="primary"
        disabled={!closeReady}
        onClick={() => closeReady && setConfirmOpen(true)}
      >
        Hoàn tất giải đấu
      </Button>
    ),
    [closeReady],
  );

  return (
    <TournamentExperienceShell
      title="Hoàn tất giải đấu"
      subtitle="Hoàn tất cấp giải đấu — không phải kết quả nội dung, không phải xóa"
      actions={cta}
    >
      <FixtureAuthorityNote>
        Hoàn tất giải đấu và Điều chỉnh / Mở lại chỉ là nguyên mẫu. HOÀN TẤT ≠ XÓA.
      </FixtureAuthorityNote>
      <LifecycleStepper current="Mức sẵn sàng hoàn tất" />
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 300px" },
          gridTemplateAreas: {
            xs: `"summary" "matrix" "blockers" "readiness" "impact" "cta"`,
            lg: `"summary summary" "matrix blockers" "matrix readiness" "impact cta"`,
          },
        }}
      >
        <Box sx={{ gridArea: "summary", minWidth: 0 }}>
          <TournamentSectionTitle>Tổng quan giải đấu</TournamentSectionTitle>
          <Typography sx={{ fontWeight: 800, fontSize: 22, mb: 1 }}>{tournament.name}</Typography>
          <Grid container spacing={1.25}>
            <Grid size={{ xs: 6, sm: 4, md: true }}><TournamentKpiCard label="Trạng thái" value="Đang diễn ra" tone="warning" /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: true }}><TournamentKpiCard label="Nội dung" value={`${close.completedEvents}/${close.eventCount}`} hint="đã hoàn tất" /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: true }}><TournamentKpiCard label="Trận" value={`${close.terminalMatches}/${close.totalMatches}`} /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: true }}><TournamentKpiCard label="Vấn đề chặn" value={FIXTURE_CLOSE_BLOCKERS.length} tone="danger" /></Grid>
            <Grid size={{ xs: 6, sm: 4, md: true }}><TournamentKpiCard label="Mức sẵn sàng hoàn tất" value={`${closePct}%`} tone="warning" /></Grid>
          </Grid>
        </Box>

        <Box sx={{ gridArea: "matrix", minWidth: 0 }}>
          <TournamentSectionTitle>Ma trận hoàn tất nội dung</TournamentSectionTitle>
          {FIXTURE_EVENT_COMPLETION.map((event) => (
            <EventMatrixRow key={event.id} event={event} />
          ))}
        </Box>

        <Box sx={{ gridArea: "blockers", minWidth: 0 }}>
          <TournamentRightRailCard title="Vấn đề chặn hoàn tất" priority>
            {FIXTURE_CLOSE_BLOCKERS.map((item) => (
              <Box key={item.id} sx={{ py: 0.65 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{item.label}</Typography>
                <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{item.detail}</Typography>
                <Button component={RouterLink} to={tournamentPath(FIXTURE_TOURNAMENT_ID, item.to)} size="small" sx={{ px: 0 }}>
                  Mở {CLOSE_TO_LABEL[item.to] || item.to}
                </Button>
              </Box>
            ))}
          </TournamentRightRailCard>
        </Box>

        <Box sx={{ gridArea: "readiness", minWidth: 0 }}>
          <ReadinessPanel
            title="Mức sẵn sàng hoàn tất giải đấu"
            statusLabel={closeReady ? "SẴN SÀNG" : "CHƯA SẴN SÀNG"}
            items={FIXTURE_CLOSE_READINESS}
          />
          <Box sx={{ mt: 1 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Mức sẵn sàng hoàn tất</Typography>
              <Typography sx={{ fontSize: 12 }}>{closePct}%</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={closePct}
              sx={{
                height: 6,
                borderRadius: 99,
                bgcolor: TOURNAMENT_COLOR.divider,
                "& .MuiLinearProgress-bar": { bgcolor: TOURNAMENT_COLOR.warning, borderRadius: 99 },
              }}
            />
            <Typography sx={{ fontSize: 12, mt: 0.75, color: "text.secondary" }}>
              {remainingMatches} trận còn lại • {close.activeEventCount} nội dung vẫn đang diễn ra
            </Typography>
          </Box>
        </Box>

        <Box sx={{ gridArea: "impact", minWidth: 0 }}>
          <TournamentSectionTitle>Tác động hoàn tất</TournamentSectionTitle>
          <Alert severity="info" sx={{ mb: 1 }}>
            Sau khi hoàn tất giải đấu — LƯU ≠ KHÓA ≠ CÔNG BỐ ≠ HOÀN TẤT. Thay đổi sau đó cần Điều chỉnh / Mở lại.
          </Alert>
          <Stack spacing={0.5}>
            {IMPACT.map((line) => (
              <Typography key={line} sx={{ fontSize: 13 }}>• {line}</Typography>
            ))}
          </Stack>
          <Button size="small" variant="outlined" sx={{ mt: 1.25 }} onClick={() => setConfirmOpen(true)}>
            Xem nội dung xác nhận
          </Button>
        </Box>

        <Box sx={{ gridArea: "cta", minWidth: 0 }}>
          {cta}
          <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.75 }}>
            Nút bị tắt vì chưa sẵn sàng hoàn tất. Không dùng nút xóa đỏ. HOÀN TẤT ≠ XÓA.
          </Typography>
        </Box>
      </Box>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Xác nhận hoàn tất giải đấu</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, mb: 1 }}>
            {tournament.name} sẽ chuyển sang Đã hoàn tất. Đây là bước kết thúc vòng đời — không phải xóa.
          </Typography>
          {IMPACT.map((line) => (
            <Typography key={line} sx={{ fontSize: 13 }}>• {line}</Typography>
          ))}
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            Dữ liệu mẫu hiện tại chưa sẵn sàng hoàn tất — {remainingMatches} trận còn lại. Không có quyền hoàn tất.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Đóng</Button>
          <Button variant="contained" color="primary" disabled={!closeReady}>
            Hoàn tất giải đấu
          </Button>
        </DialogActions>
      </Dialog>
    </TournamentExperienceShell>
  );
}
