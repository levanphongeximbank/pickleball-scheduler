import { useState } from "react";
import { Box, Button, Drawer, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, useMediaQuery, useTheme } from "@mui/material";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentStatusChip from "../components/TournamentStatusChip.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import { GroupSelector, SelectedMatchDetail, StageSelector, matchStatusLabel, matchStatusTone } from "../components/competitionSurfaces.jsx";
import { ChipRow, FixtureAuthorityNote } from "../components/prototypeSurfaces.jsx";
import { MatchCard } from "../components/prototypeCards.jsx";
import { TOURNAMENT_COLOR } from "../design/tournamentDesignTokens.js";
import { displayCompetitorLabel } from "../copy/uiDisplayLabels.js";
import { FIXTURE_GROUPS, FIXTURE_MATCH_REGISTRY } from "../fixtures/opsFixture.js";
import { FIXTURE_EVENTS } from "../fixtures/prototypeFixture.js";

export default function MatchCenterPage() {
  const theme = useTheme();
  const isTable = useMediaQuery(theme.breakpoints.up("md"));
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [eventId, setEventId] = useState("all");
  const [stage, setStage] = useState("all");
  const [group, setGroup] = useState("all");
  const [court, setCourt] = useState("all");
  const [referee, setReferee] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState("A-18");
  const [mobileOpen, setMobileOpen] = useState(false);
  const eventName = FIXTURE_EVENTS.find((item) => item.id === eventId)?.name;
  const rows = FIXTURE_MATCH_REGISTRY.filter((row) => {
    if (eventId !== "all" && row.event !== eventName) return false;
    if (stage !== "all" && row.stage !== stage) return false;
    if (group !== "all" && row.group !== group) return false;
    if (court !== "all" && row.court !== court) return false;
    if (referee !== "all" && row.referee !== referee) return false;
    if (status !== "all" && row.status !== status) return false;
    return true;
  });
  const selected = FIXTURE_MATCH_REGISTRY.find((row) => row.id === selectedId) || rows[0] || null;

  const selectMatch = (id) => {
    setSelectedId(id);
    if (isMobile) setMobileOpen(true);
  };

  return (
    <TournamentExperienceShell title="Trung tâm trận đấu" subtitle="Danh sách / xem / mở trận — không ghi điểm tại màn này" showEventContext>
      <FixtureAuthorityNote>màn này không có quyền ghi điểm.</FixtureAuthorityNote>
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Tổng" value={268} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Sắp tới" value={96} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Đang thi đấu" value={3} tone="live" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Hoàn tất" value={160} tone="success" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Cần xử lý" value={9} tone="warning" /></Grid>
      </Grid>
      <ChipRow
        value={eventId}
        onChange={setEventId}
        items={[{ id: "all", label: "Tất cả nội dung" }, ...FIXTURE_EVENTS.map((item) => ({ id: item.id, label: item.name }))]}
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
      <GroupSelector
        value={group}
        onChange={setGroup}
        items={[
          { id: "all", label: "Mọi bảng" },
          ...FIXTURE_GROUPS.map((item) => ({ id: item.id, label: item.name })),
        ]}
      />
      <ChipRow
        value={court}
        onChange={setCourt}
        items={[
          { id: "all", label: "Mọi sân" },
          { id: "Sân 1", label: "Sân 1" },
          { id: "Sân 2", label: "Sân 2" },
          { id: "Sân 3", label: "Sân 3" },
        ]}
      />
      <ChipRow
        value={referee}
        onChange={setReferee}
        items={[
          { id: "all", label: "Mọi trọng tài" },
          { id: "Trọng tài Hùng", label: "Hùng" },
          { id: "Trọng tài Mai", label: "Mai" },
          { id: "Chưa gán", label: "Chưa gán" },
        ]}
      />
      <ChipRow
        value={status}
        onChange={setStatus}
        items={[
          { id: "all", label: "Mọi trạng thái" },
          { id: "live", label: "Đang thi đấu" },
          { id: "upcoming", label: "Tiếp theo" },
          { id: "completed", label: "Hoàn tất" },
          { id: "attention", label: "Cần xử lý" },
        ]}
      />
      <TournamentWorkspace
        rail={!isMobile ? <SelectedMatchDetail match={selected} /> : null}
      >
        <TournamentSectionTitle>Danh sách trận</TournamentSectionTitle>
        {isTable ? (
          <Paper elevation={0} sx={{ overflow: "auto", maxWidth: "100%", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
            <Table size="small" sx={{ minWidth: 720, "& .MuiTableCell-root": { py: 0.65 } }}>
              <TableHead>
                <TableRow>
                  {["ID", "Nội dung", "Vòng", "Cặp", "Giờ", "Sân", "TT", "Trạng thái", "Tỷ số"].map((h) => (
                    <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    selected={selectedId === row.id}
                    sx={{ cursor: "pointer" }}
                    onClick={() => selectMatch(row.id)}
                  >
                    <TableCell sx={{ fontWeight: 700 }}>{row.id}</TableCell>
                    <TableCell>{row.event}</TableCell>
                    <TableCell>{row.stage}{row.group && row.group !== "—" ? ` • ${row.group}` : ""}</TableCell>
                    <TableCell>{displayCompetitorLabel(row.a)} vs {displayCompetitorLabel(row.b)}</TableCell>
                    <TableCell>{row.time}</TableCell>
                    <TableCell>{row.court}</TableCell>
                    <TableCell>{row.referee}</TableCell>
                    <TableCell>
                      <TournamentStatusChip tone={matchStatusTone(row.status)} label={matchStatusLabel(row.status)} />
                    </TableCell>
                    <TableCell sx={{ color: row.status === "live" ? TOURNAMENT_COLOR.live : undefined, fontWeight: 700 }}>{row.score}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          rows.map((row) => (
            <MatchCard
              key={row.id}
              match={row}
              selected={selectedId === row.id}
              onClick={() => selectMatch(row.id)}
            />
          ))
        )}
      </TournamentWorkspace>
      <Drawer anchor="right" open={isMobile && mobileOpen && Boolean(selected)} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: { xs: "100vw", sm: 380 }, p: 2, maxWidth: "100%" }}>
          <SelectedMatchDetail match={selected} compact onClose={() => setMobileOpen(false)} />
          <Button sx={{ mt: 1 }} onClick={() => setMobileOpen(false)}>Đóng</Button>
        </Box>
      </Drawer>
    </TournamentExperienceShell>
  );
}
