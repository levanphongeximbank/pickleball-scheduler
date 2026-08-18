import { useMemo, useState } from "react";
import { Button, Grid, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import {
  CompetitionContextHeader,
  CompetitionProgress,
  GroupSelector,
  QualificationStatus,
  StandingsTable,
} from "../components/competitionSurfaces.jsx";
import { MatchCard, OperatorCard } from "../components/prototypeCards.jsx";
import { TOURNAMENT_COLOR } from "../design/tournamentDesignTokens.js";
import { FIXTURE_GROUPS, FIXTURE_MATCH_REGISTRY, FIXTURE_STANDINGS_BY_GROUP } from "../fixtures/opsFixture.js";
import { FIXTURE_TOURNAMENT_ID, getFixtureTournament } from "../fixtures/prototypeFixture.js";
import { tournamentPath } from "../navigation/tournamentNav.js";

const GROUP_COURTS = {
  A: ["Sân 2", "Sân 3"],
  B: ["Sân 5"],
  C: ["Sân 6", "Sân 7"],
  D: ["Sân 8"],
};

export default function GroupStagePage() {
  const tournament = getFixtureTournament();
  const [group, setGroup] = useState("A");
  const spec = FIXTURE_GROUPS.find((item) => item.id === group);
  const standings = useMemo(() => FIXTURE_STANDINGS_BY_GROUP[group] || [], [group]);
  const matches = FIXTURE_MATCH_REGISTRY.filter((row) => row.group === group);
  const liveMatch = matches.find((row) => row.status === "live");
  const nextMatch = matches.find((row) => row.status === "upcoming" || row.status === "attention");
  const qualCounts = useMemo(() => ({
    qualified: standings.filter((row) => row.qualState === "qualified").length,
    contention: standings.filter((row) => row.qualState === "contention").length,
    eliminated: standings.filter((row) => row.qualState === "eliminated").length,
  }), [standings]);
  const totalMatches = spec.played + spec.remaining;

  return (
    <TournamentExperienceShell
      title="Vòng bảng"
      subtitle="Bảng điều hành một bảng — không phải màn Kết quả & BXH"
      showEventContext
      actions={
        <Button component={RouterLink} to={tournamentPath(FIXTURE_TOURNAMENT_ID, "standings")} size="small" variant="outlined">
          Kết quả & BXH
        </Button>
      }
    >
      <CompetitionContextHeader
        tournament={tournament.name}
        event="Đôi nam 3.5"
        stage="Vòng bảng"
        group={group}
      />
      <GroupSelector
        value={group}
        onChange={setGroup}
        items={FIXTURE_GROUPS.map((item) => ({ id: item.id, label: item.name }))}
      />
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, md: 3 }}><TournamentKpiCard label="Cặp" value={spec.pairs} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><TournamentKpiCard label="Đã đấu" value={spec.played} tone="success" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><TournamentKpiCard label="Còn lại" value={spec.remaining} tone="warning" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><TournamentKpiCard label="Điều kiện đi tiếp" value={spec.qualified} hint="Top 4" /></Grid>
      </Grid>
      <CompetitionProgress current={spec.played} total={totalMatches} label="Tiến độ bảng" remainingLabel="Còn {n} trận" />
      <TournamentWorkspace
        rail={
          <>
            <TournamentRightRailCard title="TIẾN ĐỘ BẢNG">
              <Typography sx={{ fontSize: 12.5 }}>{spec.played}/{totalMatches} trận hoàn tất</Typography>
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mt: 0.5 }}>
                Đang thi đấu: {liveMatch ? liveMatch.id : "—"}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                Tiếp theo: {nextMatch ? `${nextMatch.id} • ${nextMatch.time} • ${nextMatch.court}` : "—"}
              </Typography>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="ĐIỀU KIỆN ĐI TIẾP">
              <Stack spacing={0.6}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <QualificationStatus state="qualified" />
                  <Typography sx={{ fontSize: 12.5 }}>{qualCounts.qualified} cặp</Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <QualificationStatus state="contention" />
                  <Typography sx={{ fontSize: 12.5 }}>{qualCounts.contention} cặp</Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <QualificationStatus state="eliminated" />
                  <Typography sx={{ fontSize: 12.5 }}>{qualCounts.eliminated} cặp</Typography>
                </Stack>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.5 }}>
                  Top 4 vào R16. Màn Kết quả & BXH khóa bảng xếp hạng toàn nội dung.
                </Typography>
              </Stack>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="TỔNG HỢP SÂN">
              <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Đã gán: {GROUP_COURTS[group].join(", ")}</Typography>
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mt: 0.5 }}>
                Bảng {group} dùng {GROUP_COURTS[group].length} sân trong cụm Nam Long — không chiếm cả 12 sân.
              </Typography>
            </TournamentRightRailCard>
          </>
        }
      >
        <TournamentSectionTitle>Bảng xếp hạng bảng {group}</TournamentSectionTitle>
        <StandingsTable rows={standings} />
        <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <OperatorCard>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.live }}>HIỆN TẠI / ĐANG THI ĐẤU</Typography>
              {liveMatch ? (
                <>
                  <Typography sx={{ fontWeight: 800 }}>{liveMatch.id} • {liveMatch.court}</Typography>
                  <Typography sx={{ fontSize: 13 }}>{liveMatch.a} vs {liveMatch.b}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: TOURNAMENT_COLOR.live }}>{liveMatch.score}</Typography>
                </>
              ) : (
                <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>Không có trận đang thi đấu trong bảng này.</Typography>
              )}
            </OperatorCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <OperatorCard>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary }}>TRẬN TIẾP THEO</Typography>
              {nextMatch ? (
                <>
                  <Typography sx={{ fontWeight: 800 }}>{nextMatch.id} • {nextMatch.time}</Typography>
                  <Typography sx={{ fontSize: 13 }}>{nextMatch.a} vs {nextMatch.b}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>{nextMatch.court} • {nextMatch.referee}</Typography>
                </>
              ) : (
                <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>Không còn trận sắp tới.</Typography>
              )}
            </OperatorCard>
          </Grid>
        </Grid>
        <TournamentSectionTitle>Trận bảng {group}</TournamentSectionTitle>
        {matches.length ? matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        )) : (
          <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>Không có trận trong bảng này trên fixture.</Typography>
        )}
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
