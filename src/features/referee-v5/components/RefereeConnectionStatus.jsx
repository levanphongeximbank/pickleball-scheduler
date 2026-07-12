import {
  REALTIME_CONNECTION,
  REALTIME_CONNECTION_VI,
} from "../constants/realtimeConnectionStates.js";

const LEGACY_MODE_LABELS = {
  prototype: "Chế độ prototype — không kết nối database",
  remote: "Remote staging — đồng bộ qua Edge Function",
  "remote-error": "Lỗi kết nối remote — tải lại để thử lại",
};

export default function RefereeConnectionStatus({
  mode = "prototype",
  realtimeState = null,
  isRealtimeActive = false,
}) {
  let label = LEGACY_MODE_LABELS[mode] || "Đang kết nối…";

  if (mode === "remote-error") {
    label = LEGACY_MODE_LABELS["remote-error"];
  } else if (isRealtimeActive && realtimeState && REALTIME_CONNECTION_VI[realtimeState]) {
    label = REALTIME_CONNECTION_VI[realtimeState];
  } else if (mode === "remote") {
    label = LEGACY_MODE_LABELS.remote;
  }

  return (
    <p
      className="rv5-header-meta"
      data-testid="referee-connection-status"
      data-realtime-state={realtimeState || ""}
    >
      {label}
    </p>
  );
}

export { REALTIME_CONNECTION, REALTIME_CONNECTION_VI };
