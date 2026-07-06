import { Chip } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

import { BROADCAST_STATUS } from "../constants/broadcastConfig.js";

const LABELS = {
  [BROADCAST_STATUS.LIVE]: "ĐANG GHI",
  [BROADCAST_STATUS.UPLOADING]: "Đang tải VOD lên cloud…",
  [BROADCAST_STATUS.PREPARING]: "Đang chuẩn bị ghi…",
  [BROADCAST_STATUS.STOPPING]: "Đang dừng…",
  [BROADCAST_STATUS.ERROR]: "Lỗi ghi/phát",
};

export default function BroadcastLiveIndicator({ status, error }) {
  if (!status || status === BROADCAST_STATUS.IDLE) {
    return null;
  }

  const label = error || LABELS[status] || status;
  const isLive = status === BROADCAST_STATUS.LIVE || status === BROADCAST_STATUS.UPLOADING;

  return (
    <Chip
      size="small"
      icon={isLive ? <FiberManualRecordIcon sx={{ fontSize: 12 }} /> : undefined}
      label={label}
      color={status === BROADCAST_STATUS.ERROR ? "error" : isLive ? "error" : "default"}
      variant={isLive ? "filled" : "outlined"}
      sx={
        isLive
          ? {
              fontWeight: 700,
              animation: "pulse 1.5s ease-in-out infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.72 },
              },
            }
          : undefined
      }
    />
  );
}
