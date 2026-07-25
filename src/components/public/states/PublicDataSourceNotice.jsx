/**
 * Public data-source honesty notice (EC-03).
 * Text label required — color is not the only signal.
 */

import { Alert, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { PUBLIC_PORTAL_DATA_SOURCE } from "../../../features/experience-channels/public-portal/constants/dataSources.js";
import { PUBLIC_COLORS } from "../publicPortalStyles.js";

const DEFAULT_COPY = Object.freeze({
  [PUBLIC_PORTAL_DATA_SOURCE.MOCK]: {
    title: "Dữ liệu minh họa",
    message:
      "Nội dung đang hiển thị dữ liệu mẫu, không phải dữ liệu trực tiếp từ hệ thống vận hành.",
  },
  [PUBLIC_PORTAL_DATA_SOURCE.PREVIEW]: {
    title: "Dữ liệu xem trước",
    message:
      "Nội dung đang ở chế độ xem trước. Đây chưa phải dữ liệu production đã được xác nhận.",
  },
  [PUBLIC_PORTAL_DATA_SOURCE.MIXED]: {
    title: "Đang dùng dữ liệu dự phòng",
    message:
      "Nguồn dữ liệu trực tiếp chưa đủ hoặc gặp sự cố. Cổng công khai đang hiển thị dữ liệu dự phòng đã được gắn nhãn rõ ràng.",
  },
  [PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN]: {
    title: "Nguồn dữ liệu chưa xác định",
    message:
      "Chưa chứng minh được nguồn dữ liệu trực tiếp. Nội dung không được xem là dữ liệu live.",
  },
});

/**
 * @param {{
 *   source?: string,
 *   title?: string,
 *   message?: string,
 *   fallbackReason?: string|null,
 * }} props
 */
export function PublicDataSourceNotice({
  source = "",
  title = "",
  message = "",
  fallbackReason = null,
}) {
  const key = String(source || "").trim();
  if (
    key === PUBLIC_PORTAL_DATA_SOURCE.LIVE ||
    key === "" ||
    !DEFAULT_COPY[key]
  ) {
    return null;
  }

  const defaults = DEFAULT_COPY[key];
  const resolvedTitle = title || defaults.title;
  const resolvedMessage = message || defaults.message;
  const reasonText =
    fallbackReason && String(fallbackReason).trim()
      ? `Mã dự phòng: ${String(fallbackReason).trim()}`
      : "";

  return (
    <Alert
      severity="info"
      role="status"
      aria-live="polite"
      icon={<InfoOutlinedIcon aria-hidden />}
      data-testid="public-data-source-notice"
      data-source={key}
      sx={{
        mb: 3,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        bgcolor: "rgba(56,189,248,0.10)",
        color: PUBLIC_COLORS.text,
        border: "1px solid rgba(56,189,248,0.35)",
        "& .MuiAlert-message": { width: "100%" },
      }}
    >
      <Typography component="h2" variant="subtitle2" fontWeight={700}>
        {resolvedTitle}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.95 }}>
        {resolvedMessage}
      </Typography>
      {reasonText ? (
        <Typography variant="caption" sx={{ mt: 0.75, display: "block", opacity: 0.85 }}>
          {reasonText}
        </Typography>
      ) : null}
    </Alert>
  );
}
