import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { BROADCAST_PLATFORMS } from "../constants/broadcastConfig.js";
import { isRelayAvailable } from "../lib/broadcastRelayClient.js";
import { isBroadcastVodUploadAvailable } from "../services/broadcastVodService.js";
import { loadBroadcastConfig } from "../services/broadcastConfigStorage.js";

function DestinationFields({ platformId, value, onChange }) {
  const platform = BROADCAST_PLATFORMS[platformId];

  return (
    <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={Boolean(value?.enabled)}
            disabled={!platform.supportsRelay}
            onChange={(event) =>
              onChange({ ...value, enabled: event.target.checked })
            }
          />
        }
        label={platform.label}
      />

      {!platform.supportsRelay ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {platform.note}
        </Typography>
      ) : (
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="RTMP URL"
            value={value?.rtmpUrl || platform.defaultRtmpUrl}
            onChange={(event) => onChange({ ...value, rtmpUrl: event.target.value })}
          />
          <TextField
            size="small"
            fullWidth
            label="Stream Key"
            type="password"
            value={value?.streamKey || ""}
            onChange={(event) => onChange({ ...value, streamKey: event.target.value })}
            helperText="Chỉ cần khi bật phát live qua relay server"
          />
        </Stack>
      )}
    </Box>
  );
}

export default function BroadcastSetupDialog({ open, tournamentId, config, onChange, onClose }) {
  const [draft, setDraft] = useState(config);
  const [showLiveOptions, setShowLiveOptions] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(config || loadBroadcastConfig(tournamentId));
      setShowLiveOptions(Boolean(config?.destinations?.youtube?.enabled || config?.destinations?.facebook?.enabled));
    }
  }, [open, config, tournamentId]);

  const cloudReady = isBroadcastVodUploadAvailable();
  const relayReady = isRelayAvailable();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Ghi video trình chiếu (VOD)</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Alert severity={cloudReady ? "success" : "warning"}>
            {cloudReady
              ? "Hướng 1: Sau trình chiếu, video được lưu lên Supabase Storage. Bạn nhận link xem lại ~7 ngày."
              : "Chưa cấu hình Supabase (VITE_SUPABASE_URL + ANON_KEY). Apply SQL bucket trước khi dùng."}
          </Alert>

          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(draft.autoBroadcastOnFlow)}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, autoBroadcastOnFlow: event.target.checked }))
                }
              />
            }
            label="Tự ghi màn hình khi bấm «Bắt đầu trình chiếu»"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(draft.saveCloudVod)}
                disabled={!cloudReady}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, saveCloudVod: event.target.checked }))
                }
              />
            }
            label="Lưu VOD lên Supabase Storage (khuyên dùng)"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(draft.saveLocalVod)}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, saveLocalVod: event.target.checked }))
                }
              />
            }
            label="Đồng thời tải file .webm về máy"
          />

          <Box>
            <Button size="small" onClick={() => setShowLiveOptions((value) => !value)}>
              {showLiveOptions ? "Ẩn phát live YouTube/Facebook" : "Phát live (tùy chọn — hướng 2)"}
            </Button>
            <Collapse in={showLiveOptions}>
              <Stack spacing={2} sx={{ mt: 1.5 }}>
                <Alert severity={relayReady ? "success" : "info"}>
                  {relayReady
                    ? "Relay server sẵn sàng."
                    : "Cần deploy relay server riêng — không bắt buộc cho VOD."}
                </Alert>
                <DestinationFields
                  platformId="youtube"
                  value={draft.destinations?.youtube}
                  onChange={(next) =>
                    setDraft((prev) => ({
                      ...prev,
                      destinations: { ...prev.destinations, youtube: next },
                    }))
                  }
                />
                <DestinationFields
                  platformId="facebook"
                  value={draft.destinations?.facebook}
                  onChange={(next) =>
                    setDraft((prev) => ({
                      ...prev,
                      destinations: { ...prev.destinations, facebook: next },
                    }))
                  }
                />
                <DestinationFields
                  platformId="zalo"
                  value={draft.destinations?.zalo || {}}
                  onChange={() => {}}
                />
              </Stack>
            </Collapse>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Hủy</Button>
        <Button
          variant="contained"
          onClick={() => {
            onChange?.(draft);
            onClose?.();
          }}
        >
          Lưu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
