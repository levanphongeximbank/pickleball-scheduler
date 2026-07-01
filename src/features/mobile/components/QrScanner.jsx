import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import StopIcon from "@mui/icons-material/Stop";

import { parseQrPayload } from "../services/qrTokenService.js";

export default function QrScanner({ onScan, onError, active = true }) {
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    setError("");
    if (!containerRef.current) {
      return;
    }

    setIsStarting(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader-region");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const parsed = parseQrPayload(decodedText);
          if (parsed.ok) {
            onScan?.(parsed.token, decodedText);
            stopScanner();
          } else {
            onError?.(parsed.error);
          }
        },
        () => {}
      );
      setScanning(true);
    } catch (err) {
      const message = err?.message || "Không thể mở camera.";
      setError(message);
      onError?.(message);
    } finally {
      setIsStarting(false);
    }
  }, [onScan, onError, stopScanner]);

  useEffect(() => {
    if (!active) {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [active, stopScanner]);

  return (
    <Stack spacing={2} alignItems="center">
      <Box
        id="qr-reader-region"
        ref={containerRef}
        sx={{
          width: "100%",
          maxWidth: 360,
          minHeight: scanning ? 300 : 120,
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "grey.900",
        }}
      />
      {error && (
        <Typography color="error" variant="body2" textAlign="center">
          {error}
        </Typography>
      )}
      {!scanning ? (
        <Stack spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Đặt mã QR trong khung hình để bắt đầu check-in.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<CameraAltIcon />}
            onClick={startScanner}
            disabled={isStarting}
            sx={{ minHeight: 56, minWidth: 200 }}
          >
            {isStarting ? "Đang mở camera..." : "Bật camera"}
          </Button>
        </Stack>
      ) : (
        <Button
          variant="outlined"
          color="error"
          startIcon={<StopIcon />}
          onClick={stopScanner}
          sx={{ minHeight: 48 }}
        >
          Dừng quét
        </Button>
      )}
    </Stack>
  );
}
