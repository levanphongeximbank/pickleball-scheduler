import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_RADIUS,
} from "../design/tournamentDesignTokens.js";
import TournamentStatusChip from "./TournamentStatusChip.jsx";
import { OpsStatusChip } from "./opsStatusChip.jsx";

export function FixtureAuthorityNote({ children }) {
  return (
    <Alert severity="info" sx={{ mb: 1.25, py: 0.4, "& .MuiAlert-message": { fontSize: 12 } }}>
      Chỉ là dữ liệu mẫu — {children}
    </Alert>
  );
}

export function SurfaceState({ state = "ready", emptyText = "Chưa có dữ liệu", children }) {
  if (state === "loading") {
    return (
      <Paper elevation={0} sx={{ p: 2, border: `1px dashed ${TOURNAMENT_COLOR.divider}` }}>
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>Đang tải bề mặt này…</Typography>
      </Paper>
    );
  }
  if (state === "error") {
    return (
      <Alert severity="error" sx={{ mb: 1 }}>
        Không tải được dữ liệu mẫu. Giữ shell, thử lại bề mặt này.
      </Alert>
    );
  }
  if (state === "empty") {
    return (
      <Paper elevation={0} sx={{ p: 2, border: `1px dashed ${TOURNAMENT_COLOR.divider}` }}>
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>{emptyText}</Typography>
      </Paper>
    );
  }
  return children;
}

export function ReadinessPanel({
  title = "Mức sẵn sàng",
  items,
  lockLabel,
  onLock,
  lockDisabled = false,
  statusLabel,
  statusTone,
}) {
  const blocked = items.some((item) => !item.ready);
  const tone = statusTone || (blocked ? "warning" : "success");
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${blocked ? TOURNAMENT_COLOR.warning : TOURNAMENT_COLOR.divider}`,
        bgcolor: blocked ? TOURNAMENT_COLOR.warningSurface : TOURNAMENT_COLOR.cardBg,
        boxShadow: TOURNAMENT_ELEVATION.card,
      }}
    >
      <Stack direction="row" spacing={0.75} sx={{ mb: 1, alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{title}</Typography>
        {statusLabel ? <TournamentStatusChip tone={tone} label={statusLabel} /> : null}
      </Stack>
      <Stack spacing={0.7} sx={{ mb: 1.25 }}>
        {items.map((item) => (
          <Stack key={item.label} direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
            <WarningAmberIcon
              sx={{ fontSize: 14, mt: "2px", color: item.ready ? TOURNAMENT_COLOR.success : TOURNAMENT_COLOR.warning }}
            />
            <Box>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{item.label}</Typography>
              {item.note ? (
                <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{item.note}</Typography>
              ) : null}
            </Box>
          </Stack>
        ))}
      </Stack>
      {lockLabel ? (
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={<LockOutlinedIcon />}
          onClick={onLock}
          disabled={lockDisabled}
          sx={{ color: TOURNAMENT_COLOR.text, borderColor: TOURNAMENT_COLOR.divider }}
        >
          {lockLabel}
        </Button>
      ) : null}
    </Paper>
  );
}

export function ChipRow({ items, value, onChange }) {
  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ mb: 1.25, flexWrap: "wrap" }}>
      {items.map((item) => {
        const id = item.id || item;
        const label = item.label || item;
        const selected = value === id;
        return (
          <Chip
            key={id}
            label={label}
            size="small"
            clickable
            color={selected ? "primary" : "default"}
            variant={selected ? "filled" : "outlined"}
            onClick={() => onChange(id)}
          />
        );
      })}
    </Stack>
  );
}

export function StatusFromCourt({ status }) {
  return <OpsStatusChip status={status} />;
}
