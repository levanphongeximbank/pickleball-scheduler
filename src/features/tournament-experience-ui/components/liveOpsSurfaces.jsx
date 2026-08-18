import { Box, Button, Paper, Stack, Typography } from "@mui/material";

import { TOURNAMENT_COLOR, TOURNAMENT_ELEVATION, TOURNAMENT_RADIUS } from "../design/tournamentDesignTokens.js";
import TournamentStatusChip from "./TournamentStatusChip.jsx";
import { OpsStatusChip } from "./opsStatusChip.jsx";
import { OperatorCard } from "./prototypeCards.jsx";
import { courtAccent, resolveCourtStatus } from "../liveOps/liveOpsStatus.js";

function accentColor(status) {
  const kind = courtAccent(status);
  if (kind === "live") return TOURNAMENT_COLOR.live;
  if (kind === "warning") return TOURNAMENT_COLOR.warning;
  if (kind === "danger") return TOURNAMENT_COLOR.danger;
  if (kind === "success") return TOURNAMENT_COLOR.success;
  return TOURNAMENT_COLOR.primary;
}

export function CourtOpsCard({ court, dense = false }) {
  const status = resolveCourtStatus(court);
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
        <OpsStatusChip status={status} />
      </Stack>
      {status === "MAINTENANCE" ? (
        <>
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.danger, fontWeight: 700 }}>BẢO TRÌ</Typography>
          <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>ETA {court.eta || "—"}</Typography>
        </>
      ) : current ? (
        <>
          <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>{current.id}</Typography>
          {current.a ? (
            <>
              <Typography sx={{ fontSize: 12.5 }}>{current.a}</Typography>
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>vs</Typography>
              <Typography sx={{ fontSize: 12.5 }}>{current.b}</Typography>
            </>
          ) : null}
          {current.score ? (
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: status === "LIVE" ? TOURNAMENT_COLOR.live : TOURNAMENT_COLOR.text }}>
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

export function RefereeOpsCard({ referee, onAssign }) {
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
        <OpsStatusChip status={referee.status} />
      </Stack>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{referee.currentMatch || "—"}</Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        {referee.court || "—"} {referee.currentTime ? `• ${referee.currentTime}` : ""}
      </Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.4 }}>
        Tiếp theo: {referee.nextAssignment ? `${referee.nextAssignment} • ${referee.nextCourt || ""} ${referee.nextTime || ""}`.trim() : "—"}
      </Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>Khối lượng trận hôm nay: {referee.workload || "—"}</Typography>
      {referee.issue ? (
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.warning, mt: 0.4 }}>{referee.issue}</Typography>
      ) : null}
      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
        <Button size="small" variant="outlined">Xem phân công</Button>
        {referee.status === "AVAILABLE" && onAssign ? (
          <Button size="small" variant="contained" onClick={() => onAssign(referee)}>Phân công</Button>
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
        borderLeft: `3px solid ${item.severity === "danger" || item.severity === "critical" ? TOURNAMENT_COLOR.danger : TOURNAMENT_COLOR.warning}`,
        bgcolor: selected ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
        boxShadow: TOURNAMENT_ELEVATION.card,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", gap: 0.5, mb: 0.35 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>{item.title}</Typography>
        <OpsStatusChip status={item.status === "open" ? "ATTENTION" : item.status === "watching" ? "WAITING" : "COMPLETED"} severity={item.severity} />
      </Stack>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        {item.type} • {item.match || item.court || item.affect} • {item.owner}
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>{item.opened}</Typography>
    </Paper>
  );
}

export function IncidentDetail({ item, onClose }) {
  if (!item) {
    return (
      <OperatorCard>
        <Typography sx={{ fontWeight: 700 }}>Sự cố đang chọn</Typography>
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chọn một sự cố trên danh sách.</Typography>
      </OperatorCard>
    );
  }
  return (
    <OperatorCard>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary }}>SỰ CỐ {item.id}</Typography>
      <Stack direction="row" spacing={0.5} sx={{ my: 0.5, flexWrap: "wrap" }}>
        <TournamentStatusChip tone={item.severity === "danger" ? "danger" : "warning"} label={item.severity} />
        <OpsStatusChip status={item.status === "open" ? "ATTENTION" : item.status === "watching" ? "WAITING" : "COMPLETED"} />
      </Stack>
      <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{item.title}</Typography>
      <Typography sx={{ fontSize: 12.5 }}>Nội dung: {item.event || "—"}</Typography>
      <Typography sx={{ fontSize: 12.5 }}>Trận: {item.match || "—"}</Typography>
      <Typography sx={{ fontSize: 12.5 }}>Sân: {item.court || "—"}</Typography>
      <Typography sx={{ fontSize: 12.5 }}>Phụ trách: {item.owner}</Typography>
      <Typography sx={{ fontSize: 12.5 }}>Mở lúc: {item.opened}</Typography>
      <Typography sx={{ fontSize: 12.5, mt: 1 }}>{item.description}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 1, mb: 0.35 }}>Diễn biến</Typography>
      {(item.timeline || []).map((row) => (
        <Typography key={`${row.time}-${row.text}`} sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
          {row.time} — {row.text}
        </Typography>
      ))}
      <Button size="small" variant="outlined" sx={{ mt: 1 }}>{item.action || "Mở xử lý"}</Button>
      {onClose ? <Button size="small" sx={{ mt: 1 }} onClick={onClose}>Đóng</Button> : null}
    </OperatorCard>
  );
}

export function OpsTimeline({ title = "Diễn biến vận hành", items }) {
  return (
    <OperatorCard sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, mb: 0.75 }}>{title}</Typography>
      <Stack spacing={0.55}>
        {items.map((item) => (
          <Box key={`${item.time}-${item.text}`} sx={{ borderBottom: `1px solid ${TOURNAMENT_COLOR.divider}`, pb: 0.45 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, minWidth: 42 }}>{item.time}</Typography>
              <OpsStatusChip status={item.status} />
            </Stack>
            <Typography sx={{ fontSize: 12.5 }}>{item.text}</Typography>
          </Box>
        ))}
      </Stack>
    </OperatorCard>
  );
}
