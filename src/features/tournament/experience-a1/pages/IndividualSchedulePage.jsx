import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PublishIcon from "@mui/icons-material/CampaignOutlined";
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

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
import { deriveScheduleModel } from "../batchD/deriveSchedule.js";
import { BatchDSiblingNav } from "../batchD/BatchDNav.jsx";
import {
  CompetitionContextHeader,
  ExperienceMatchCard,
  GroupSelector,
  ScheduleCell,
  StageSelector,
} from "../batchD/ExperienceBatchDSurfaces.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceOperatorCard from "../visual/ExperienceOperatorCard.jsx";
import ExperienceReadinessPanel from "../visual/ExperienceReadinessPanel.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";
import { individualOverviewPath } from "../routes.js";

const TITLE = "Lịch thi đấu & Phân sân";
const SUBTITLE = "Cụm sân → Sân vật lý → Phân bổ theo nội dung";
const TEST_ID = "tournament-schedule-page";

export default function IndividualSchedulePage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isGrid = useMediaQuery(theme.breakpoints.up("md"));
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "";
  const stage = searchParams.get("stage") || "group";
  const groupId = searchParams.get("groupId") || "";
  const day = searchParams.get("day") || "";
  const courtFilter = searchParams.get("court") || "all";

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải lịch thi đấu…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveScheduleModel(tournament, { selectedEventId, stage, groupId, day });
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };
  const mobileMatches = model.cards.filter((match) => courtFilter === "all" || match.court === courtFilter);

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={[model.tournamentName, model.eventName].filter(Boolean).join(" • ")}
      actions={
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
            Tổng quan
          </Button>
          <span title={model.publishHint}>
            <Button variant="contained" size="small" startIcon={<PublishIcon />} disabled>
              Công bố lịch
            </Button>
          </span>
        </Stack>
      }
    >
      <BatchDSiblingNav tournamentId={tournamentId} eventId={model.eventId} current="schedule" />
      <BatchBEventPicker events={model.events} selectedEventId={selectedEventId} onSelect={(id) => setParam("eventId", id)} />
      {model.emptyEvents ? <Alert severity="info" sx={{ mb: 1.25 }}>Chưa có nội dung trên hồ sơ.</Alert> : null}
      {model.needsEventChoice ? <Alert severity="info" sx={{ mb: 1.25 }}>Chọn nội dung để xem lịch.</Alert> : null}
      <CompetitionContextHeader
        tournament={model.tournamentName}
        event={model.eventName}
        stage={stage === "ko" ? "Loại trực tiếp" : "Vòng bảng"}
        group={stage === "group" ? model.selectedGroupLabel || model.groups.find((g) => g.id === model.selectedGroupId)?.label : null}
        day={model.days.find((item) => item.id === (day || model.selectedDay))?.label}
      />
      {model.days.length ? <StageSelector value={day || model.selectedDay} onChange={(id) => setParam("day", id)} items={model.days} /> : null}
      <StageSelector
        value={stage}
        onChange={(id) => setParam("stage", id)}
        items={[
          { id: "group", label: "Vòng bảng" },
          { id: "ko", label: "Loại trực tiếp" },
        ]}
      />
      {stage === "group" && model.groups.length > 1 ? (
        <GroupSelector value={groupId || model.selectedGroupId} onChange={(id) => setParam("groupId", id)} items={model.groups} />
      ) : null}

      <ExperienceOperatorCard sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary }}>CỤM SÂN / ĐỊA ĐIỂM</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{model.venueName}</Typography>
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>
          {model.clusterHint} • {model.courts.length} sân vật lý
        </Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
          Tập sân của hồ sơ giải: {model.courts.length} sân. Chưa có phân bổ theo nội dung.
        </Typography>
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.5 }}>{model.allocationHint}</Typography>
        <Grid container spacing={0.75} sx={{ mt: 1 }}>
          {model.courts.map((court) => {
            const used = model.usedCourtIds.includes(String(court.id));
            return (
              <Grid key={court.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                <Box
                  sx={{
                    p: 0.9,
                    borderRadius: 1,
                    border: `1px solid ${used ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider}`,
                    bgcolor: used ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
                    minWidth: 0,
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{court.name}</Typography>
                  <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>
                    {used ? "Có trận nội dung này" : "Trên hồ sơ giải"}
                  </Typography>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </ExperienceOperatorCard>

      <TournamentExperienceWorkspace
        rail={
          <>
            <CenterRightRailCard title="Tổng hợp phân bổ sân">
              <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{model.usedCourtIds.length}/{model.courts.length} sân xuất hiện trên trận nội dung</Typography>
              <Typography sx={{ fontSize: 12.5 }}>{model.courts.filter((court) => model.usedCourtIds.includes(String(court.id))).map((c) => c.name).join(", ") || "—"}</Typography>
            </CenterRightRailCard>
            <CenterRightRailCard title="Xung đột lịch" priority={model.conflictCount > 0}>
              {model.conflicts.length ? model.conflicts.map((item) => (
                <Typography key={item.id} sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning, mb: 0.4 }}>{item.text}</Typography>
              )) : (
                <Typography sx={{ fontSize: 12.5 }}>Không có xung đột sân / giờ</Typography>
              )}
            </CenterRightRailCard>
            <CenterRightRailCard title="Trận chưa xếp lịch">
              {model.unscheduled.length ? model.unscheduled.map((match) => (
                <Typography key={match.id} sx={{ fontSize: 12.5, mb: 0.4 }}>{match.id}</Typography>
              )) : (
                <Typography sx={{ fontSize: 12.5 }}>Không còn trận chưa xếp lịch</Typography>
              )}
            </CenterRightRailCard>
            <ExperienceReadinessPanel
              title="Mức sẵn sàng công bố"
              statusLabel={model.published ? "ĐÃ CÔNG BỐ" : model.notReady ? `CHƯA SẴN SÀNG • ${model.conflictCount + model.unscheduledCount}` : "SẴN SÀNG"}
              statusTone={model.published ? "success" : "warning"}
              items={model.readinessItems}
              lockLabel="Công bố lịch"
              lockDisabled
              lockHint={model.publishHint}
            />
            <ExperienceOperatorCard>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Trạng thái lịch</Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                <ExperienceStatusChip tone={model.published ? "success" : model.notReady ? "draft" : "info"} label={model.scheduleStatusLabel} />
                <ExperienceStatusChip tone="draft" label="CHƯA CÔNG BỐ THEO NỘI DUNG" />
              </Stack>
            </ExperienceOperatorCard>
          </>
        }
      >
        {isGrid ? (
          <>
            <ExperienceSectionTitle>Lưới lịch — sân trên hồ sơ giải</ExperienceSectionTitle>
            <Paper elevation={0} sx={{ overflow: "auto", maxWidth: "100%", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
              <Table size="small" sx={{ minWidth: 560, "& .MuiTableCell-root": { py: 0.7, verticalAlign: "top" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Giờ</TableCell>
                    {model.courts.map((court) => (
                      <TableCell key={court.id} sx={{ fontWeight: 700, fontSize: 11 }}>{court.name}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {model.grid.length ? model.grid.map((row) => (
                    <TableRow key={row.time}>
                      <TableCell sx={{ fontWeight: 700 }}>{row.time}</TableCell>
                      {model.courts.map((court) => (
                        <TableCell key={`${row.time}-${court.id}`}>
                          <ScheduleCell cell={row[court.id]} />
                        </TableCell>
                      ))}
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={model.courts.length + 1}>
                        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có khung giờ trên hồ sơ.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </>
        ) : (
          <>
            <ExperienceSectionTitle>Lịch theo sân</ExperienceSectionTitle>
            <ExperienceChipRow
              value={courtFilter}
              onChange={(id) => setParam("court", id)}
              items={[{ id: "all", label: "Mọi sân" }, ...model.courts.map((court) => ({ id: court.name, label: court.name }))]}
            />
            {mobileMatches.map((match) => (
              <ExperienceMatchCard key={match.id} match={match} />
            ))}
            <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 1, mb: 0.5 }}>Tóm tắt xung đột</Typography>
            {model.conflicts.length ? model.conflicts.map((item) => (
              <Typography key={item.id} sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>{item.text}</Typography>
            )) : (
              <Typography sx={{ fontSize: 12.5 }}>Không có xung đột sân / giờ</Typography>
            )}
          </>
        )}
      </TournamentExperienceWorkspace>
    </ExperienceBatchBFrame>
  );
}
