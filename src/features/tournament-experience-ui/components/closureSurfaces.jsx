import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import MilitaryTechOutlinedIcon from "@mui/icons-material/MilitaryTechOutlined";
import StarsOutlinedIcon from "@mui/icons-material/StarsOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import { Box, Paper, Stack, Typography } from "@mui/material";

import { TOURNAMENT_COLOR, TOURNAMENT_ELEVATION, TOURNAMENT_RADIUS } from "../design/tournamentDesignTokens.js";
import TournamentStatusChip from "./TournamentStatusChip.jsx";
import { displayStatusLabel } from "../copy/uiDisplayLabels.js";

// eslint-disable-next-line react-refresh/only-export-components -- display helper shared with chips
export function presentationStatusTone(status) {
  if (status === "LIVE") return "live";
  if (status === "READY" || status === "CONFIRMED" || status === "COMPLETED" || status === "ASSIGNED") return "success";
  if (status === "IN_PROGRESS" || status === "NOT_READY" || status === "PAUSED") return "warning";
  return "draft";
}

export function PresentationStatusChip({ status }) {
  return <TournamentStatusChip tone={presentationStatusTone(status)} label={displayStatusLabel(status)} />;
}

export function AwardCard({ title, pair, event, status, rank, featured = false }) {
  const Icon = rank === 1
    ? EmojiEventsOutlinedIcon
    : rank === 2
      ? MilitaryTechOutlinedIcon
      : rank === 3
        ? WorkspacePremiumOutlinedIcon
        : StarsOutlinedIcon;
  const accent = rank === 1
    ? TOURNAMENT_COLOR.primary
    : rank === 2
      ? TOURNAMENT_COLOR.textMuted
      : rank === 3
        ? TOURNAMENT_COLOR.warning
        : TOURNAMENT_COLOR.primary;
  return (
    <Paper
      elevation={0}
      sx={{
        p: featured ? 2 : 1.25,
        height: "100%",
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${featured ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider}`,
        bgcolor: featured ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
        boxShadow: TOURNAMENT_ELEVATION.card,
        textAlign: featured ? "center" : "left",
      }}
    >
      <Stack direction={featured ? "column" : "row"} spacing={0.75} sx={{ alignItems: featured ? "center" : "flex-start" }}>
        <Icon sx={{ color: accent, fontSize: featured ? 36 : 22 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: featured ? 12 : 11, fontWeight: 800, letterSpacing: 0.4, color: accent }}>{title}</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: featured ? 22 : 15 }}>{pair === "TBD" ? "Chưa xác định" : pair}</Typography>
          {event ? <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{event}</Typography> : null}
          {status ? <Box sx={{ mt: 0.5 }}><PresentationStatusChip status={status} /></Box> : null}
        </Box>
      </Stack>
    </Paper>
  );
}

export function OutputCatalogCard({ item, selected, onSelect, icon }) {
  return (
    <Paper
      elevation={0}
      onClick={onSelect}
      sx={{
        p: 1.15,
        cursor: "pointer",
        height: "100%",
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${selected ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider}`,
        bgcolor: selected ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
        boxShadow: TOURNAMENT_ELEVATION.card,
      }}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
        <Box sx={{ color: selected ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.textMuted, display: "flex", mt: 0.2 }}>{icon}</Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>{item.label}</Typography>
          <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>{item.hint}</Typography>
          <Box sx={{ mt: 0.5 }}><PresentationStatusChip status={item.status} /></Box>
        </Box>
      </Stack>
    </Paper>
  );
}

export function LifecycleStepper({ current }) {
  const steps = ["Kết quả cuối", "Giải thưởng", "Hoàn tất nội dung", "Mức sẵn sàng hoàn tất", "Giải đấu hoàn tất"];
  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mb: 1.5 }}>
      {steps.map((step, index) => (
        <Typography
          key={step}
          sx={{
            fontSize: 11,
            fontWeight: step === current ? 800 : 600,
            color: step === current ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.textMuted,
          }}
        >
          {step}{index < steps.length - 1 ? " →" : ""}
        </Typography>
      ))}
    </Stack>
  );
}

export function DeviceRow({ device }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start", justifyContent: "space-between", py: 0.6 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{device.name}</Typography>
        <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>{device.context}</Typography>
      </Box>
      <PresentationStatusChip status={device.status} />
    </Stack>
  );
}
