import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";

export function CrmLegacyUnavailableState({ message, code, onRetry }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: "warning.light",
        bgcolor: "warning.50",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <CampaignOutlinedIcon color="warning" aria-hidden />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight="bold" sx={{ mb: 0.5 }}>
            CRM chưa khả dụng
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
          {code ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Mã: {code}
            </Typography>
          ) : null}
          {onRetry ? (
            <Button
              variant="outlined"
              size="small"
              onClick={onRetry}
              sx={{ mt: 2 }}
              aria-label="Thử lại tải CRM"
            >
              Thử lại
            </Button>
          ) : null}
        </Box>
      </Stack>
    </Box>
  );
}

export function CrmLegacyMissingClubState({ message }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        py: { xs: 4, sm: 5 },
        px: 2,
        textAlign: "center",
        borderRadius: 2,
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: "grey.50",
      }}
    >
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
        Chưa chọn câu lạc bộ
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}

export function CrmLegacyDemoBanner({ text }) {
  if (!text) return null;
  return (
    <Alert severity="info" sx={{ mb: 2 }} role="status">
      {text}
    </Alert>
  );
}
