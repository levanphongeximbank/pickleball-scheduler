import {
  Box,
  Button,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "../design/tournamentDesignTokens.js";
import TournamentStatusChip from "./TournamentStatusChip.jsx";
import { DrawPanel } from "./DrawRoomShell.jsx";

export function DrawProgressBar({ current, total, label = "Tiến độ bốc thăm" }) {
  const pct = Math.round((current / total) * 100);
  const remaining = total - current;
  return (
    <DrawPanel title={label}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, mb: 1 }}>
        <Typography sx={{ fontSize: 28, fontWeight: 800, color: "#FFF", lineHeight: 1 }}>
          {current} / {total}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 120 }}>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 8,
              borderRadius: 99,
              bgcolor: "rgba(255,255,255,0.08)",
              "& .MuiLinearProgress-bar": { bgcolor: TOURNAMENT_COLOR.primary, borderRadius: 99 },
            }}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.primaryLight, fontWeight: 700 }}>{pct}%</Typography>
            <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.navyTextMuted }}>Còn {remaining}</Typography>
          </Stack>
        </Box>
      </Stack>
    </DrawPanel>
  );
}

export function DrawPoolList({ title, players, selectedId, onSelect, disabledIds = [] }) {
  return (
    <DrawPanel title={title}>
      <Stack spacing={0.5}>
        {players.map((player) => {
          const disabled = disabledIds.includes(player.id);
          const selected = selectedId === player.id;
          return (
            <Box
              key={player.id}
              onClick={() => !disabled && onSelect?.(player.id)}
              sx={{
                px: 1,
                py: 0.75,
                borderRadius: 1,
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.45 : 1,
                border: `1px solid ${selected ? TOURNAMENT_COLOR.primary : "rgba(255,255,255,0.1)"}`,
                bgcolor: selected ? "rgba(37,99,235,0.2)" : "transparent",
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#FFF" }}>{player.name}</Typography>
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.navyTextMuted }}>
                {player.club} • Rating {player.rating}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </DrawPanel>
  );
}

export function PairDrawHero({ drawNumber, playerA, playerB, valid = true, warning }) {
  return (
    <DrawPanel
      sx={{
        border: `1px solid ${valid ? TOURNAMENT_COLOR.success : TOURNAMENT_COLOR.warning}`,
        bgcolor: "rgba(20,27,36,0.95)",
      }}
    >
      <Stack spacing={0.5} sx={{ textAlign: "center", mb: 1 }}>
        <Typography sx={{ fontSize: 11, letterSpacing: 1.2, color: TOURNAMENT_COLOR.live, fontWeight: 800 }}>
          ĐANG BỐC
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#FFF" }}>CẶP {String(drawNumber).padStart(2, "0")}</Typography>
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: "center", justifyContent: "center" }}>
        <HeroPlayerCard player={playerA} />
        <Typography sx={{ fontSize: 24, fontWeight: 800, color: TOURNAMENT_COLOR.primary }}>+</Typography>
        <HeroPlayerCard player={playerB} />
      </Stack>
      <Stack direction="row" spacing={0.75} sx={{ justifyContent: "center", mt: 1.25, flexWrap: "wrap" }}>
        <TournamentStatusChip tone={valid ? "success" : "warning"} label={valid ? "Hợp lệ" : "Cảnh báo"} />
        {warning ? <TournamentStatusChip tone="warning" label={warning} /> : null}
      </Stack>
    </DrawPanel>
  );
}

function HeroPlayerCard({ player }) {
  if (!player) {
    return (
      <Box sx={{ minWidth: 140, px: 1.5, py: 1, border: "1px dashed rgba(255,255,255,0.2)", borderRadius: 1 }}>
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.navyTextMuted }}>Chờ bốc</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ minWidth: 140, px: 1.5, py: 1, bgcolor: TOURNAMENT_COLOR.drawSurface, borderRadius: 1, border: "1px solid rgba(255,255,255,0.12)" }}>
      <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#FFF" }}>{player.name}</Typography>
      <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.navyTextMuted }}>{player.club}</Typography>
      <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.primaryLight, fontWeight: 700 }}>Rating {player.rating}</Typography>
    </Box>
  );
}

export function GroupDrawHero({ drawNumber, pairName, groupId, position, capacity, valid = true }) {
  return (
    <DrawPanel sx={{ border: `1px solid ${TOURNAMENT_COLOR.success}` }}>
      <Stack spacing={0.5} sx={{ textAlign: "center", mb: 1 }}>
        <Typography sx={{ fontSize: 11, letterSpacing: 1.2, color: TOURNAMENT_COLOR.live, fontWeight: 800 }}>
          ĐANG BỐC
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#FFF" }}>CẶP {String(drawNumber).padStart(2, "0")}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 18, fontWeight: 800, color: TOURNAMENT_COLOR.success, textAlign: "center" }}>
        {pairName}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ justifyContent: "center", alignItems: "center", mt: 1.5 }}>
        <Typography sx={{ fontSize: 28, color: TOURNAMENT_COLOR.primary }}>→</Typography>
        <Box sx={{ textAlign: "center" }}>
          <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#FFF" }}>BẢNG {groupId}</Typography>
          <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.navyTextMuted }}>Vị trí {position}/{capacity}</Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={0.75} sx={{ justifyContent: "center", mt: 1.25 }}>
        <TournamentStatusChip tone={valid ? "success" : "warning"} label={valid ? "Hợp lệ" : "Cảnh báo"} />
      </Stack>
    </DrawPanel>
  );
}

export function DrawLedgerTable({ title, columns, rows }) {
  return (
    <DrawPanel title={title}>
      <Box sx={{ overflow: "auto", maxWidth: "100%" }}>
        <Table size="small" sx={{ minWidth: 480, "& .MuiTableCell-root": { py: 0.55, color: TOURNAMENT_COLOR.navyText, borderColor: "rgba(255,255,255,0.08)" } }}>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col} sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.navyTextMuted }}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {row.cells.map((cell, idx) => (
                  <TableCell key={`${row.id}-${idx}`} sx={{ fontSize: 12.5, color: cell.tone === "success" ? TOURNAMENT_COLOR.success : cell.tone === "warning" ? TOURNAMENT_COLOR.warning : "#FFF", fontWeight: cell.bold ? 700 : 400 }}>
                    {cell.text}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </DrawPanel>
  );
}

export function DrawHistoryList({ title, items }) {
  return (
    <DrawPanel title={title}>
      <Stack spacing={0.6}>
        {items.map((item) => (
          <Box key={`${item.time}-${item.text}`} sx={{ borderBottom: "1px solid rgba(255,255,255,0.06)", pb: 0.5 }}>
            <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.navyTextMuted }}>{item.time}</Typography>
            <Typography sx={{ fontSize: 12.5, color: item.tone === "warning" ? TOURNAMENT_COLOR.warning : "#FFF" }}>{item.text}</Typography>
          </Box>
        ))}
      </Stack>
    </DrawPanel>
  );
}

export function DrawRulesPanel({ title = "Luật / Điều kiện ràng buộc", rules }) {
  return (
    <DrawPanel title={title}>
      <Stack spacing={0.75}>
        {rules.map((rule) => (
          <Stack key={rule.label} direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
            <TournamentStatusChip tone={rule.tone || "info"} label={rule.status || "—"} />
            <Box>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "#FFF" }}>{rule.label}</Typography>
              {rule.note ? <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.navyTextMuted }}>{rule.note}</Typography> : null}
            </Box>
          </Stack>
        ))}
      </Stack>
    </DrawPanel>
  );
}

export function DrawReadinessPanel({ title = "Mức sẵn sàng", items, statusLabel, statusTone }) {
  return (
    <DrawPanel title={title}>
      <Stack direction="row" spacing={0.75} sx={{ mb: 1, alignItems: "center" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#FFF" }}>{title}</Typography>
        {statusLabel ? <TournamentStatusChip tone={statusTone || "warning"} label={statusLabel} /> : null}
      </Stack>
      <Stack spacing={0.6}>
        {items.map((item) => (
          <Typography key={item.label} sx={{ fontSize: 12.5, color: item.ready ? TOURNAMENT_COLOR.success : TOURNAMENT_COLOR.warning }}>
            {item.ready ? "✓" : "⚠"} {item.label}{item.note ? ` — ${item.note}` : ""}
          </Typography>
        ))}
      </Stack>
    </DrawPanel>
  );
}

export function GroupStatusCards({ groups }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
        gap: 1,
      }}
    >
      {groups.map((group) => (
        <DrawPanel key={group.id} title={`Bảng ${group.id} ${group.count}/${group.capacity}`}>
          <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.navyTextMuted, mb: 0.5 }}>
            Seed: {group.seedSummary}
          </Typography>
          <Stack spacing={0.35}>
            {(group.pairs.length ? group.pairs : ["(trống)"]).slice(0, 4).map((name) => (
              <Typography key={name} sx={{ fontSize: 12, color: "#FFF" }}>{name}</Typography>
            ))}
            {group.pairs.length > 4 ? (
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.navyTextMuted }}>+{group.pairs.length - 4} cặp</Typography>
            ) : null}
          </Stack>
        </DrawPanel>
      ))}
    </Box>
  );
}

export function DrawPresentationOverlay({ tournament, event, title, subtitle, hero, progress, sponsor = "PICK_VN Sponsor Slot" }) {
  return (
    <Box
      sx={{
        minHeight: { xs: 420, md: 520 },
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        bgcolor: TOURNAMENT_COLOR.drawBg,
        border: `1px solid rgba(255,255,255,0.08)`,
        p: { xs: 2, md: 3 },
        textAlign: "center",
      }}
    >
      <Typography sx={{ fontSize: 12, letterSpacing: 1.5, color: TOURNAMENT_COLOR.primaryLight, fontWeight: 700 }}>
        PICK_VN TRÌNH CHIẾU
      </Typography>
      <Typography sx={{ fontSize: { xs: 22, md: 32 }, fontWeight: 800, color: "#FFF", mt: 0.5 }}>{tournament}</Typography>
      <Typography sx={{ fontSize: 14, color: TOURNAMENT_COLOR.navyTextMuted, mb: 2 }}>{event}</Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color: TOURNAMENT_COLOR.primary, mb: 1 }}>{title}</Typography>
      {subtitle ? <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.navyTextMuted, mb: 2 }}>{subtitle}</Typography> : null}
      <Box sx={{ maxWidth: 640, mx: "auto" }}>{hero}</Box>
      {progress ? <Box sx={{ maxWidth: 420, mx: "auto", mt: 2 }}>{progress}</Box> : null}
      <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.navyTextMuted, mt: 3, opacity: 0.7 }}>{sponsor}</Typography>
    </Box>
  );
}

export function DrawLifecycleButton({ to, children, disabled }) {
  if (disabled) {
    return (
      <Button size="small" variant="outlined" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button component={RouterLink} to={to} size="small" variant="outlined">
      {children}
    </Button>
  );
}
