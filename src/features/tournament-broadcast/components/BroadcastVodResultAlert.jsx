import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

export default function BroadcastVodResultAlert({ result, onClose }) {
  if (!result?.ok) {
    return null;
  }

  const handleCopy = async () => {
    if (!result.signedUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(result.signedUrl);
    } catch {
      // ignore
    }
  };

  return (
    <Alert severity="success" onClose={onClose} sx={{ mb: 2 }}>
      <Stack spacing={1}>
        <Typography fontWeight={600}>Đã lưu video trình chiếu lên cloud</Typography>
        <Typography variant="body2" color="text.secondary">
          {result.path ? `Đường dẫn: ${result.path}` : null}
          {result.signedUrl ? " — Link xem lại có hiệu lực ~7 ngày." : null}
        </Typography>
        {result.signedUrl ? (
          <Box>
            <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopy}>
              Sao chép link xem lại
            </Button>
            <Button
              size="small"
              sx={{ ml: 1 }}
              href={result.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Mở video
            </Button>
          </Box>
        ) : null}
      </Stack>
    </Alert>
  );
}
