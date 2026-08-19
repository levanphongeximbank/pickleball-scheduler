import { Box, Button, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceOperatorCard from "../visual/ExperienceOperatorCard.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import { TOURNAMENT_COLOR, TOURNAMENT_ELEVATION, TOURNAMENT_RADIUS } from "../visual/tournamentExperienceTokens.js";
import { displayBracketRoundLabel, displayCompetitorLabel, matchStatusLabel, matchStatusTone } from "./labels.js";

export function StageSelector({ value, onChange, items }) {
  return <ExperienceChipRow value={value} onChange={onChange} items={items} />;
}

export function GroupSelector({ value, onChange, items }) {
  return <ExperienceChipRow value={value} onChange={onChange} items={items} />;
}

export function QualificationStatus({ state, label }) {
  const tone = state === "qualified" ? "success" : state === "eliminated" ? "danger" : state === "contention" ? "warning" : "info";
  return <ExperienceStatusChip tone={tone} label={label || "Chưa cấu hình"} />;
}

export function CompetitionProgress({ current, total, label = "Tiến độ", remainingLabel }) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  const remaining = Math.max(0, (total || 0) - (current || 0));
  return (
    <Box sx={{ mb: 1.25 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
          {current}/{total} • {pct}%{remainingLabel ? ` • ${remainingLabel.replace("{n}", String(remaining))}` : ""}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6,
          borderRadius: 99,
          bgcolor: TOURNAMENT_COLOR.divider,
          "& .MuiLinearProgress-bar": { bgcolor: TOURNAMENT_COLOR.primary, borderRadius: 99 },
        }}
      />
    </Box>
  );
}

export function CompetitionContextHeader({ tournament, event, stage, group, day, extra }) {
  return (
    <ExperienceOperatorCard sx={{ mb: 1.5, bgcolor: TOURNAMENT_COLOR.primarySurface, borderColor: TOURNAMENT_COLOR.primary }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary, letterSpacing: 0.4 }}>
        NGỮ CẢNH THI ĐẤU
      </Typography>
      <Typography sx={{ fontWeight: 800 }}>{tournament}</Typography>
      <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
        {[event, stage, group ? `Bảng ${group}` : null, day, extra].filter(Boolean).join(" • ")}
      </Typography>
    </ExperienceOperatorCard>
  );
}

export function StandingsTable({ rows }) {
  return (
    <Paper elevation={0} sx={{ mb: 1.5, overflow: "auto", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
      <Table size="small" sx={{ minWidth: 560, "& .MuiTableCell-root": { py: 0.65 } }}>
        <TableHead>
          <TableRow>
            {["#", "Cặp", "P", "W", "L", "Pts", "Diff", "Đi tiếp"].map((h) => (
              <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700 }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.rank}-${row.pair}`}>
              <TableCell>{row.rank}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{row.pair}</TableCell>
              <TableCell>{row.played}</TableCell>
              <TableCell>{row.won}</TableCell>
              <TableCell>{row.lost}</TableCell>
              <TableCell>{row.points}</TableCell>
              <TableCell>{row.diff}</TableCell>
              <TableCell>
                <QualificationStatus state={row.qualState} label={row.qualLabel} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

export function SelectedMatchDetail({ match, onClose, compact = false }) {
  if (!match) {
    return (
      <ExperienceOperatorCard>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Trận đang chọn</Typography>
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
          Chọn một trận trên danh sách để xem chi tiết. Màn này không ghi điểm.
        </Typography>
      </ExperienceOperatorCard>
    );
  }
  return (
    <ExperienceOperatorCard>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary }}>TRẬN {match.id}</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{match.id}</Typography>
        </Box>
        <ExperienceStatusChip tone={matchStatusTone(match.status)} label={matchStatusLabel(match.status)} />
      </Stack>
      <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>
        {match.event}
        <br />
        {match.stage}{match.group && match.group !== "—" ? ` · Bảng ${match.group}` : ""}
        <br />
        {match.court} • {match.time}
      </Typography>
      <Box sx={{ py: 1, borderTop: `1px solid ${TOURNAMENT_COLOR.divider}`, borderBottom: `1px solid ${TOURNAMENT_COLOR.divider}`, mb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{match.a}</Typography>
        <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, my: 0.35 }}>vs</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{match.b}</Typography>
      </Box>
      {match.games?.length ? (
        <Stack spacing={0.35} sx={{ mb: 1 }}>
          {match.games.map((game) => (
            <Typography key={game.set} sx={{ fontSize: 13, fontWeight: 700 }}>
              Set {game.set}: {game.a}–{game.b}
            </Typography>
          ))}
        </Stack>
      ) : (
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: match.status === "live" ? TOURNAMENT_COLOR.live : TOURNAMENT_COLOR.text, mb: 1 }}>
          {match.score}
        </Typography>
      )}
      <Typography sx={{ fontSize: 12.5, mb: 1 }}>Trọng tài: {match.referee || "—"}</Typography>
      {match.timeline?.length ? (
        <>
          <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.4 }}>Diễn biến</Typography>
          {match.timeline.map((item) => (
            <Typography key={`${item.time}-${item.text}`} sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
              {item.time} — {item.text}
            </Typography>
          ))}
        </>
      ) : null}
      <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 1, mb: 0.4 }}>Sự cố</Typography>
      {match.issues?.length ? match.issues.map((issue) => (
        <Typography key={issue} sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>{issue}</Typography>
      )) : (
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.success }}>Không có sự cố</Typography>
      )}
      <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted, mt: 1.25 }}>
        Danh sách / xem / mở trận. Ghi điểm thuộc màn trọng tài.
      </Typography>
      <Button
        size="small"
        variant="outlined"
        sx={{ mt: 1 }}
        disabled={!match.refereeLaunchTo}
        component={match.refereeLaunchTo ? RouterLink : "button"}
        to={match.refereeLaunchTo || undefined}
      >
        Mở bảng điểm trọng tài
      </Button>
      {onClose && compact ? (
        <Button size="small" sx={{ mt: 1, ml: 1 }} onClick={onClose}>Đóng</Button>
      ) : null}
    </ExperienceOperatorCard>
  );
}

export function MiniProgression({ round }) {
  const trees = {
    R32: [["R32-1", "R32-2", "R16-1"], ["R32-3", "R32-4", "R16-2"]],
    R16: [["R16-1", "R16-2", "QF1"], ["R16-3", "R16-4", "QF2"]],
    QF: [["QF1", "QF2", "SF1"], ["QF3", "QF4", "SF2"]],
    SF: [["SF1", "SF2", "Chung kết"]],
    Final: [["Chung kết", null, "Vô địch"]],
  };
  const groups = trees[round] || trees.QF;
  return (
    <Stack spacing={1.25}>
      {groups.map((trio) => (
        <ProgressionFork key={trio.join("-")} top={trio[0]} bottom={trio[1]} next={trio[2]} />
      ))}
    </Stack>
  );
}

function ProgressionFork({ top, bottom, next }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 18px minmax(0,1fr)", alignItems: "center" }}>
      <Stack spacing={0.5}>
        <ProgressionNode label={top} />
        {bottom ? <ProgressionNode label={bottom} /> : <Box sx={{ height: 28 }} />}
      </Stack>
      <Box
        sx={{
          height: bottom ? 36 : 2,
          borderRight: `2px solid ${TOURNAMENT_COLOR.primary}`,
          borderTop: bottom ? `2px solid ${TOURNAMENT_COLOR.primary}` : "none",
          borderBottom: bottom ? `2px solid ${TOURNAMENT_COLOR.primary}` : "none",
          mx: "auto",
          width: 10,
        }}
      />
      <ProgressionNode label={next} emphasis />
    </Box>
  );
}

function ProgressionNode({ label, emphasis }) {
  return (
    <Box
      sx={{
        px: 1,
        py: 0.4,
        borderRadius: 1,
        border: `1px solid ${emphasis ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider}`,
        bgcolor: emphasis ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
        fontSize: 12,
        fontWeight: emphasis ? 800 : 600,
        color: emphasis ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.text,
      }}
    >
      {label}
    </Box>
  );
}

export function BracketMatchNode({ match, champion = false }) {
  if (!match) return null;
  const status = match.status || "upcoming";
  const border = champion
    ? TOURNAMENT_COLOR.primary
    : status === "live"
      ? TOURNAMENT_COLOR.live
      : status === "completed"
        ? TOURNAMENT_COLOR.success
        : TOURNAMENT_COLOR.divider;
  const aWin = match.winner === "a";
  const bWin = match.winner === "b";
  return (
    <Box
      sx={{
        minWidth: 168,
        maxWidth: 220,
        p: 1,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `${champion ? 2 : 1}px solid ${border}`,
        bgcolor: champion ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
        boxShadow: TOURNAMENT_ELEVATION.card,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.4, gap: 0.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 800 }}>{champion ? "VÔ ĐỊCH" : match.id}</Typography>
        {champion ? null : <ExperienceStatusChip tone={matchStatusTone(status)} label={matchStatusLabel(status)} />}
      </Stack>
      <Typography sx={{ fontSize: 12.5, fontWeight: aWin || champion ? 800 : 500, color: bWin ? TOURNAMENT_COLOR.textMuted : TOURNAMENT_COLOR.text }}>
        {displayCompetitorLabel(match.a)}
      </Typography>
      {champion ? null : (
        <Typography sx={{ fontSize: 12.5, fontWeight: bWin ? 800 : 500, color: aWin ? TOURNAMENT_COLOR.textMuted : TOURNAMENT_COLOR.text }}>
          {displayCompetitorLabel(match.b)}
        </Typography>
      )}
      <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, mt: 0.35 }}>
        {[match.bye ? "Miễn đi tiếp" : null, match.score && match.score !== "—" ? match.score : null].filter(Boolean).join(" • ")}
      </Typography>
    </Box>
  );
}

export function BracketColumn({ title, matches, showConnectors = true }) {
  const displayTitle = displayBracketRoundLabel(title);
  const leaves = Math.max(matches.length * 2, 2);
  const span = Math.max(1, Math.round(Math.max(leaves, 2) / Math.max(matches.length, 1)));
  const slot = 108;
  const columnHeight = Math.max(leaves, 2) * slot;

  const nextIdForPair = (pairIndex, pairStart) => {
    if (pairStart?.advancesTo) return pairStart.advancesTo;
    if (title === "R32") return `R16-${pairIndex + 1}`;
    if (title === "R16") return `QF${pairIndex + 1}`;
    if (title === "QF") return `SF${pairIndex + 1}`;
    if (title === "SF") return "Final";
    if (title === "Final") return "Champion";
    return `next-${pairIndex + 1}`;
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minWidth: 196, flex: "0 0 auto" }}>
      <Typography sx={{ fontWeight: 800, mb: 1, fontSize: 13 }}>{displayTitle}</Typography>
      <Box sx={{ position: "relative", height: columnHeight, minHeight: columnHeight }}>
        {matches.map((match, index) => {
          const top = index * span * slot;
          const pairIndex = Math.floor(index / 2);
          const isPairStart = index % 2 === 0 && showConnectors && matches[index + 1];
          const nextId = isPairStart ? nextIdForPair(pairIndex, match) : null;
          const forkHeight = span * slot;
          return (
            <Box
              key={match.id}
              sx={{
                position: "absolute",
                top,
                left: 0,
                right: showConnectors ? 16 : 0,
                height: span * slot,
                display: "flex",
                alignItems: "center",
              }}
            >
              <BracketMatchNode match={match} champion={title === "Champion"} />
              {isPairStart ? (
                <Box
                  aria-label={`${match.id} + ${matches[index + 1].id} → ${nextId}`}
                  data-testid={`bracket-connector-${match.id}-${matches[index + 1].id}-${nextId}`}
                  sx={{
                    position: "absolute",
                    right: 0,
                    top: "50%",
                    height: forkHeight,
                    width: 14,
                    borderRight: `2px solid ${TOURNAMENT_COLOR.primary}`,
                    borderTop: `2px solid ${TOURNAMENT_COLOR.primary}`,
                    borderBottom: `2px solid ${TOURNAMENT_COLOR.primary}`,
                    pointerEvents: "none",
                  }}
                />
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export function ScheduleCell({ cell }) {
  if (!cell || cell.status === "empty") {
    return <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>—</Typography>;
  }
  const color =
    cell.status === "live"
      ? TOURNAMENT_COLOR.live
      : cell.status === "conflict"
        ? TOURNAMENT_COLOR.warning
        : cell.status === "completed"
          ? TOURNAMENT_COLOR.success
          : TOURNAMENT_COLOR.text;
  return (
    <Box>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color }}>{cell.match || cell.label}</Typography>
      {cell.meta ? (
        <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{cell.meta}</Typography>
      ) : null}
    </Box>
  );
}

export function ExperienceMatchCard({ match, selected, onClick }) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 1.25,
        mb: 1,
        cursor: onClick ? "pointer" : "default",
        border: `1px solid ${selected ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider}`,
        bgcolor: selected ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.4 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{match.id}</Typography>
        <ExperienceStatusChip tone={matchStatusTone(match.status)} label={matchStatusLabel(match.status)} />
      </Stack>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{match.a} vs {match.b}</Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        {[match.time, match.court, match.score].filter(Boolean).join(" • ")}
      </Typography>
    </Paper>
  );
}
