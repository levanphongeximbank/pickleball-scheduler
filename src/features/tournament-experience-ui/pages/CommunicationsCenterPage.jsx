import { useState } from "react";
import { Button, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import { CompetitionContextHeader, StageSelector } from "../components/competitionSurfaces.jsx";
import { ChipRow, FixtureAuthorityNote } from "../components/prototypeSurfaces.jsx";
import { OpsStatusChip } from "../components/opsStatusChip.jsx";
import { TOURNAMENT_COLOR } from "../design/tournamentDesignTokens.js";
import { FIXTURE_COMMS_TEMPLATES, FIXTURE_MESSAGES } from "../fixtures/opsFixture.js";
import { getFixtureTournament } from "../fixtures/prototypeFixture.js";

const CHANNELS = ["PICK_VN App", "Email", "SMS", "Zalo OA"];
const AUDIENCE_LABEL = {
  tournament: "Cả giải",
  event: "Một nội dung",
  group: "Bảng",
  referees: "Trọng tài",
  captains: "Đội trưởng",
  individual: "Cá nhân",
};

export default function CommunicationsCenterPage() {
  const tournament = getFixtureTournament();
  const [audience, setAudience] = useState("tournament");
  const [channels, setChannels] = useState(["PICK_VN App", "Zalo OA"]);
  const [timing, setTiming] = useState("now");
  const [templateId, setTemplateId] = useState("checkin");
  const template = FIXTURE_COMMS_TEMPLATES.find((item) => item.id === templateId);
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body);

  const applyTemplate = (id) => {
    const next = FIXTURE_COMMS_TEMPLATES.find((item) => item.id === id);
    setTemplateId(id);
    setTitle(next.title);
    setBody(next.body);
  };

  const toggleChannel = (channel) => {
    setChannels((prev) => (prev.includes(channel) ? prev.filter((item) => item !== channel) : [...prev, channel]));
  };

  return (
    <TournamentExperienceShell title="Trung tâm thông báo" subtitle="Thông báo điều hành — không phải truyền thông / trình chiếu" showEventContext>
      <FixtureAuthorityNote>nhắm đối tượng thông báo chỉ là nguyên mẫu.</FixtureAuthorityNote>
      <CompetitionContextHeader tournament={tournament.name} extra="Nhắm đối tượng (dữ liệu mẫu)" />
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Đã gửi hôm nay" value={12} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Đã lên lịch" value={3} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Thất bại" value={1} tone="danger" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><TournamentKpiCard label="Đã nhận" value="86%" tone="success" /></Grid>
      </Grid>
      <TournamentWorkspace
        rail={
          <>
            <TournamentRightRailCard title="Xem trước">
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.primary, fontWeight: 700 }}>PICK_VN APP / EMAIL</Typography>
              <Typography sx={{ fontWeight: 800 }}>{tournament.name}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mt: 0.5 }}>{title}</Typography>
              <Typography sx={{ fontSize: 12.5 }}>{body}</Typography>
              <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
                Đối tượng: {AUDIENCE_LABEL[audience] || audience} • {channels.join(", ")} • {timing === "now" ? "Gửi ngay" : "Lên lịch"}
              </Typography>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Tự động hóa">
              <Typography sx={{ fontSize: 12.5 }}>Nhắc check-in — T-30 phút</Typography>
              <Typography sx={{ fontSize: 12.5 }}>Trận sắp bắt đầu — T-10 phút</Typography>
              <Typography sx={{ fontSize: 12.5 }}>Cập nhật lịch — khi công bố</Typography>
              <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.5 }}>Mẫu tự động. Chỉ dữ liệu mẫu.</Typography>
            </TournamentRightRailCard>
          </>
        }
      >
        <TournamentSectionTitle>Đối tượng</TournamentSectionTitle>
        <ChipRow
          value={audience}
          onChange={setAudience}
          items={[
            { id: "tournament", label: "Cả giải" },
            { id: "event", label: "Một nội dung" },
            { id: "group", label: "Bảng" },
            { id: "referees", label: "Trọng tài" },
            { id: "captains", label: "Đội trưởng" },
            { id: "individual", label: "Cá nhân" },
          ]}
        />
        <TournamentSectionTitle>Kênh</TournamentSectionTitle>
        <ChipRow
          value={channels[0]}
          onChange={toggleChannel}
          items={CHANNELS.map((id) => ({ id, label: channels.includes(id) ? `✓ ${id}` : id }))}
        />
        <TournamentSectionTitle>Mẫu</TournamentSectionTitle>
        <ChipRow
          value={templateId}
          onChange={applyTemplate}
          items={FIXTURE_COMMS_TEMPLATES.map((item) => ({ id: item.id, label: item.label }))}
        />
        <TournamentSectionTitle>Soạn thông báo</TournamentSectionTitle>
        <Stack spacing={1.25} sx={{ mb: 1.5 }}>
          <TextField size="small" label="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField size="small" multiline minRows={3} label="Nội dung" value={body} onChange={(e) => setBody(e.target.value)} />
          <TextField size="small" label="Tệp đính kèm" defaultValue="(mẫu) schedule-day1.pdf" />
          <StageSelector
            value={timing}
            onChange={setTiming}
            items={[
              { id: "now", label: "Gửi ngay" },
              { id: "schedule", label: "Lên lịch" },
            ]}
          />
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button variant="outlined" size="small">Xem trước</Button>
            <Button variant="outlined" size="small" disabled={timing !== "schedule"}>Lên lịch</Button>
            <Button variant="contained" size="small">Gửi (dữ liệu mẫu)</Button>
          </Stack>
        </Stack>
        <TournamentSectionTitle>Lịch sử gửi</TournamentSectionTitle>
        <Paper elevation={0} sx={{ overflow: "auto", maxWidth: "100%", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
          <Table size="small" sx={{ minWidth: 560, "& .MuiTableCell-root": { py: 0.65 } }}>
            <TableHead>
              <TableRow>
                {["Tiêu đề", "Đối tượng", "Kênh", "Giờ", "Trạng thái", "% nhận"].map((h) => (
                  <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {FIXTURE_MESSAGES.map((row) => (
                <TableRow key={row.id}>
                  <TableCell sx={{ fontWeight: 700 }}>{row.title}</TableCell>
                  <TableCell>{row.audience}</TableCell>
                  <TableCell>{row.channels.join(", ")}</TableCell>
                  <TableCell>{row.time}</TableCell>
                  <TableCell>
                    <OpsStatusChip
                      status={row.status === "delivered" || row.status === "sent" ? "COMPLETED" : row.status === "failed" ? "ATTENTION" : "WAITING"}
                    />
                  </TableCell>
                  <TableCell>{row.delivery}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
