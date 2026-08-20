import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import ExperienceOperatorCard from "../visual/ExperienceOperatorCard.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import { TOURNAMENT_COLOR, TOURNAMENT_ELEVATION, TOURNAMENT_RADIUS } from "../visual/tournamentExperienceTokens.js";
import { OPS_STATUS, opsStatusLabelVi, opsStatusTone } from "./opsStatus.js";

function accentColor(status) {
  const tone = opsStatusTone(status);
  if (tone === "live") return TOURNAMENT_COLOR.live;
  if (tone === "warning") return TOURNAMENT_COLOR.warning;
  if (tone === "danger") return TOURNAMENT_COLOR.danger;
  if (tone === "success") return TOURNAMENT_COLOR.success;
  return TOURNAMENT_COLOR.primary;
}

export function CourtOpsCard({ court, dense = false }) {
  const status = court.derivedStatus || OPS_STATUS.AVAILABLE;
  const current = court.currentMatch;
  const next = court.nextMatch;
  return (
    <Paper
      elevation={0}
      sx={{
        p: dense ? 1 : 1.15,
        height: "100%",
        minWidth: 0,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
        borderLeft: `3px solid ${accentColor(status)}`,
        boxShadow: TOURNAMENT_ELEVATION.card,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 0.5, mb: 0.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: dense ? 13.5 : 15 }}>{court.name}</Typography>
        <ExperienceStatusChip tone={opsStatusTone(status)} label={opsStatusLabelVi(status)} />
      </Stack>
      {status === OPS_STATUS.MAINTENANCE ? (
        <>
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.danger, fontWeight: 700 }}>Bảo trì</Typography>
          <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>Không ghi trạng thái sân tại màn này.</Typography>
        </>
      ) : current ? (
        <>
          <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>{current.id}</Typography>
          <Typography sx={{ fontSize: 12.5 }}>{current.a}</Typography>
          <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>vs</Typography>
          <Typography sx={{ fontSize: 12.5 }}>{current.b}</Typography>
          {current.score && current.score !== "—" ? (
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: status === OPS_STATUS.LIVE ? TOURNAMENT_COLOR.live : TOURNAMENT_COLOR.text }}>
              {current.score}
            </Typography>
          ) : null}
          <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>
            {[current.event, current.stage, current.time].filter(Boolean).join(" • ")}
          </Typography>
        </>
      ) : (
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Không có trận hiện tại</Typography>
      )}
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.6 }}>
        Tiếp theo: {next ? `${next.id} · ${next.time}` : "—"}
      </Typography>
    </Paper>
  );
}

export function RefereeOpsCard({ referee }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.15,
        height: "100%",
        minWidth: 0,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
        boxShadow: TOURNAMENT_ELEVATION.card,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 0.5, mb: 0.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{referee.name}</Typography>
        {referee.derivedStatus ? (
          <ExperienceStatusChip tone={opsStatusTone(referee.derivedStatus)} label={opsStatusLabelVi(referee.derivedStatus)} />
        ) : (
          <ExperienceStatusChip tone="draft" label="Chưa có lịch" />
        )}
      </Stack>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{referee.currentMatch || "—"}</Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        {referee.court || "—"} {referee.currentTime ? `• ${referee.currentTime}` : ""}
      </Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.4 }}>
        Tiếp theo: {referee.nextAssignment ? `${referee.nextAssignment} • ${referee.nextCourt || ""} ${referee.nextTime || ""}`.trim() : "—"}
      </Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{referee.workload}</Typography>
      {referee.issue ? (
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.warning, mt: 0.4 }}>{referee.issue}</Typography>
      ) : null}
      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: "wrap" }}>
        <span title="Chỉ xem phân công hiện có.">
          <Button size="small" variant="outlined" disabled>Xem phân công</Button>
        </span>
        <span title="Chưa hỗ trợ gán trọng tài trên màn này.">
          <Button size="small" variant="contained" disabled>Phân công</Button>
        </span>
        {referee.refereeLaunchTo ? (
          <Button size="small" variant="outlined" component={RouterLink} to={referee.refereeLaunchTo}>
            Mở bảng điểm
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}

export function IncidentOpsCard({ item, selected, onClick }) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 1.15,
        mb: 1,
        cursor: onClick ? "pointer" : "default",
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${selected ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider}`,
        borderLeft: `3px solid ${item.severity === "danger" ? TOURNAMENT_COLOR.danger : TOURNAMENT_COLOR.warning}`,
        bgcolor: selected ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
        boxShadow: TOURNAMENT_ELEVATION.card,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", gap: 0.5, mb: 0.35 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>{item.title}</Typography>
        <ExperienceStatusChip
          tone={item.status === "open" ? "warning" : item.status === "resolved" ? "success" : "info"}
          label={item.status === "open" ? "Đang mở" : item.status === "resolved" ? "Đã xử lý" : "Đang theo dõi"}
        />
      </Stack>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        {item.type} • {item.match || item.court} • {item.owner}
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>{item.opened}</Typography>
    </Paper>
  );
}

export function IncidentDetail({ item, onClose }) {
  if (!item) {
    return (
      <ExperienceOperatorCard>
        <Typography sx={{ fontWeight: 700 }}>Sự cố đang chọn</Typography>
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
          Chọn một sự cố trên danh sách. Chưa có kho sự cố riêng — chỉ hiện ngoại lệ đã có trên hồ sơ trận.
        </Typography>
      </ExperienceOperatorCard>
    );
  }
  return (
    <ExperienceOperatorCard>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary }}>SỰ CỐ {item.id}</Typography>
      <Stack direction="row" spacing={0.5} sx={{ my: 0.5, flexWrap: "wrap" }}>
        <ExperienceStatusChip tone={item.severity === "danger" ? "danger" : "warning"} label={item.severity === "danger" ? "Nghiêm trọng" : "Cảnh báo"} />
        <ExperienceStatusChip
          tone={item.status === "open" ? "warning" : item.status === "resolved" ? "success" : "info"}
          label={item.status === "open" ? "Đang mở" : item.status === "resolved" ? "Đã xử lý" : "Đang theo dõi"}
        />
      </Stack>
      <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{item.title}</Typography>
      <Typography sx={{ fontSize: 12.5 }}>Nội dung: {item.event || "—"}</Typography>
      <Typography sx={{ fontSize: 12.5 }}>Trận: {item.match || "—"}</Typography>
      <Typography sx={{ fontSize: 12.5 }}>Sân: {item.court || "—"}</Typography>
      <Typography sx={{ fontSize: 12.5 }}>Nguồn: {item.owner}</Typography>
      <Typography sx={{ fontSize: 12.5 }}>Mốc lúc: {item.opened}</Typography>
      <Typography sx={{ fontSize: 12.5, mt: 1 }}>{item.description}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 1, mb: 0.35 }}>Diễn biến</Typography>
      {(item.timeline || []).map((row) => (
        <Typography key={`${row.time}-${row.text}`} sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
          {row.time} — {row.text}
        </Typography>
      ))}
      <span title="Chưa hỗ trợ thao tác này trong nội dung hiện tại.">
        <Button size="small" variant="outlined" sx={{ mt: 1 }} disabled>{item.action || "Mở xử lý"}</Button>
      </span>
      {onClose ? <Button size="small" sx={{ mt: 1 }} onClick={onClose}>Đóng</Button> : null}
    </ExperienceOperatorCard>
  );
}

export function OpsTimeline({ title = "Diễn biến vận hành", items }) {
  if (!items?.length) {
    return (
      <ExperienceOperatorCard sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 800, mb: 0.75 }}>{title}</Typography>
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có diễn biến vận hành trên hồ sơ.</Typography>
      </ExperienceOperatorCard>
    );
  }
  return (
    <ExperienceOperatorCard sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, mb: 0.75 }}>{title}</Typography>
      <Stack spacing={0.55}>
        {items.map((item) => (
          <Box key={`${item.time}-${item.text}`} sx={{ borderBottom: `1px solid ${TOURNAMENT_COLOR.divider}`, pb: 0.45 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, minWidth: 42 }}>{item.time}</Typography>
              <ExperienceStatusChip tone={opsStatusTone(item.status)} label={opsStatusLabelVi(item.status)} />
            </Stack>
            <Typography sx={{ fontSize: 12.5 }}>{item.text}</Typography>
          </Box>
        ))}
      </Stack>
    </ExperienceOperatorCard>
  );
}
