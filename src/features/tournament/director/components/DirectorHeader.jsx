import { Link as RouterLink } from "react-router-dom";

import { Alert, Box, Button, Chip, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

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
        Quay lai setup
      </Button>

      <Typography variant="h5" fontWeight="bold">
        Director — {tournament.name}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Điều hành sân, trận chờ/đang đánh/xong, BXH nhanh, bracket mini và trọng tài live
      </Typography>

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
        <Paper variant="outlined" sx={{ p: 1, mb: 2 }}>
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

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip label={`Cho: ${snapshot.summary.waiting}`} color="warning" />
        <Chip label={`Dang danh: ${snapshot.summary.onCourt}`} color="success" />
        <Chip label={`Xong: ${snapshot.summary.completed}`} />
        <Chip label={`San ban: ${snapshot.summary.courtsBusy}`} variant="outlined" />
      </Stack>
    </Box>
  );
}

export function DirectorAccessDenied({ reason = "default" }) {
  if (reason === "not-found") {
    return (
      <Box>
        <Alert severity="error">Khong tim thay giai.</Alert>
        <Button component={RouterLink} to="/tournament" sx={{ mt: 2 }}>
          Quay lai
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
