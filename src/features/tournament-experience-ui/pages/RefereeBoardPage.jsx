import { useMemo, useState } from "react";
import { Button, Grid, Typography } from "@mui/material";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import { CompetitionContextHeader, StageSelector } from "../components/competitionSurfaces.jsx";
import { RefereeOpsCard } from "../components/liveOpsSurfaces.jsx";
import { ChipRow, FixtureAuthorityNote } from "../components/prototypeSurfaces.jsx";
import { OperatorCard } from "../components/prototypeCards.jsx";
import { FIXTURE_REFEREES, FIXTURE_UNASSIGNED_MATCHES } from "../fixtures/opsFixture.js";
import { FIXTURE_EVENTS, getFixtureTournament } from "../fixtures/prototypeFixture.js";

export default function RefereeBoardPage() {
  const tournament = getFixtureTournament();
  const [status, setStatus] = useState("all");
  const [court, setCourt] = useState("all");
  const [eventId, setEventId] = useState("all");
  const [stage, setStage] = useState("all");
  const [assigned, setAssigned] = useState(null);
  const eventName = FIXTURE_EVENTS.find((item) => item.id === eventId)?.name;

  const rows = FIXTURE_REFEREES.filter((ref) => {
    if (status !== "all" && ref.status !== status) return false;
    if (court !== "all" && ref.court !== court) return false;
    if (eventId !== "all" && ref.event !== eventName) return false;
    if (stage !== "all" && ref.stage !== stage) return false;
    return true;
  });

  const kpis = useMemo(() => ({
    live: FIXTURE_REFEREES.filter((r) => r.status === "LIVE").length,
    available: FIXTURE_REFEREES.filter((r) => r.status === "AVAILABLE").length,
    next: FIXTURE_REFEREES.filter((r) => r.status === "NEXT").length,
    unassigned: FIXTURE_UNASSIGNED_MATCHES.length,
    attention: FIXTURE_REFEREES.filter((r) => r.status === "ATTENTION" || r.issue).length,
  }), []);

  return (
    <TournamentExperienceShell title="Bảng trọng tài" subtitle="Bảng phân công BTC — không phải bảng điểm" showEventContext>
      <FixtureAuthorityNote>phân công trọng tài chỉ là nguyên mẫu.</FixtureAuthorityNote>
      <CompetitionContextHeader tournament={tournament.name} event="Đôi nam 3.5" stage="Vận hành đang diễn ra" />
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Đang thi đấu" value={kpis.live} tone="live" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Sẵn sàng" value={kpis.available} tone="success" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Tiếp theo" value={kpis.next} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Chưa gán" value={kpis.unassigned} tone="warning" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Cần xử lý" value={kpis.attention} tone="warning" /></Grid>
      </Grid>
      <ChipRow
        value={status}
        onChange={setStatus}
        items={[
          { id: "all", label: "Mọi trạng thái" },
          { id: "LIVE", label: "Đang thi đấu" },
          { id: "AVAILABLE", label: "Sẵn sàng" },
          { id: "NEXT", label: "Tiếp theo" },
          { id: "ATTENTION", label: "Cần xử lý" },
        ]}
      />
      <ChipRow
        value={court}
        onChange={setCourt}
        items={[
          { id: "all", label: "Mọi sân" },
          { id: "Sân 1", label: "Sân 1" },
          { id: "Sân 3", label: "Sân 3" },
          { id: "Sân 5", label: "Sân 5" },
          { id: "Sân 7", label: "Sân 7" },
        ]}
      />
      <ChipRow
        value={eventId}
        onChange={setEventId}
        items={[{ id: "all", label: "Mọi nội dung" }, ...FIXTURE_EVENTS.map((item) => ({ id: item.id, label: item.name }))]}
      />
      <StageSelector
        value={stage}
        onChange={setStage}
        items={[
          { id: "all", label: "Mọi vòng" },
          { id: "Vòng bảng", label: "Vòng bảng" },
          { id: "Tứ kết", label: "Tứ kết" },
        ]}
      />
      <TournamentWorkspace
        rail={
          <>
            <TournamentRightRailCard title="Trận chưa có trọng tài" priority>
              {FIXTURE_UNASSIGNED_MATCHES.map((match) => (
                <Typography key={match.id} sx={{ fontSize: 12.5, mb: 0.5 }}>
                  {match.id} • {match.court} • {match.time}
                </Typography>
              ))}
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Xung đột phân công">
              <Typography sx={{ fontSize: 12.5 }}>Trọng tài Phong • C-02 trễ</Typography>
              {assigned ? (
                <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>Gán mẫu: {assigned} → A-19</Typography>
              ) : (
                <Typography sx={{ fontSize: 12.5 }}>A-19 chưa gán</Typography>
              )}
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Trọng tài sẵn sàng">
              {FIXTURE_REFEREES.filter((r) => r.status === "AVAILABLE").map((r) => (
                <Typography key={r.id} sx={{ fontSize: 12.5 }}>{r.name}</Typography>
              ))}
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Cần xử lý">
              {FIXTURE_REFEREES.filter((r) => r.issue).map((r) => (
                <Typography key={r.id} sx={{ fontSize: 12.5 }}>{r.name}: {r.issue}</Typography>
              ))}
            </TournamentRightRailCard>
          </>
        }
      >
        <TournamentSectionTitle>Bảng phân công trọng tài</TournamentSectionTitle>
        <Grid container spacing={1.25}>
          {rows.map((referee) => (
            <Grid key={referee.id} size={{ xs: 12, sm: 6 }}>
              <RefereeOpsCard
                referee={referee}
                onAssign={(ref) => setAssigned(ref.name)}
              />
            </Grid>
          ))}
        </Grid>
        {assigned ? (
          <OperatorCard sx={{ mt: 1.25 }}>
            <Typography sx={{ fontSize: 12.5 }}>Nguyên mẫu: {assigned} đã gán cho A-19. Không ghi dữ liệu thật.</Typography>
            <Button size="small" onClick={() => setAssigned(null)}>Hoàn tác mẫu</Button>
          </OperatorCard>
        ) : null}
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
