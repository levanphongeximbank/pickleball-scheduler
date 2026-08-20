import { Alert, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

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
import { deriveStandingsModel } from "../batchD/deriveStandings.js";
import {
  CompetitionContextHeader,
  GroupSelector,
  StageSelector,
  StandingsTable,
} from "../batchD/ExperienceBatchDSurfaces.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceOperatorCard from "../visual/ExperienceOperatorCard.jsx";
import ExperienceReadinessPanel from "../visual/ExperienceReadinessPanel.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";
import { individualKnockoutPath, individualOverviewPath } from "../routes.js";

const TITLE = "Kết quả & Bảng xếp hạng";
const SUBTITLE = "Không phải màn giải thưởng";
const TEST_ID = "tournament-standings-page";

export default function IndividualStandingsPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "";
  const tab = searchParams.get("tab") || "group";
  const groupId = searchParams.get("groupId") || "";

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải bảng xếp hạng…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveStandingsModel(tournament, { selectedEventId, tab, groupId });
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={[model.tournamentName, model.eventName].filter(Boolean).join(" • ")}
      actions={
        <Stack direction="row" spacing={0.75}>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
            Tổng quan
          </Button>
          <span title={model.lockHint}>
            <Button variant="outlined" size="small" disabled sx={outlinedActionSx}>
              Khóa BXH
            </Button>
          </span>
        </Stack>
      }
    >
      <BatchDSiblingNav tournamentId={tournamentId} eventId={model.eventId} current="standings" />
      <BatchBEventPicker events={model.events} selectedEventId={selectedEventId} onSelect={(id) => setParam("eventId", id)} />
      {model.emptyEvents ? <Alert severity="info" sx={{ mb: 1.25 }}>Chưa có nội dung trên hồ sơ.</Alert> : null}
      {model.needsEventChoice ? <Alert severity="info" sx={{ mb: 1.25 }}>Chọn nội dung để xem kết quả.</Alert> : null}
      <CompetitionContextHeader
        tournament={model.tournamentName}
        event={model.eventName}
        stage={tab === "group" ? "Vòng bảng" : tab === "ko" ? "Loại trực tiếp" : "Chung cuộc"}
        group={tab === "group" ? model.selectedGroupLabel : null}
      />
      <StageSelector
        value={tab}
        onChange={(id) => setParam("tab", id)}
        items={[
          { id: "group", label: "Vòng bảng" },
          { id: "ko", label: "Loại trực tiếp" },
          { id: "final", label: "Chung cuộc" },
        ]}
      />
      {tab === "group" && model.groups.length > 1 ? (
        <GroupSelector value={groupId || model.selectedGroupId} onChange={(id) => setParam("groupId", id)} items={model.groups} />
      ) : null}
      <TournamentExperienceWorkspace
        rail={
          <>
            <ExperienceReadinessPanel
              title="MỨC SẴN SÀNG BXH"
              statusLabel="CHƯA KHÓA"
              statusTone="warning"
              items={model.readinessItems}
              lockLabel="Khóa BXH"
              lockDisabled
              lockHint={model.lockHint}
            />
            <CenterRightRailCard title="Ghi chú">
              <Typography sx={{ fontSize: 12.5 }}>Chưa khóa. Khóa BXH là bước riêng — chưa có trên hệ thống này.</Typography>
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mt: 0.5 }}>
                Tab Chung cuộc chỉ xem trước kết quả. Màn giải thưởng là bước sau.
              </Typography>
            </CenterRightRailCard>
          </>
        }
      >
        {tab === "group" ? (
          <>
            <ExperienceSectionTitle>Bảng xếp hạng bảng {model.selectedGroupLabel || "—"}</ExperienceSectionTitle>
            {model.standings.length ? <StandingsTable rows={model.standings} /> : (
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có bảng xếp hạng trên hồ sơ.</Typography>
            )}
          </>
        ) : null}
        {tab === "ko" ? (
          <>
            <ExperienceSectionTitle>Kết quả loại trực tiếp</ExperienceSectionTitle>
            <Paper elevation={0} sx={{ overflow: "auto", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
              <Table size="small" sx={{ minWidth: 520, "& .MuiTableCell-root": { py: 0.65 } }}>
                <TableHead>
                  <TableRow>
                    {["Vòng", "Trận", "Cặp", "Tỷ số", "Thắng"].map((h) => (
                      <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {model.koMatches.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.round}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{row.id}</TableCell>
                      <TableCell>{row.a} vs {row.b}</TableCell>
                      <TableCell>{row.score}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{row.winner}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            <Button component={RouterLink} to={individualKnockoutPath(tournamentId, model.eventId)} size="small" sx={{ mt: 1 }}>
              Xem vòng loại trực tiếp
            </Button>
          </>
        ) : null}
        {tab === "final" ? (
          <>
            <ExperienceSectionTitle>Chung cuộc — xem trước</ExperienceSectionTitle>
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>
              Tab này không thay màn giải thưởng. Chỉ xem trước thứ hạng nội dung khi đã có trận chung kết hoàn tất.
            </Typography>
            {model.finalPreview.length ? model.finalPreview.map((row) => (
              <ExperienceOperatorCard key={row.place} sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 800 }}>{row.place}</Typography>
                <Typography sx={{ fontSize: 14 }}>{row.pair}</Typography>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{row.note}</Typography>
              </ExperienceOperatorCard>
            )) : (
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có kết quả chung cuộc trên hồ sơ.</Typography>
            )}
          </>
        ) : null}
      </TournamentExperienceWorkspace>
    </ExperienceBatchBFrame>
  );
}
