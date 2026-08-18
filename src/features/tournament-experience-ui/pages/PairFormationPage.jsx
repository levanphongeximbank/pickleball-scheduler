import { useMemo, useState } from "react";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Button, Box, Grid, LinearProgress, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import { ChipRow, FixtureAuthorityNote, ReadinessPanel } from "../components/prototypeSurfaces.jsx";
import { FormationPairCard, OperatorCard } from "../components/prototypeCards.jsx";
import { TOURNAMENT_COLOR } from "../design/tournamentDesignTokens.js";
import {
  FIXTURE_FORMATION_MODES,
  FIXTURE_FORMATION_PAIRS,
  FIXTURE_FORMATION_PARTICIPANTS,
} from "../fixtures/opsFixture.js";
import { FIXTURE_TOURNAMENT_ID, getFixtureTournament } from "../fixtures/prototypeFixture.js";
import { tournamentPath } from "../navigation/tournamentNav.js";

const MODES = [
  { id: "together", label: "Đăng ký cùng" },
  { id: "manual", label: "BTC ghép thủ công" },
  { id: "random", label: "Ghép ngẫu nhiên" },
  { id: "rating", label: "Cân bằng Rating" },
  { id: "draft", label: "Chọn theo lượt" },
  { id: "hybrid", label: "Kết hợp" },
];

const TOTAL_PARTICIPANTS = 14;

export default function PairFormationPage() {
  const tournament = getFixtureTournament();
  const [mode, setMode] = useState("manual");
  const [unpaired, setUnpaired] = useState(FIXTURE_FORMATION_PARTICIPANTS);
  const [pairs, setPairs] = useState(FIXTURE_FORMATION_PAIRS);
  const [selected, setSelected] = useState([]);
  const [formationLocked, setFormationLocked] = useState(false);

  const pairedCount = pairs.length * 2;
  const unpairedCount = unpaired.length;
  const progressPct = Math.round((pairedCount / TOTAL_PARTICIPANTS) * 100);
  const notReady = unpairedCount > 0 || pairs.some((p) => p.status === "Warning");
  const canLockFormation = !notReady && !formationLocked;
  const canGoDraw = formationLocked;

  const readinessItems = useMemo(() => [
    { label: "Tất cả VĐV đã ghép", ready: unpairedCount === 0, note: unpairedCount ? `${unpairedCount} VĐV chưa ghép` : "Đạt" },
    { label: "Không cặp không hợp lệ", ready: !pairs.some((p) => p.status === "Warning"), note: pairs.some((p) => p.status === "Warning") ? "1 cặp cảnh báo Rating" : "Đạt" },
    { label: "Đã chốt cặp / đội", ready: formationLocked, note: formationLocked ? "Đã chốt" : "Chưa chốt cặp/đội" },
  ], [unpairedCount, pairs, formationLocked]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 2) return [id];
      return [...prev, id];
    });
  };

  const createPair = () => {
    if (selected.length !== 2) return;
    const a = unpaired.find((p) => p.id === selected[0]);
    const b = unpaired.find((p) => p.id === selected[1]);
    if (!a || !b) return;
    const newPair = {
      id: `PAIR-${String(pairs.length + 1).padStart(2, "0")}`,
      a: a.name,
      b: b.name,
      mode: FIXTURE_FORMATION_MODES[mode].label,
      seed: pairs.length + 10,
      ratingA: a.rating,
      ratingB: b.rating,
      combined: Number((a.rating + b.rating).toFixed(2)),
      source: "BTC",
      status: Math.abs(a.rating - b.rating) > 0.15 ? "Warning" : "Valid",
    };
    setPairs((prev) => [...prev, newPair]);
    setUnpaired((prev) => prev.filter((p) => p.id !== a.id && p.id !== b.id));
    setSelected([]);
  };

  return (
    <TournamentExperienceShell
      title="Hình thành cặp / đội"
      subtitle="Ghép cặp / đội do BTC — không phải phòng bốc thăm"
      showEventContext
      actions={
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button variant="outlined" size="small" startIcon={<LockOutlinedIcon />} disabled={!canLockFormation} onClick={() => setFormationLocked(true)}>
            Chốt cặp / đội
          </Button>
          {canGoDraw ? (
            <Button component={RouterLink} to={tournamentPath(FIXTURE_TOURNAMENT_ID, "pair-draw")} variant="contained" size="small">
              Sang bốc thăm ghép
            </Button>
          ) : (
            <Button variant="contained" size="small" disabled>
              Sang bốc thăm ghép
            </Button>
          )}
        </Stack>
      }
    >
      <FixtureAuthorityNote>Màn này không tạo quyền hình thành cặp thật.</FixtureAuthorityNote>
      <OperatorCard sx={{ mb: 1.5, bgcolor: TOURNAMENT_COLOR.primarySurface, borderColor: TOURNAMENT_COLOR.primary }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary }}>NGỮ CẢNH HÌNH THÀNH CẶP / ĐỘI</Typography>
        <Typography sx={{ fontWeight: 800 }}>{tournament.name}</Typography>
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Nội dung: Đôi nam 3.5 • Cách ghép: {FIXTURE_FORMATION_MODES[mode].label}</Typography>
      </OperatorCard>
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, md: true }}><TournamentKpiCard label="Tổng VĐV" value={TOTAL_PARTICIPANTS} /></Grid>
        <Grid size={{ xs: 6, md: true }}><TournamentKpiCard label="Đã ghép" value={pairedCount} tone="success" /></Grid>
        <Grid size={{ xs: 6, md: true }}><TournamentKpiCard label="Chưa ghép" value={unpairedCount} tone={unpairedCount ? "warning" : "success"} /></Grid>
        <Grid size={{ xs: 6, md: true }}><TournamentKpiCard label="Cặp hình thành" value={pairs.length} /></Grid>
        <Grid size={{ xs: 6, md: true }}><TournamentKpiCard label="Cảnh báo" value={pairs.filter((p) => p.status === "Warning").length} tone="warning" /></Grid>
      </Grid>
      <BoxProgress label="Tiến độ hình thành cặp" pct={progressPct} />
      <ChipRow value={mode} onChange={setMode} items={MODES} />
      <OperatorCard sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: TOURNAMENT_COLOR.primary, mb: 0.5 }}>Tác động cách ghép</Typography>
        <Typography sx={{ fontSize: 13 }}>{FIXTURE_FORMATION_MODES[mode].impact}</Typography>
      </OperatorCard>
      <TournamentWorkspace
        rail={
          <>
            <ReadinessPanel
              title={notReady ? "Chưa sẵn sàng hình thành cặp" : "Sẵn sàng chốt cặp/đội"}
              statusLabel={notReady ? `CHƯA SẴN SÀNG • ${unpairedCount + (pairs.some((p) => p.status === "Warning") ? 1 : 0)}` : "SẴN SÀNG"}
              statusTone={notReady ? "warning" : "success"}
              items={readinessItems}
              lockLabel="Chốt cặp / đội"
              lockDisabled={!canLockFormation}
              onLock={() => setFormationLocked(true)}
            />
            <TournamentRightRailCard title="Cảnh báo">
              {unpairedCount ? <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>{unpairedCount} VĐV chưa ghép</Typography> : null}
              {pairs.some((p) => p.status === "Warning") ? (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>1 cặp vượt ngưỡng rating</Typography>
              ) : null}
              {!notReady ? <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.success }}>Đủ điều kiện chốt cặp / đội</Typography> : null}
            </TournamentRightRailCard>
          </>
        }
      >
        <Grid container spacing={1.25}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <TournamentSectionTitle>Chưa ghép ({unpairedCount})</TournamentSectionTitle>
            <Stack spacing={1}>
              {unpaired.map((player) => (
                <OperatorCard
                  key={player.id}
                  sx={{
                    cursor: "pointer",
                    borderColor: selected.includes(player.id) ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider,
                    bgcolor: selected.includes(player.id) ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
                  }}
                  onClick={() => !formationLocked && toggleSelect(player.id)}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{player.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                    {player.club} • Rating {player.rating} • Seed {player.seed}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{player.status}</Typography>
                </OperatorCard>
              ))}
            </Stack>
            <Button variant="contained" size="small" sx={{ mt: 1 }} disabled={selected.length !== 2 || formationLocked} onClick={createPair}>
              Tạo cặp ({selected.length}/2)
            </Button>
          </Grid>
          <Grid size={{ xs: 12, lg: 7 }}>
            <TournamentSectionTitle>Cặp đã hình thành ({pairs.length})</TournamentSectionTitle>
            <Grid container spacing={1}>
              {pairs.map((pair) => (
                <Grid key={pair.id} size={{ xs: 12, sm: 6 }}>
                  <FormationPairCard pair={pair} />
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}

function BoxProgress({ label, pct }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{pct}%</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 99, bgcolor: TOURNAMENT_COLOR.divider, "& .MuiLinearProgress-bar": { bgcolor: TOURNAMENT_COLOR.primary } }} />
    </Box>
  );
}
