import { Link as RouterLink } from "react-router-dom";

import { Alert, Box, Button, Grid, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import TournamentPageHeader from "../../../../components/tournament/TournamentPageHeader.jsx";
import { TournamentStatusChip } from "../../../../components/tournament/TournamentStatusChip.jsx";
import { tournamentCardSx } from "../../../../components/tournament/tournamentLayout.js";

function DirectorKpiChip({ label, value }) {
  return (
    <Box
      sx={{
        ...tournamentCardSx,
        px: 1.5,
        py: 1,
        minWidth: 100,
        flex: "1 1 auto",
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography fontWeight={700} sx={{ fontSize: 20, lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function DirectorHeader({
  tournament,
  onBack,
  isDaily,
  savedEvents,
  activeEvent,
  onEventChange,
  snapshot,
  message,
  error,
  onClearMessage,
  onClearError,
  hasSupabaseConfig,
  liveError,
}) {
  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
        Quay lại setup
      </Button>

      <TournamentPageHeader
        title={`Director — ${tournament.name}`}
        description="Điều hành sân, trận chờ/đang đánh/xong, BXH nhanh, bracket mini và trọng tài live"
        badge={tournament?.status ? <TournamentStatusChip status={tournament.status} /> : null}
      />

      {!hasSupabaseConfig && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Chế độ trọng tài cần Supabase Realtime. Cấu hình VITE_SUPABASE_URL trong Settings / .env và
          chạy script docs/supabase-match-live.sql.
        </Alert>
      )}
      {liveError && hasSupabaseConfig && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Live score: {liveError}
        </Alert>
      )}

      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={onClearMessage}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={onClearError}>
          {error}
        </Alert>
      )}

      {!isDaily && savedEvents.length > 1 && (
        <Paper variant="outlined" sx={{ p: 1, mb: 2, ...tournamentCardSx }}>
          <Tabs
            value={activeEvent?.id || false}
            onChange={(_, value) => onEventChange(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {savedEvents.map((event) => (
              <Tab key={event.id} value={event.id} label={event.name} />
            ))}
          </Tabs>
        </Paper>
      )}

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <DirectorKpiChip label="Chờ" value={snapshot.summary.waiting} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <DirectorKpiChip label="Đang đánh" value={snapshot.summary.onCourt} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <DirectorKpiChip label="Xong" value={snapshot.summary.completed} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <DirectorKpiChip label="Sân bận" value={snapshot.summary.courtsBusy} />
        </Grid>
      </Grid>
    </Box>
  );
}

export function DirectorAccessDenied({ reason = "default", message }) {
  if (reason === "not-found") {
    return (
      <Box>
        <Alert severity="error">Không tìm thấy giải.</Alert>
        <Button component={RouterLink} to="/tournament" sx={{ mt: 2 }}>
          Quay lại
        </Button>
      </Box>
    );
  }

  if (reason === "tenant-access") {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {message || "Không có quyền truy cập giải này."}
        </Alert>
        <Button component={RouterLink} to="/tournament">
          Quay lại danh sách giải
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Alert severity="error" sx={{ mb: 2 }}>
        Bạn không có quyền Director Mode cho giải này.
      </Alert>
      <Button component={RouterLink} to="/tournament">
        Quay lại danh sách giải
      </Button>
    </Box>
  );
}
