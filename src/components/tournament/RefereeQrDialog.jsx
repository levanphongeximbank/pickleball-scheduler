import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

import {
  buildWhatsAppRefereeUrl,
  copyRefereeShareText,
} from "../../tournament/engines/refereeEngine.js";

export default function RefereeQrDialog({ open, onClose, url, sharePayload }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !url) {
      setQrDataUrl("");
      setMessage("");
      return;
    }

    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [open, url]);

  const handleCopy = async () => {
    const ok = await copyRefereeShareText(sharePayload);
    setMessage(ok ? "Đã copy link và thông tin trận." : "Không copy được — hãy copy thủ công.");
  };

  if (!url) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>QR Code trọng tài</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Quét bằng camera điện thoại để mở màn hình nhập điểm.
        </Typography>

        {qrDataUrl ? (
          <Box sx={{ display: "grid", placeItems: "center", mb: 2 }}>
            <Box
              component="img"
              src={qrDataUrl}
              alt="QR Code trọng tài"
              sx={{
                width: 280,
                height: 280,
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                bgcolor: "#fff",
                p: 1,
              }}
            />
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Đang tạo QR Code...
          </Typography>
        )}

        <Stack spacing={1}>
          <TextField fullWidth value={url} size="small" InputProps={{ readOnly: true }} />
          {message && (
            <Typography variant="caption" color="success.main">
              {message}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onClose}>Đóng</Button>
        <Button startIcon={<ContentCopyIcon />} onClick={handleCopy}>
          Copy link
        </Button>
        <Button
          component="a"
          href={buildWhatsAppRefereeUrl(sharePayload)}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<WhatsAppIcon />}
          color="success"
        >
          WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  );
}
