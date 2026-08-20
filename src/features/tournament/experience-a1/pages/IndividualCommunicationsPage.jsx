import { useState } from "react";
import { Button, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
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
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";
import { individualOverviewPath } from "../routes.js";
import { BatchFNav } from "../batchF/BatchFNav.jsx";
import { deriveCommunicationsModel } from "../batchF/deriveCommunications.js";

const TITLE = "Trung tâm truyền thông";
const SUBTITLE = "Thông báo điều hành — không phải truyền thông / trình chiếu";
const TEST_ID = "tournament-communications-page";

const AUDIENCE_ITEMS = [
  { id: "tournament", label: "Cả giải" },
  { id: "event", label: "Một nội dung" },
  { id: "group", label: "Bảng" },
  { id: "referees", label: "Trọng tài" },
  { id: "captains", label: "Đội trưởng" },
  { id: "individual", label: "Cá nhân" },
];

export default function IndividualCommunicationsPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "all";
  const [audience, setAudience] = useState("tournament");
  const [timing, setTiming] = useState("now");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải truyền thông…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveCommunicationsModel(tournament, { selectedEventId });
  const setEvent = (id) => {
    const next = new URLSearchParams(searchParams);
    if (!id || id === "all") next.delete("eventId");
    else next.set("eventId", id);
    setSearchParams(next);
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
      <BatchFNav tournamentId={tournamentId} eventId={selectedEventId === "all" ? "" : selectedEventId} current="communications" />
      <CompetitionContextHeader tournament={model.tournamentName} event={model.eventName} extra="Nhắm đối tượng trên hồ sơ" />
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Đã gửi hôm nay" value={model.kpis.sentToday} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Đã lên lịch" value={model.kpis.scheduled} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Thất bại" value={model.kpis.failed} tone="danger" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Đã nhận" value={model.kpis.deliveredRate} tone="success" /></Grid>
      </Grid>
      {model.events.length > 1 ? (
        <ExperienceChipRow
          value={selectedEventId}
          onChange={setEvent}
          items={[{ id: "all", label: "Mọi nội dung" }, ...model.events.map((event) => ({ id: event.id, label: eventDisplayName(event) }))]}
        />
      ) : null}
      <TournamentExperienceWorkspace
        rail={
          <>
            <CenterRightRailCard title="Xem trước">
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.primary, fontWeight: 700 }}>THÔNG BÁO</Typography>
              <Typography sx={{ fontWeight: 800 }}>{model.tournamentName}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mt: 0.5 }}>{title || "Tiêu đề thông báo"}</Typography>
              <Typography sx={{ fontSize: 12.5 }}>{body || "Nội dung thông báo"}</Typography>
              <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
                Đối tượng: {AUDIENCE_ITEMS.find((item) => item.id === audience)?.label || audience} • {timing === "now" ? "Gửi ngay" : "Lên lịch"}
              </Typography>
            </CenterRightRailCard>
            <CenterRightRailCard title="Tự động hóa">
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                Chưa có quy tắc tự động hóa trên hồ sơ giải.
              </Typography>
            </CenterRightRailCard>
          </>
        }
      >
        <ExperienceSectionTitle>Đối tượng</ExperienceSectionTitle>
        <ExperienceChipRow value={audience} onChange={setAudience} items={AUDIENCE_ITEMS} />
        <ExperienceSectionTitle>Soạn thông báo</ExperienceSectionTitle>
        <Stack spacing={1.25} sx={{ mb: 1.5 }}>
          <TextField size="small" label="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} disabled />
          <TextField size="small" multiline minRows={3} label="Nội dung" value={body} onChange={(e) => setBody(e.target.value)} disabled />
          <StageSelector
            value={timing}
            onChange={setTiming}
            items={[
              { id: "now", label: "Gửi ngay" },
              { id: "schedule", label: "Lên lịch" },
            ]}
          />
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <span title="Chưa hỗ trợ gửi thông báo từ màn này.">
              <Button variant="outlined" size="small" disabled>Xem trước</Button>
            </span>
            <span title="Chưa hỗ trợ gửi thông báo từ màn này.">
              <Button variant="outlined" size="small" disabled>Lên lịch</Button>
            </span>
            <span title="Chưa hỗ trợ gửi thông báo từ màn này.">
              <Button variant="contained" size="small" disabled>Gửi</Button>
            </span>
          </Stack>
        </Stack>
        <ExperienceSectionTitle>Lịch sử gửi</ExperienceSectionTitle>
        {!model.messages.length ? (
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có thông báo trên hồ sơ giải.</Typography>
        ) : (
          <Paper elevation={0} sx={{ overflow: "auto", maxWidth: "100%", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
            <Table size="small" sx={{ minWidth: 560, "& .MuiTableCell-root": { py: 0.65 } }}>
              <TableHead>
                <TableRow>
                  {["Tiêu đề", "Đối tượng", "Kênh", "Giờ", "Trạng thái"].map((h) => (
                    <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {model.messages.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={{ fontWeight: 700 }}>{row.title}</TableCell>
                    <TableCell>{row.audience}</TableCell>
                    <TableCell>{row.channels?.join(", ")}</TableCell>
                    <TableCell>{row.time}</TableCell>
                    <TableCell>{row.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </TournamentExperienceWorkspace>
    </ExperienceBatchBFrame>
  );
}
