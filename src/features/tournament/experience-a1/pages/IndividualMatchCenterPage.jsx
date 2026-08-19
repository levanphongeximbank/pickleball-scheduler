import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Button, Drawer, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, useMediaQuery, useTheme } from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import {
  BatchBError,
  BatchBEventPicker,
  BatchBLoading,
  BatchBMissingTournament,
  BatchBWrongFamily,
  ExperienceBatchBFrame,
} from "../batchB/ExperienceBatchBFrame.jsx";
import { BatchDSiblingNav } from "../batchD/BatchDNav.jsx";
import { deriveMatchCenterModel } from "../batchD/deriveMatchCenter.js";
import {
  ExperienceMatchCard,
  GroupSelector,
  SelectedMatchDetail,
  StageSelector,
} from "../batchD/ExperienceBatchDSurfaces.jsx";
import { matchStatusLabel, matchStatusTone } from "../batchD/labels.js";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";
import { individualOverviewPath } from "../routes.js";

const TITLE = "Trung tâm trận đấu";
const SUBTITLE = "Danh sách / xem / mở trận — không ghi điểm tại màn này";
const TEST_ID = "tournament-matches-page";

export default function IndividualMatchCenterPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isTable = useMediaQuery(theme.breakpoints.up("md"));
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "all";
  const stage = searchParams.get("stage") || "all";
  const groupId = searchParams.get("groupId") || "all";
  const court = searchParams.get("court") || "all";
  const referee = searchParams.get("referee") || "all";
  const status = searchParams.get("status") || "all";
  const [selectedId, setSelectedId] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải trận đấu…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveMatchCenterModel(tournament, {
    selectedEventId,
    stage,
    groupId,
    court,
    referee,
    status,
    selectedMatchId: selectedId,
  });
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };
  const selectMatch = (id) => {
    setSelectedId(id);
    if (isMobile) setMobileOpen(true);
  };

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={model.tournamentName}
      actions={
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
          Tổng quan
        </Button>
      }
    >
      <BatchDSiblingNav tournamentId={tournamentId} eventId={selectedEventId === "all" ? "" : selectedEventId} current="matches" />
      <Alert severity="info" sx={{ mb: 1.25 }}>Màn này không ghi điểm. Chỉ xem danh sách trận và mở trọng tài khi đã có quyền.</Alert>
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Tổng" value={model.kpis.total} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Sắp tới" value={model.kpis.upcoming} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Đang thi đấu" value={model.kpis.live} tone="live" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Hoàn tất" value={model.kpis.completed} tone="success" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Cần xử lý" value={model.kpis.attention} tone="warning" /></Grid>
      </Grid>
      <BatchBEventPicker
        events={[{ id: "all", name: "Tất cả nội dung" }, ...model.events]}
        selectedEventId={selectedEventId}
        onSelect={(id) => setParam("eventId", id)}
      />
      <StageSelector
        value={stage}
        onChange={(id) => setParam("stage", id)}
        items={[
          { id: "all", label: "Mọi vòng" },
          { id: "group", label: "Vòng bảng" },
          { id: "ko", label: "Loại trực tiếp" },
        ]}
      />
      <GroupSelector
        value={groupId}
        onChange={(id) => setParam("groupId", id)}
        items={[{ id: "all", label: "Mọi bảng" }, ...model.groups]}
      />
      <ExperienceChipRow
        value={court}
        onChange={(id) => setParam("court", id)}
        items={[{ id: "all", label: "Mọi sân" }, ...model.courts.map((item) => ({ id: item, label: item }))]}
      />
      <ExperienceChipRow
        value={referee}
        onChange={(id) => setParam("referee", id)}
        items={[{ id: "all", label: "Mọi trọng tài" }, { id: "none", label: "Chưa gán" }, ...model.referees.map((item) => ({ id: item, label: item }))]}
      />
      <ExperienceChipRow
        value={status}
        onChange={(id) => setParam("status", id)}
        items={[
          { id: "all", label: "Mọi trạng thái" },
          { id: "live", label: "Đang thi đấu" },
          { id: "upcoming", label: "Tiếp theo" },
          { id: "completed", label: "Hoàn tất" },
          { id: "attention", label: "Cần xử lý" },
        ]}
      />
      <TournamentExperienceWorkspace rail={!isMobile ? <SelectedMatchDetail match={model.selected} /> : null}>
        <ExperienceSectionTitle>Danh sách trận</ExperienceSectionTitle>
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
                {model.rows.map((row) => (
                  <TableRow key={row.id} hover selected={model.selected?.id === row.id} sx={{ cursor: "pointer" }} onClick={() => selectMatch(row.id)}>
                    <TableCell sx={{ fontWeight: 700 }}>{row.id}</TableCell>
                    <TableCell>{row.event}</TableCell>
                    <TableCell>{row.stage}{row.group && row.group !== "—" ? ` • ${row.group}` : ""}</TableCell>
                    <TableCell>{row.a} vs {row.b}</TableCell>
                    <TableCell>{row.time}</TableCell>
                    <TableCell>{row.court}</TableCell>
                    <TableCell>{row.referee}</TableCell>
                    <TableCell>
                      <ExperienceStatusChip tone={matchStatusTone(row.status)} label={matchStatusLabel(row.status)} />
                    </TableCell>
                    <TableCell sx={{ color: row.status === "live" ? TOURNAMENT_COLOR.live : undefined, fontWeight: 700 }}>{row.score}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          model.rows.map((row) => (
            <ExperienceMatchCard key={row.id} match={row} selected={model.selected?.id === row.id} onClick={() => selectMatch(row.id)} />
          ))
        )}
      </TournamentExperienceWorkspace>
      <Drawer anchor="right" open={isMobile && mobileOpen && Boolean(model.selected)} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: { xs: "100vw", sm: 380 }, p: 2, maxWidth: "100%" }}>
          <SelectedMatchDetail match={model.selected} compact onClose={() => setMobileOpen(false)} />
          <Button sx={{ mt: 1 }} onClick={() => setMobileOpen(false)}>Đóng</Button>
        </Box>
      </Drawer>
    </ExperienceBatchBFrame>
  );
}
