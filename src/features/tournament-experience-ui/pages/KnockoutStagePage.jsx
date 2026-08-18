import { useMemo, useState } from "react";
import { Button, Grid, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import {
  CompetitionContextHeader,
  CompetitionProgress,
  MiniProgression,
  StageSelector,
} from "../components/competitionSurfaces.jsx";
import { ReadinessPanel } from "../components/prototypeSurfaces.jsx";
import { MatchCard } from "../components/prototypeCards.jsx";
import { TOURNAMENT_COLOR } from "../design/tournamentDesignTokens.js";
import { displayBracketRoundLabel } from "../copy/uiDisplayLabels.js";
import { FIXTURE_KO_MATCHES, FIXTURE_KO_ROUNDS } from "../fixtures/opsFixture.js";
import { FIXTURE_TOURNAMENT_ID, getFixtureTournament } from "../fixtures/prototypeFixture.js";
import { tournamentPath } from "../navigation/tournamentNav.js";

export default function KnockoutStagePage() {
  const tournament = getFixtureTournament();
  const [round, setRound] = useState("QF");
  const matches = (FIXTURE_KO_MATCHES[round] || []).map((match) => ({
    ...match,
    event: "Đôi nam 3.5",
    stage: displayBracketRoundLabel(round),
    group: "—",
    referee: match.status === "attention" ? "Chưa gán" : "Trọng tài Mai",
  }));
  const kpis = useMemo(() => ({
    total: matches.length,
    completed: matches.filter((m) => m.status === "completed").length,
    live: matches.filter((m) => m.status === "live").length,
    upcoming: matches.filter((m) => m.status === "upcoming").length,
    attention: matches.filter((m) => m.status === "attention").length,
  }), [matches]);
  const nextRound = FIXTURE_KO_ROUNDS[FIXTURE_KO_ROUNDS.indexOf(round) + 1] || "Champion";
  const roundReady = kpis.attention === 0 && kpis.live === 0 && kpis.upcoming === 0;

  return (
    <TournamentExperienceShell
      title="Vòng loại trực tiếp"
      subtitle="Xem theo vòng — không phải sơ đồ nhánh đấu"
      showEventContext
      actions={
        <Button component={RouterLink} to={tournamentPath(FIXTURE_TOURNAMENT_ID, "bracket")} size="small" variant="outlined">
          Sơ đồ nhánh đấu
        </Button>
      }
    >
      <CompetitionContextHeader
        tournament={tournament.name}
        event="Đôi nam 3.5"
        stage={`Loại trực tiếp • ${displayBracketRoundLabel(round)}`}
      />
      <StageSelector
        value={round}
        onChange={setRound}
        items={FIXTURE_KO_ROUNDS.map((id) => ({ id, label: displayBracketRoundLabel(id) }))}
      />
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Tổng trận" value={kpis.total} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Hoàn tất" value={kpis.completed} tone="success" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Đang thi đấu" value={kpis.live} tone="live" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Sắp tới" value={kpis.upcoming} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Cần xử lý" value={kpis.attention} tone="warning" /></Grid>
      </Grid>
      <CompetitionProgress current={kpis.completed} total={kpis.total} label={`Tiến độ ${displayBracketRoundLabel(round)}`} remainingLabel="Còn {n}" />
      <TournamentWorkspace
        rail={
          <>
            <TournamentRightRailCard title="Tiến độ vòng">
              <Typography sx={{ fontSize: 12.5 }}>{kpis.completed}/{kpis.total} trận {displayBracketRoundLabel(round)} hoàn tất</Typography>
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Đang thi đấu {kpis.live} • Sắp tới {kpis.upcoming}</Typography>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Tiến vào vòng sau">
              <MiniProgression round={round} />
              <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 1 }}>
                Thắng {round} → vào {nextRound}.
              </Typography>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Cần xử lý" priority={kpis.attention > 0}>
              {kpis.attention ? (
                matches.filter((m) => m.status === "attention").map((m) => (
                  <Typography key={m.id} sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>{m.id} • {m.court}</Typography>
                ))
              ) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.success }}>Không có trận cần xử lý</Typography>
              )}
            </TournamentRightRailCard>
            <ReadinessPanel
              title="Mức sẵn sàng vòng tiếp"
              statusLabel={roundReady ? "SẴN SÀNG" : `CHƯA SẴN SÀNG • ${kpis.live + kpis.upcoming + kpis.attention}`}
              statusTone={roundReady ? "success" : "warning"}
              items={[
                { label: `${round} hoàn tất`, ready: kpis.completed === kpis.total, note: `${kpis.completed}/${kpis.total}` },
                { label: "Không trận đang thi đấu / cần xử lý", ready: kpis.live === 0 && kpis.attention === 0, note: kpis.live || kpis.attention ? "Còn trận mở" : "Đạt" },
                { label: `Sẵn sàng cho ${nextRound}`, ready: roundReady, note: roundReady ? "Có thể chuyển" : "Chưa đủ" },
              ]}
            />
          </>
        }
      >
        <TournamentSectionTitle>Tất cả trận {round}</TournamentSectionTitle>
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
