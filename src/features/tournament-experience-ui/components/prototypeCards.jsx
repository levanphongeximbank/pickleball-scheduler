import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_RADIUS,
} from "../design/tournamentDesignTokens.js";
import { displayCompetitorLabel } from "../copy/uiDisplayLabels.js";
import TournamentStatusChip from "./TournamentStatusChip.jsx";
import { OpsStatusChip } from "./opsStatusChip.jsx";
import { resolveCourtStatus } from "../liveOps/liveOpsStatus.js";

export function MobileRecordCard({ title, meta, status, action, to, selected, onClick }) {
  return (
    <Paper
      elevation={0}
      component={to ? RouterLink : "div"}
      to={to}
      onClick={onClick}
      sx={{
        p: 1.25,
        mb: 1,
        textDecoration: "none",
        color: "inherit",
        display: "block",
        cursor: onClick || to ? "pointer" : "default",
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${selected ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider}`,
        bgcolor: selected ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 0.4 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{title}</Typography>
        {status}
      </Stack>
      {meta}
      {action}
    </Paper>
  );
}

export function MatchCard({ match, to, selected, onClick }) {
  const source = [match.sourceA, match.sourceB].filter(Boolean).join(" → ");
  return (
    <MobileRecordCard
      to={to}
      selected={selected}
      onClick={onClick}
      title={`${match.id} • ${displayCompetitorLabel(match.a)} vs ${displayCompetitorLabel(match.b)}`}
      status={<OpsStatusChip status={match.status} />}
      meta={
        <>
          <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
            {match.event || "Đôi nam 3.5"} • {match.stage || "Vòng loại trực tiếp"} {match.group && match.group !== "—" ? `• Bảng ${match.group}` : ""}
          </Typography>
          <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
            {[match.time, match.court, match.referee].filter(Boolean).join(" • ")}
          </Typography>
          {source ? (
            <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>Nguồn: {source}</Typography>
          ) : null}
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: match.status === "live" ? TOURNAMENT_COLOR.live : TOURNAMENT_COLOR.text, mt: 0.4 }}>
            {match.score || "—"}
          </Typography>
        </>
      }
    />
  );
}

export function CourtCard({ court, dense = false }) {
  const status = resolveCourtStatus(court);
  return (
    <Paper
      elevation={0}
      sx={{
        p: dense ? 1 : 1.1,
        height: "100%",
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
        borderLeft: `3px solid ${
          status === "LIVE"
            ? TOURNAMENT_COLOR.live
            : status === "DELAY" || status === "ATTENTION"
              ? TOURNAMENT_COLOR.warning
              : status === "MAINTENANCE"
                ? TOURNAMENT_COLOR.danger
                : status === "AVAILABLE"
                  ? TOURNAMENT_COLOR.success
                  : TOURNAMENT_COLOR.primary
        }`,
        boxShadow: TOURNAMENT_ELEVATION.card,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5, gap: 0.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{court.name}</Typography>
        <OpsStatusChip status={status} />
      </Stack>
      <Typography sx={{ fontSize: 12.5 }}>Hiện tại: {court.currentMatch?.id || court.match || "—"}</Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        Tiếp theo: {court.nextMatch ? `${court.nextMatch.id} · ${court.nextMatch.time}` : court.next || "—"}
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>{court.currentMatch?.event || court.event}</Typography>
    </Paper>
  );
}

export function RefereeCard({ referee }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.1,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{referee.name}</Typography>
        <OpsStatusChip status={referee.status} />
      </Stack>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>Hiện tại: {referee.current}</Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>Tiếp: {referee.next}</Typography>
      {referee.issue ? (
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.warning, mt: 0.4 }}>{referee.issue}</Typography>
      ) : null}
    </Paper>
  );
}

export function FormationPairCard({ pair }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.1,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${pair.status === "Warning" ? TOURNAMENT_COLOR.warning : TOURNAMENT_COLOR.divider}`,
        borderLeft: `3px solid ${pair.status === "Warning" ? TOURNAMENT_COLOR.warning : TOURNAMENT_COLOR.primary}`,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.4 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>{pair.id}</Typography>
        <TournamentStatusChip tone={pair.status === "Warning" ? "warning" : "success"} label={pair.status === "Warning" ? "Cảnh báo" : "Hợp lệ"} />
      </Stack>
      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{pair.a} + {pair.b}</Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        {pair.mode} • Hạt giống {pair.seed} • {pair.source}
      </Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        Rating {pair.ratingA} + {pair.ratingB} = {pair.combined}
      </Typography>
    </Paper>
  );
}

export function PairCard({ pair }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.1,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{pair.a} / {pair.b}</Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        {pair.mode} • Hạt giống {pair.seed}
      </Typography>
    </Paper>
  );
}

export function IncidentCard({ item }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.1,
        mb: 1,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
        borderLeft: `3px solid ${item.severity === "danger" ? TOURNAMENT_COLOR.danger : TOURNAMENT_COLOR.warning}`,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{item.title}</Typography>
        <TournamentStatusChip tone={item.severity} label={item.status} />
      </Stack>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{item.affect} • {item.owner}</Typography>
      <Button size="small" sx={{ mt: 0.5 }}>Mở xử lý</Button>
    </Paper>
  );
}

export function OperatorCard({ children, sx }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
        boxShadow: TOURNAMENT_ELEVATION.card,
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

export function MetaLine({ children }) {
  return <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{children}</Typography>;
}

export { Box, Stack, Typography };
