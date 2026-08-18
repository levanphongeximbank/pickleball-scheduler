import { useState } from "react";
import { Box, Button, Drawer, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, useMediaQuery, useTheme } from "@mui/material";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import { CompetitionContextHeader, StageSelector } from "../components/competitionSurfaces.jsx";
import { IncidentDetail, IncidentOpsCard } from "../components/liveOpsSurfaces.jsx";
import { ChipRow, FixtureAuthorityNote } from "../components/prototypeSurfaces.jsx";
import TournamentStatusChip from "../components/TournamentStatusChip.jsx";
import { FIXTURE_INCIDENTS } from "../fixtures/opsFixture.js";
import { getFixtureTournament } from "../fixtures/prototypeFixture.js";
import { TOURNAMENT_COLOR } from "../design/tournamentDesignTokens.js";

export default function ExceptionCenterPage() {
  const theme = useTheme();
  const isTable = useMediaQuery(theme.breakpoints.up("md"));
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const tournament = getFixtureTournament();
  const [severity, setSeverity] = useState("all");
  const [type, setType] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");
  const [selectedId, setSelectedId] = useState("INC-11");
  const [mobileOpen, setMobileOpen] = useState(false);

  const rows = FIXTURE_INCIDENTS.filter((item) => {
    if (severity !== "all" && item.severity !== severity) return false;
    if (type !== "all" && item.type !== type) return false;
    if (eventFilter !== "all" && item.event !== eventFilter) return false;
    if (status !== "all" && item.status !== status) return false;
    if (owner !== "all" && item.owner !== owner) return false;
    return true;
  });
  const selected = FIXTURE_INCIDENTS.find((item) => item.id === selectedId) || rows[0] || null;
  const kpis = {
    open: FIXTURE_INCIDENTS.filter((i) => i.status === "open").length,
    critical: FIXTURE_INCIDENTS.filter((i) => i.severity === "danger" && i.status !== "resolved").length,
    watching: FIXTURE_INCIDENTS.filter((i) => i.status === "watching").length,
    resolved: FIXTURE_INCIDENTS.filter((i) => i.status === "resolved").length,
  };

  const select = (id) => {
    setSelectedId(id);
    if (isMobile) setMobileOpen(true);
  };

  return (
    <TournamentExperienceShell title="Trung tâm xử lý sự cố" subtitle="Hộp thư sự cố vận hành" showEventContext>
      <FixtureAuthorityNote>danh sách sự cố không tạo quyền vận hành thật.</FixtureAuthorityNote>
      <CompetitionContextHeader tournament={tournament.name} event="Vận hành đang diễn ra" extra="Không gian sự cố" />
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Đang mở" value={kpis.open} tone="warning" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Nghiêm trọng" value={kpis.critical} tone="danger" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Đang theo dõi" value={kpis.watching} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Đã xử lý hôm nay" value={kpis.resolved} tone="success" /></Grid>
      </Grid>
      <ChipRow
        value={severity}
        onChange={setSeverity}
        items={[
          { id: "all", label: "Mọi mức" },
          { id: "danger", label: "Nghiêm trọng" },
          { id: "warning", label: "Cảnh báo" },
        ]}
      />
      <ChipRow
        value={type}
        onChange={setType}
        items={[
          { id: "all", label: "Mọi loại" },
          { id: "Thiếu trọng tài", label: "Thiếu trọng tài" },
          { id: "Sân không dùng được", label: "Sân không dùng được" },
          { id: "Trễ lịch", label: "Trễ lịch" },
          { id: "Sự cố VĐV", label: "Sự cố VĐV" },
          { id: "Lệch kết quả", label: "Lệch kết quả" },
          { id: "Xung đột lịch", label: "Xung đột lịch" },
        ]}
      />
      <ChipRow
        value={eventFilter}
        onChange={setEventFilter}
        items={[
          { id: "all", label: "Mọi nội dung" },
          { id: "Đôi nam 3.5", label: "Đôi nam 3.5" },
          { id: "Mixed 3.5", label: "Mixed 3.5" },
          { id: "Đôi nữ 3.5", label: "Đôi nữ 3.5" },
        ]}
      />
      <StageSelector
        value={status}
        onChange={setStatus}
        items={[
          { id: "all", label: "Mọi trạng thái" },
          { id: "open", label: "Đang mở" },
          { id: "watching", label: "Đang theo dõi" },
          { id: "resolved", label: "Đã xử lý" },
        ]}
      />
      <ChipRow
        value={owner}
        onChange={setOwner}
        items={[
          { id: "all", label: "Mọi phụ trách" },
          { id: "BTC sân", label: "BTC sân" },
          { id: "Điều hành", label: "Điều hành" },
          { id: "Kỹ thuật", label: "Kỹ thuật" },
        ]}
      />
      <TournamentWorkspace rail={!isMobile ? <IncidentDetail item={selected} /> : null}>
        <TournamentSectionTitle>Danh sách sự cố</TournamentSectionTitle>
        {isTable ? (
          <Paper elevation={0} sx={{ overflow: "auto", maxWidth: "100%", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
            <Table size="small" sx={{ minWidth: 640, "& .MuiTableCell-root": { py: 0.65 } }}>
              <TableHead>
                <TableRow>
                  {["Mức", "Tiêu đề", "Ảnh hưởng", "Mở lúc", "Phụ trách", "Trạng thái"].map((h) => (
                    <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover selected={selectedId === row.id} sx={{ cursor: "pointer" }} onClick={() => select(row.id)}>
                    <TableCell>
                      <TournamentStatusChip tone={row.severity === "danger" ? "danger" : "warning"} label={row.severity === "danger" ? "Nghiêm trọng" : "Cảnh báo"} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{row.title}</TableCell>
                    <TableCell>{row.match || row.court} • {row.event}</TableCell>
                    <TableCell>{row.opened}</TableCell>
                    <TableCell>{row.owner}</TableCell>
                    <TableCell>{row.status === "open" ? "Đang mở" : row.status === "watching" ? "Đang theo dõi" : row.status === "resolved" ? "Đã xử lý" : row.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          rows.map((item) => (
            <IncidentOpsCard key={item.id} item={item} selected={selectedId === item.id} onClick={() => select(item.id)} />
          ))
        )}
      </TournamentWorkspace>
      <Drawer anchor="right" open={isMobile && mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: { xs: "100vw", sm: 380 }, p: 2, maxWidth: "100%" }}>
          <IncidentDetail item={selected} onClose={() => setMobileOpen(false)} />
          <Button sx={{ mt: 1 }} onClick={() => setMobileOpen(false)}>Đóng</Button>
        </Box>
      </Drawer>
    </TournamentExperienceShell>
  );
}
