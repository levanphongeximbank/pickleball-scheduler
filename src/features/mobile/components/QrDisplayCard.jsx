import { useEffect, useRef, useState } from "react";
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import QRCode from "qrcode";

export default function QrDisplayCard({ payload, title, subtitle, onDownload }) {
  const [dataUrl, setDataUrl] = useState("");
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!payload) {
      setDataUrl("");
      return;
    }
    QRCode.toDataURL(payload, { width: 280, margin: 2, color: { dark: "#0f3f2e" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [payload]);

  const handleDownload = () => {
    if (!dataUrl) {
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `qr-${Date.now()}.png`;
    link.click();
    onDownload?.();
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={2} alignItems="center">
          {title && (
            <Typography variant="h6" fontWeight={800} textAlign="center">
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {subtitle}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Mã QR này có thể dùng để check-in nhanh khi người dùng quét trên thiết bị khác.
          </Typography>
          {!payload && (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Chưa có dữ liệu QR để hiển thị.
            </Typography>
          )}
          {dataUrl ? (
            <Box
              component="img"
              src={dataUrl}
              alt="QR Code"
              sx={{ width: 280, maxWidth: "100%", borderRadius: 2, border: "1px solid", borderColor: "divider" }}
            />
          ) : payload ? (
            <Box ref={canvasRef} sx={{ width: 280, height: 280, bgcolor: "grey.100", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Đang tạo mã QR...
              </Typography>
            </Box>
          ) : null}
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={!dataUrl}
            sx={{ minHeight: 48 }}
          >
            Tải QR
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
