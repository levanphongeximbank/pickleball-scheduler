import { useState } from "react";
import { Box, Button, Drawer, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import {
  BatchBError,
  BatchBLoading,
  BatchBMissingTournament,
  BatchBWrongFamily,
  ExperienceBatchBFrame,
} from "../batchB/ExperienceBatchBFrame.jsx";
import { eventDisplayName } from "../batchB/eventScope.js";
import { CompetitionContextHeader, StageSelector } from "../batchD/ExperienceBatchDSurfaces.jsx";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";
import { individualOverviewPath } from "../routes.js";
import { BatchESiblingNav } from "../batchE/BatchENav.jsx";
import { IncidentDetail, IncidentOpsCard } from "../batchE/ExperienceBatchESurfaces.jsx";
import { deriveExceptionModel } from "../batchE/deriveExceptions.js";

const TITLE = "Trung tâm xử lý sự cố";
const SUBTITLE = "Hợp thư sự cố vận hành";
const TEST_ID = "tournament-exceptions-page";

export default function IndividualExceptionCenterPage() {
  const theme = useTheme();
  const isTable = useMediaQuery(theme.breakpoints.up("md"));
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "all";
  const severity = searchParams.get("severity") || "all";
  const type = searchParams.get("type") || "all";
  const status = searchParams.get("status") || "all";
  const [selectedId, setSelectedId] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải sự cố…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveExceptionModel(tournament, { selectedEventId, severity, type, status });
  const selected = model.items.find((item) => item.id === selectedId) || model.items[0] || null;
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };
  const select = (id) => {
    setSelectedId(id);
    if (isMobile) setMobileOpen(true);
  };

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={[model.tournamentName, model.eventName].filter(Boolean).join(" • ")}
      actions={
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
          Tổng quan
        </Button>
      }
    >
      <BatchESiblingNav tournamentId={tournamentId} eventId={selectedEventId === "all" ? "" : selectedEventId} current="exceptions" />
      <CompetitionContextHeader tournament={model.tournamentName} event={model.eventName} extra="Không gian sự cố" />
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Đang mở" value={model.kpis.open} tone="warning" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Nghiêm trọng" value={model.kpis.critical} tone="danger" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Đang theo dõi" value={model.kpis.watching} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Đã xử lý hôm nay" value={model.kpis.resolved} tone="success" /></Grid>
      </Grid>
      <ExperienceChipRow
        value={severity}
        onChange={(id) => setParam("severity", id)}
        items={[
          { id: "all", label: "Mọi mức" },
          { id: "danger", label: "Nghiêm trọng" },
          { id: "warning", label: "Cảnh báo" },
        ]}
      />
      <ExperienceChipRow
        value={type}
        onChange={(id) => setParam("type", id)}
        items={[{ id: "all", label: "Mọi loại" }, ...model.types.map((item) => ({ id: item, label: item }))]}
      />
      {model.events.length > 1 ? (
        <ExperienceChipRow
          value={selectedEventId}
          onChange={(id) => setParam("eventId", id)}
          items={[{ id: "all", label: "Mọi nội dung" }, ...model.events.map((event) => ({ id: event.id, label: eventDisplayName(event) }))]}
        />
      ) : null}
      <StageSelector
        value={status}
        onChange={(id) => setParam("status", id)}
        items={[
          { id: "all", label: "Mọi trạng thái" },
          { id: "open", label: "Đang mở" },
          { id: "watching", label: "Đang theo dõi" },
          { id: "resolved", label: "Đã xử lý" },
        ]}
      />
      <TournamentExperienceWorkspace rail={!isMobile ? <IncidentDetail item={selected} /> : null}>
        <ExperienceSectionTitle>Danh sách sự cố</ExperienceSectionTitle>
        {!model.items.length ? (
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có sự cố trên hồ sơ trận.</Typography>
        ) : isTable ? (
          <Paper elevation={0} sx={{ overflow: "auto", maxWidth: "100%", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
            <Table size="small" sx={{ minWidth: 640, "& .MuiTableCell-root": { py: 0.65 } }}>
              <TableHead>
                <TableRow>
                  {["Mức", "Tiêu đề", "Ảnh hưởng", "Mốc lúc", "Nguồn", "Trạng thái"].map((h) => (
                    <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {model.items.map((row) => (
                  <TableRow key={row.id} hover selected={selected?.id === row.id} sx={{ cursor: "pointer" }} onClick={() => select(row.id)}>
                    <TableCell>
                      <ExperienceStatusChip tone={row.severity === "danger" ? "danger" : "warning"} label={row.severity === "danger" ? "Nghiêm trọng" : "Cảnh báo"} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{row.title}</TableCell>
                    <TableCell>{row.match || row.court} • {row.event}</TableCell>
                    <TableCell>{row.opened}</TableCell>
                    <TableCell>{row.owner}</TableCell>
                    <TableCell>{row.status === "open" ? "Đang mở" : row.status === "watching" ? "Đang theo dõi" : "Đã xử lý"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          model.items.map((item) => (
            <IncidentOpsCard key={item.id} item={item} selected={selected?.id === item.id} onClick={() => select(item.id)} />
          ))
        )}
      </TournamentExperienceWorkspace>
      <Drawer anchor="right" open={isMobile && mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: { xs: "100vw", sm: 380 }, p: 2, maxWidth: "100%" }}>
          <IncidentDetail item={selected} onClose={() => setMobileOpen(false)} />
        </Box>
      </Drawer>
    </ExperienceBatchBFrame>
  );
}
