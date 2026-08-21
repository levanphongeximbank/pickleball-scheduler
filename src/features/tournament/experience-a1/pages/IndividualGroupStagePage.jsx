import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Alert,
  Box,
  Button,
  Grid,
  LinearProgress,
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

import { useAuth } from "../../../../context/AuthContext.jsx";
import { useClub } from "../../../../context/ClubContext.jsx";
import PermissionGate from "../../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../../auth/permissions.js";
import { directorPath, isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { loadPlayersForClub } from "../../../../domain/clubStorage.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import {
  isOfficialTournamentExperience,
  resolveTournamentExperienceAdapter,
} from "../experienceModeResolver.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import { deriveGroupStageModel } from "../batchC/deriveGroupStage.js";
import {
  BatchBError,
  BatchBEventPicker,
  BatchBLoading,
  BatchBMissingTournament,
  BatchBSiblingNav,
  BatchBWrongFamily,
  ExperienceBatchBFrame,
  ExperienceEventContextCard,
} from "../batchB/ExperienceBatchBFrame.jsx";
import {
  individualGroupDrawPath,
  individualGroupStagePath,
  individualMatchesPath,
  individualOverviewPath,
  individualPairDrawPath,
  individualSchedulePath,
  individualStandingsPath,
} from "../routes.js";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceMobileRecordCard from "../visual/ExperienceMobileRecordCard.jsx";
import ExperienceReadinessPanel from "../visual/ExperienceReadinessPanel.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import { outlinedActionSx, primaryActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";

const TITLE = "Vòng bảng";
const SUBTITLE = "Bảng xếp hạng và trận đấu";
const TEST_ID = "tournament-groups-page";

function matchTone(status) {
  if (status === "live") return "live";
  if (status === "completed") return "success";
  if (status === "attention") return "warning";
  return "draft";
}

export default function IndividualGroupStagePage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isTable = useMediaQuery(theme.breakpoints.up("md"));
  const { user } = useAuth();
  const { activeClub, activeClubId, revision, refreshClubs } = useClub();
  const { tournament, loading, error, update } = useCanonicalTournament(
    activeClub,
    tournamentId,
    revision
  );
  const selectedEventId = searchParams.get("eventId") || "";
  const selectedGroupId = searchParams.get("groupId") || "";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải vòng bảng…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) {
    return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  }

  const model = deriveGroupStageModel(tournament, { selectedEventId, selectedGroupId });
  const official = isOfficialTournamentExperience(tournament);
  const officialAdapter = official
    ? resolveTournamentExperienceAdapter(tournament, {
        selectedEventId: model.eventId || selectedEventId,
      })
    : null;
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };
  const eventId = model.eventId;
  const contextLine = [model.tournamentName, model.eventName].filter(Boolean).join(" • ");
  const needsGroupChoice = model.groups.length > 1 && !model.selectedGroupId;

  const persistCommand = async (built, successText) => {
    if (!built.ok) {
      setMessage({ type: "error", text: built.error || "Thao tác thất bại." });
      return false;
    }
    const result = await update(built.patch);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return false;
    }
    refreshClubs();
    setMessage({ type: "success", text: successText });
    return true;
  };

  const handleCreateMatches = async (regenerate = false) => {
    if (!official || !officialAdapter) return;
    setBusy(true);
    setMessage(null);
    const players = loadPlayersForClub(activeClubId) || [];
    const command = regenerate
      ? officialAdapter.commands.regenerateGroupMatches
      : officialAdapter.commands.createGroupMatches;
    const built = command(tournament, {
      selectedEventId: model.eventId || selectedEventId,
      players,
      userId: user?.id,
      actor: user ? { id: user.id, email: user.email } : null,
      regenerate,
    });
    await persistCommand(
      built,
      regenerate
        ? `Đã tạo lại ${built.matchCount || 0} trận vòng bảng.`
        : `Đã tạo ${built.matchCount || 0} trận vòng bảng.`
    );
    setBusy(false);
  };

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={contextLine}
      actions={
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
            Tổng quan
          </Button>
          <span title={model.lockHint}>
            <Button variant="outlined" size="small" startIcon={<LockOutlinedIcon />} disabled sx={outlinedActionSx}>
              Chốt BXH
            </Button>
          </span>
          {official ? (
            <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
              <span title={model.createMatchesHint}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={!model.createMatchesEnabled || busy}
                  onClick={() => handleCreateMatches(false)}
                  sx={primaryActionSx}
                  data-testid="official-group-matches-create"
                >
                  Tạo trận vòng bảng
                </Button>
              </span>
              {model.regenerateMatchesEnabled ? (
                <span title="Tạo lại trận khi chưa có kết quả">
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={busy}
                    onClick={() => handleCreateMatches(true)}
                    sx={outlinedActionSx}
                    data-testid="official-group-matches-regenerate"
                  >
                    Tạo lại trận
                  </Button>
                </span>
              ) : null}
            </PermissionGate>
          ) : null}
          <Button size="small" variant="contained" onClick={() => navigate(directorPath(tournamentId))}>
            Kết quả & BXH
          </Button>
        </Stack>
      }
    >
      <BatchBSiblingNav
        items={[
          { id: "pair-draw", label: "Ghép cặp / đội", to: individualPairDrawPath(tournamentId, eventId), current: false },
          { id: "group-draw", label: "Chia bảng", to: individualGroupDrawPath(tournamentId, eventId), current: false },
          { id: "groups", label: "Vòng bảng", to: individualGroupStagePath(tournamentId, eventId), current: true },
          { id: "schedule", label: "Lịch", to: individualSchedulePath(tournamentId, eventId), current: false },
          { id: "matches", label: "Trận", to: individualMatchesPath(tournamentId, eventId), current: false },
          { id: "standings", label: "BXH", to: individualStandingsPath(tournamentId, eventId), current: false },
        ]}
      />
      <BatchBEventPicker events={model.events} selectedEventId={selectedEventId} onSelect={(id) => setParam("eventId", id)} />
      {model.emptyEvents ? <Alert severity="info" sx={{ mb: 1.25 }}>Chưa có nội dung trên hồ sơ.</Alert> : null}
      {model.needsEventChoice ? <Alert severity="info" sx={{ mb: 1.25 }}>Chọn nội dung để xem vòng bảng.</Alert> : null}
      {model.blocker ? (
        <Alert
          severity="warning"
          sx={{ mb: 1.25 }}
          data-testid="official-group-stage-blocker"
          action={
            official ? (
              <Button
                color="inherit"
                size="small"
                component={RouterLink}
                to={individualGroupDrawPath(tournamentId, eventId)}
              >
                Chia bảng
              </Button>
            ) : null
          }
        >
          {model.blocker.error}
        </Alert>
      ) : null}
      {message ? (
        <Alert severity={message.type} sx={{ mb: 1.25 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}
      <ExperienceEventContextCard
        eyebrow="VÒNG BẢNG"
        tournamentName={model.tournamentName}
        eventName={model.eventName}
        extra={model.selectedGroupLabel ? `Bảng ${model.selectedGroupLabel}` : "Chưa chọn bảng"}
      />
      {model.groups.length > 1 ? (
        <>
          <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>Chọn bảng</Typography>
          <ExperienceChipRow
            value={model.selectedGroupId}
            onChange={(id) => setParam("groupId", id)}
            items={model.groups.map((group) => ({ id: group.id, label: `Bảng ${group.label}` }))}
          />
        </>
      ) : null}
      {needsGroupChoice ? <Alert severity="info" sx={{ mb: 1.25 }}>Chọn bảng để xem xếp hạng và trận.</Alert> : null}
      {model.matches.length ? (
        <Box sx={{ mb: 1.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Tiến độ bảng</Typography>
            <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
              {model.kpis.played}/{model.kpis.played + model.kpis.remaining}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={
              model.kpis.played + model.kpis.remaining
                ? Math.round((model.kpis.played / (model.kpis.played + model.kpis.remaining)) * 100)
                : 0
            }
            sx={{
              height: 6,
              borderRadius: 99,
              bgcolor: TOURNAMENT_COLOR.divider,
              "& .MuiLinearProgress-bar": { bgcolor: TOURNAMENT_COLOR.primary },
            }}
          />
        </Box>
      ) : null}
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <CenterKpiCard label="Cặp trong bảng" value={model.kpis.pairs} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <CenterKpiCard label="Đã thi đấu" value={model.kpis.played} tone="success" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <CenterKpiCard label="Còn lại" value={model.kpis.remaining} tone="warning" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <CenterKpiCard label="Đi tiếp" value={model.kpis.qualified} hint={model.kpis.qualifiedHint} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 4 }}>
          <CenterKpiCard label="Sân đang dùng" value={model.courts.length || "—"} hint={model.courts.join(", ") || "Chưa có"} />
        </Grid>
      </Grid>
      <TournamentExperienceWorkspace
        rail={
          <>
            <ExperienceReadinessPanel
              title="Mức sẵn sàng"
              statusLabel="Chưa sẵn sàng"
              statusTone="warning"
              items={[
                { label: "Có bảng trên hồ sơ", ready: model.groups.length > 0, note: model.groups.length ? `${model.groups.length} bảng` : "Chưa có bảng" },
                { label: "Có trận trên hồ sơ", ready: model.matches.length > 0, note: `${model.matches.length} trận` },
                { label: "Chốt BXH", ready: false, note: model.lockHint },
              ]}
              lockLabel="Chốt BXH"
              lockDisabled
              lockHint={model.lockHint}
            />
            <CenterRightRailCard title="Trận đang diễn ra">
              {model.liveMatch ? (
                <>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{model.liveMatch.a} vs {model.liveMatch.b}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                    {model.liveMatch.court} • {model.liveMatch.score}
                  </Typography>
                </>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Không có trận đang thi đấu.</Typography>
              )}
            </CenterRightRailCard>
            <CenterRightRailCard title="Trận tiếp theo">
              {model.nextMatch ? (
                <>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{model.nextMatch.a} vs {model.nextMatch.b}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                    {model.nextMatch.court} • {model.nextMatch.time}
                  </Typography>
                </>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có trận tiếp theo.</Typography>
              )}
            </CenterRightRailCard>
            <CenterRightRailCard title="Ghi điểm">
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>
                {model.scoringHint}
              </Typography>
              <Button size="small" variant="outlined" fullWidth sx={outlinedActionSx} onClick={() => navigate(directorPath(tournamentId))}>
                Mở điều hành giải
              </Button>
            </CenterRightRailCard>
          </>
        }
      >
        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Bảng xếp hạng</Typography>
        {model.standings.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 2 }}>
            Chưa có bảng xếp hạng trên nội dung / bảng đang xem.
          </Typography>
        ) : isTable ? (
          <Paper elevation={0} sx={{ mb: 2, overflow: "auto", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  {["Hạng", "Cặp / đội", "Trận", "Thắng", "Thua", "Điểm", "Hiệu số", "Quyền đi tiếp"].map((col) => (
                    <TableCell key={col} sx={{ fontWeight: 700, fontSize: 12 }}>{col}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {model.standings.map((row) => (
                  <TableRow key={row.pair + row.rank}>
                    <TableCell>{row.rank}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{row.pair}</TableCell>
                    <TableCell>{row.played}</TableCell>
                    <TableCell>{row.won}</TableCell>
                    <TableCell>{row.lost}</TableCell>
                    <TableCell>{row.points}</TableCell>
                    <TableCell>{row.diff}</TableCell>
                    <TableCell>
                      <ExperienceStatusChip tone="draft" label={row.qualLabel} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          <Box sx={{ mb: 2 }}>
            {model.standings.map((row) => (
              <ExperienceMobileRecordCard
                key={row.pair + row.rank}
                title={`${row.rank}. ${row.pair}`}
                status={<ExperienceStatusChip tone="draft" label={row.qualLabel} />}
                meta={
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                    {row.played} trận • {row.won} thắng • {row.points} điểm • HS {row.diff}
                  </Typography>
                }
              />
            ))}
          </Box>
        )}
        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Danh sách trận</Typography>
        {model.matches.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>Chưa có trận vòng bảng trên hồ sơ.</Typography>
        ) : isTable ? (
          <Paper elevation={0} sx={{ overflow: "auto", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  {["Cặp A", "Cặp B", "Tỷ số", "Sân", "Trạng thái"].map((col) => (
                    <TableCell key={col} sx={{ fontWeight: 700, fontSize: 12 }}>{col}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {model.matches.map((match) => (
                  <TableRow key={match.id}>
                    <TableCell sx={{ fontWeight: 700 }}>{match.a}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{match.b}</TableCell>
                    <TableCell>{match.score}</TableCell>
                    <TableCell>{match.court}</TableCell>
                    <TableCell>
                      <ExperienceStatusChip tone={matchTone(match.status)} label={match.statusLabel} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          model.matches.map((match) => (
            <ExperienceMobileRecordCard
              key={match.id}
              title={`${match.a} vs ${match.b}`}
              status={<ExperienceStatusChip tone={matchTone(match.status)} label={match.statusLabel} />}
              meta={
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                  {match.score} • {match.court}
                </Typography>
              }
            />
          ))
        )}
      </TournamentExperienceWorkspace>
    </ExperienceBatchBFrame>
  );
}
