import { useMemo, useState } from "react";
import { Grid, Typography } from "@mui/material";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import { CompetitionContextHeader, StageSelector } from "../components/competitionSurfaces.jsx";
import { CourtOpsCard } from "../components/liveOpsSurfaces.jsx";
import { ChipRow, FixtureAuthorityNote } from "../components/prototypeSurfaces.jsx";
import { FIXTURE_COURTS, FIXTURE_WAITING_QUEUE } from "../fixtures/opsFixture.js";
import { FIXTURE_EVENTS, getFixtureTournament } from "../fixtures/prototypeFixture.js";
import { resolveCourtStatus } from "../liveOps/liveOpsStatus.js";

export default function CourtBoardPage() {
  const tournament = getFixtureTournament();
  const [eventId, setEventId] = useState("all");
  const [stage, setStage] = useState("all");
  const [status, setStatus] = useState("all");
  const eventName = FIXTURE_EVENTS.find((item) => item.id === eventId)?.name;

  const courts = FIXTURE_COURTS.filter((court) => {
    const resolved = resolveCourtStatus(court);
    const courtEvent = court.currentMatch?.event || court.nextMatch?.event || court.event;
    const courtStage = court.currentMatch?.stage || court.nextMatch?.stage;
    if (eventId !== "all" && courtEvent !== eventName) return false;
    if (stage !== "all" && courtStage !== stage) return false;
    if (status !== "all" && resolved !== status) return false;
    return true;
  });

  const kpis = useMemo(() => {
    const all = FIXTURE_COURTS.map(resolveCourtStatus);
    return {
      live: all.filter((s) => s === "LIVE").length,
      next: all.filter((s) => s === "NEXT").length,
      available: all.filter((s) => s === "AVAILABLE").length,
      delay: all.filter((s) => s === "DELAY").length,
      maintenance: all.filter((s) => s === "MAINTENANCE").length,
    };
  }, []);

  return (
    <TournamentExperienceShell title="Bảng điều hành sân" subtitle="Sân vật lý — không phải công cụ sân CLB" showEventContext>
      <FixtureAuthorityNote>trạng thái sử dụng sân không tạo quyền vận hành thật. Chọn cụm không chiếm cả 12 sân.</FixtureAuthorityNote>
      <CompetitionContextHeader
        tournament={tournament.name}
        event="Cụm sân Nam Long"
        extra="12 sân vật lý"
      />
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Đang thi đấu" value={kpis.live} tone="live" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Tiếp theo" value={kpis.next} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Sẵn sàng" value={kpis.available} tone="success" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Trễ" value={kpis.delay} tone="warning" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Bảo trì" value={kpis.maintenance} tone="danger" /></Grid>
      </Grid>
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
          { id: "Bán kết", label: "Bán kết" },
        ]}
      />
      <ChipRow
        value={status}
        onChange={setStatus}
        items={[
          { id: "all", label: "Mọi trạng thái" },
          { id: "LIVE", label: "Đang thi đấu" },
          { id: "NEXT", label: "Tiếp theo" },
          { id: "AVAILABLE", label: "Sẵn sàng" },
          { id: "DELAY", label: "Trễ" },
          { id: "MAINTENANCE", label: "Bảo trì" },
        ]}
      />
      <TournamentWorkspace
        rail={
          <>
            <TournamentRightRailCard title="Hàng chờ">
              {FIXTURE_WAITING_QUEUE.map((item) => (
                <Typography key={item.id} sx={{ fontSize: 12.5, mb: 0.5 }}>
                  {item.id} • {item.court} • {item.time} — {item.note}
                </Typography>
              ))}
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Trận bị trễ">
              {FIXTURE_COURTS.filter((court) => resolveCourtStatus(court) === "DELAY").map((court) => (
                <Typography key={court.id} sx={{ fontSize: 12.5 }}>
                  {court.name} • {court.currentMatch?.id} trễ
                </Typography>
              ))}
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Bảo trì">
              <Typography sx={{ fontSize: 12.5 }}>Sân 4 • ETA 12:30</Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Không suy ra cả cụm đang được dùng.</Typography>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Mức sử dụng sân">
              <Typography sx={{ fontSize: 12.5 }}>{kpis.live} đang thi đấu / 12</Typography>
              <Typography sx={{ fontSize: 12.5 }}>{kpis.available} sẵn sàng</Typography>
              <Typography sx={{ fontSize: 12.5 }}>{kpis.next} đang chờ</Typography>
            </TournamentRightRailCard>
          </>
        }
      >
        <TournamentSectionTitle>12 sân vật lý</TournamentSectionTitle>
        <Grid container spacing={1.25}>
          {courts.map((court) => (
            <Grid key={court.id} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
              <CourtOpsCard court={court} />
            </Grid>
          ))}
        </Grid>
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
