import { useMemo, useState } from "react";
import PublishIcon from "@mui/icons-material/CampaignOutlined";
import { Box, Button, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography, useMediaQuery, useTheme } from "@mui/material";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentStatusChip from "../components/TournamentStatusChip.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import { CompetitionContextHeader, GroupSelector, ScheduleCell, StageSelector } from "../components/competitionSurfaces.jsx";
import { ChipRow, FixtureAuthorityNote, ReadinessPanel, StatusFromCourt } from "../components/prototypeSurfaces.jsx";
import { resolveCourtStatus } from "../liveOps/liveOpsStatus.js";
import { MatchCard, OperatorCard } from "../components/prototypeCards.jsx";
import { TOURNAMENT_COLOR } from "../design/tournamentDesignTokens.js";
import {
  FIXTURE_COURTS,
  FIXTURE_EVENT_ALLOCATED_COURTS,
  FIXTURE_GROUPS,
  FIXTURE_MATCH_REGISTRY,
  FIXTURE_SCHEDULE_CONFLICTS,
  FIXTURE_SCHEDULE_GRID,
  FIXTURE_UNSCHEDULED_MATCHES,
} from "../fixtures/opsFixture.js";
import { FIXTURE_EVENTS, getFixtureTournament } from "../fixtures/prototypeFixture.js";

const DAYS = [
  { id: "d1", label: "Ngày 1 — 20/09" },
  { id: "d2", label: "Ngày 2 — 21/09" },
  { id: "d3", label: "Ngày 3 — 22/09" },
];

function courtDisplayStatus(court) {
  return resolveCourtStatus(court);
}

export default function ScheduleCourtsPage() {
  const theme = useTheme();
  const isGrid = useMediaQuery(theme.breakpoints.up("md"));
  const tournament = getFixtureTournament();
  const [eventId, setEventId] = useState("md-35");
  const [day, setDay] = useState("d1");
  const [stage, setStage] = useState("group");
  const [group, setGroup] = useState("A");
  const [courtFilter, setCourtFilter] = useState("all");
  const [allocatedIds, setAllocatedIds] = useState(FIXTURE_EVENT_ALLOCATED_COURTS);
  const [published, setPublished] = useState(false);
  const eventName = FIXTURE_EVENTS.find((item) => item.id === eventId)?.name || "Đôi nam 3.5";
  const allocatedCourts = FIXTURE_COURTS.filter((court) => allocatedIds.includes(court.id));
  const unscheduledCount = FIXTURE_UNSCHEDULED_MATCHES.length;
  const conflictCount = FIXTURE_SCHEDULE_CONFLICTS.length;
  const courtAllocated = allocatedIds.length;
  const readinessItems = useMemo(() => [
    {
      label: `${courtAllocated}/12 sân vật lý đã phân bổ cho nội dung hiện tại`,
      ready: true,
      note: "Phân bổ theo nội dung — phân bổ hợp lệ",
    },
    {
      label: unscheduledCount === 0 ? "Không còn trận chưa xếp lịch" : `Còn ${unscheduledCount} trận chưa xếp`,
      ready: unscheduledCount === 0,
    },
    {
      label: conflictCount === 0 ? "Đã xử lý hết xung đột" : `Còn ${conflictCount} xung đột`,
      ready: conflictCount === 0,
    },
  ], [conflictCount, courtAllocated, unscheduledCount]);
  const notReady = readinessItems.some((item) => !item.ready);
  const scheduleStatus = published ? "Published" : notReady ? "Draft" : "Ready";
  const scheduleStatusLabel = published ? "Đã công bố" : notReady ? "Bản nháp" : "Sẵn sàng";

  const toggleAlloc = (id) => {
    const court = FIXTURE_COURTS.find((item) => item.id === id);
    if (court?.status === "MAINTENANCE") return;
    setAllocatedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const mobileMatches = [
    ...FIXTURE_MATCH_REGISTRY.filter((row) => row.event === eventName || row.court?.startsWith("Sân")),
    ...FIXTURE_UNSCHEDULED_MATCHES,
  ].filter((match) => courtFilter === "all" || match.court === courtFilter);

  return (
    <TournamentExperienceShell
      title="Lịch thi đấu & Phân sân"
      subtitle="Cụm sân → Sân vật lý → Phân bổ theo nội dung"
      showEventContext
      actions={
        <Button
          variant="contained"
          size="small"
          startIcon={<PublishIcon />}
          disabled={notReady || published}
          onClick={() => setPublished(true)}
        >
          Công bố lịch
        </Button>
      }
    >
      <FixtureAuthorityNote>Phân sân và công bố lịch chỉ là nguyên mẫu. Không tạo quyền thật.</FixtureAuthorityNote>
      <CompetitionContextHeader
        tournament={tournament.name}
        event={eventName}
        stage={stage === "group" ? "Vòng bảng" : "Loại trực tiếp"}
        group={stage === "group" ? group : null}
        day={DAYS.find((item) => item.id === day)?.label}
      />
      <ChipRow value={eventId} onChange={setEventId} items={FIXTURE_EVENTS.map((item) => ({ id: item.id, label: item.name }))} />
      <StageSelector
        value={day}
        onChange={setDay}
        items={DAYS}
      />
      <StageSelector
        value={stage}
        onChange={setStage}
        items={[
          { id: "group", label: "Vòng bảng" },
          { id: "ko", label: "Loại trực tiếp" },
        ]}
      />
      {stage === "group" ? (
        <GroupSelector value={group} onChange={setGroup} items={FIXTURE_GROUPS.map((item) => ({ id: item.id, label: item.name }))} />
      ) : null}

      <OperatorCard sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary }}>CỤM SÂN / ĐỊA ĐIỂM</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Cụm sân Nam Long</Typography>
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>12 sân vật lý</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
          Phân bổ theo nội dung: {allocatedIds.length} / 12 sân vật lý đã gán cho {eventName}.
        </Typography>
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.5 }}>
          Chọn cụm không có nghĩa cả 12 sân đang được dùng. Chỉ sân đã phân bổ thuộc nội dung này.
        </Typography>
        <Grid container spacing={0.75} sx={{ mt: 1 }}>
          {FIXTURE_COURTS.map((court) => {
            const status = courtDisplayStatus(court);
            const selected = allocatedIds.includes(court.id);
            return (
              <Grid key={court.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                <Box
                  onClick={() => toggleAlloc(court.id)}
                  sx={{
                    p: 0.9,
                    cursor: court.status === "MAINTENANCE" ? "not-allowed" : "pointer",
                    borderRadius: 1,
                    border: `1px solid ${selected ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider}`,
                    bgcolor: selected ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
                    minWidth: 0,
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{court.name}</Typography>
                  <StatusFromCourt status={status} />
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </OperatorCard>

      <TournamentWorkspace
        rail={
          <>
            <TournamentRightRailCard title="Tổng hợp phân bổ sân">
              <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{allocatedIds.length}/12 đã phân bổ</Typography>
              <Typography sx={{ fontSize: 12.5 }}>{allocatedCourts.map((c) => c.name).join(", ") || "—"}</Typography>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Xung đột lịch" priority>
              {FIXTURE_SCHEDULE_CONFLICTS.map((item) => (
                <Typography key={item.id} sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning, mb: 0.4 }}>
                  {item.id}: {item.text}
                </Typography>
              ))}
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Trận chưa xếp lịch">
              {FIXTURE_UNSCHEDULED_MATCHES.map((match) => (
                <Typography key={match.id} sx={{ fontSize: 12.5, mb: 0.4 }}>
                  {match.id} • {match.a} vs {match.b}
                </Typography>
              ))}
            </TournamentRightRailCard>
            <ReadinessPanel
              title="Mức sẵn sàng công bố"
              statusLabel={published ? "ĐÃ CÔNG BỐ" : `CHƯA SẴN SÀNG • ${FIXTURE_SCHEDULE_CONFLICTS.length + FIXTURE_UNSCHEDULED_MATCHES.length}`}
              statusTone={published ? "success" : "warning"}
              items={readinessItems}
              lockLabel="Công bố lịch"
              lockDisabled={notReady || published}
              onLock={() => setPublished(true)}
            />
            <OperatorCard>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Trạng thái lịch</Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                <TournamentStatusChip tone={scheduleStatus === "Published" ? "success" : scheduleStatus === "Ready" ? "info" : "draft"} label={scheduleStatusLabel} />
                <TournamentStatusChip tone="draft" label="LƯU ≠ CÔNG BỐ" />
              </Stack>
            </OperatorCard>
          </>
        }
      >
        {isGrid ? (
          <>
            <TournamentSectionTitle>Lưới lịch — sân đã phân bổ</TournamentSectionTitle>
            <Paper elevation={0} sx={{ overflow: "auto", maxWidth: "100%", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
              <Table size="small" sx={{ minWidth: 560, "& .MuiTableCell-root": { py: 0.7, verticalAlign: "top" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Giờ</TableCell>
                    {allocatedCourts.map((court) => (
                      <TableCell key={court.id} sx={{ fontWeight: 700, fontSize: 11 }}>{court.name}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {FIXTURE_SCHEDULE_GRID.map((row) => (
                    <TableRow key={row.time}>
                      <TableCell sx={{ fontWeight: 700 }}>{row.time}</TableCell>
                      {allocatedCourts.map((court) => (
                        <TableCell key={`${row.time}-${court.id}`}>
                          <ScheduleCell cell={row[court.id]} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </>
        ) : (
          <>
            <TournamentSectionTitle>Lịch theo sân — mobile</TournamentSectionTitle>
            <ChipRow
              value={courtFilter}
              onChange={setCourtFilter}
              items={[{ id: "all", label: "Mọi sân đã phân bổ" }, ...allocatedCourts.map((c) => ({ id: c.name, label: c.name }))]}
            />
            {DAYS.find((item) => item.id === day)?.label ? (
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 1 }}>{DAYS.find((item) => item.id === day)?.label}</Typography>
            ) : null}
            {["08:00", "09:10", "10:00", "10:40", "11:20", "12:00"].map((block) => {
              const blockMatches = mobileMatches.filter((match) => match.time === block);
              if (!blockMatches.length) return null;
              return (
                <Box key={block} sx={{ mb: 1.25 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, mb: 0.5 }}>Khung giờ {block}</Typography>
                  {blockMatches.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </Box>
              );
            })}
            {mobileMatches.filter((match) => match.time === "—").map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
            <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 1, mb: 0.5 }}>Tóm tắt xung đột</Typography>
            {FIXTURE_SCHEDULE_CONFLICTS.map((item) => (
              <Typography key={item.id} sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>{item.text}</Typography>
            ))}
          </>
        )}
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
