import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Alert,
  Box,
  Button,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import PermissionGate from "../../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../../auth/permissions.js";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { loadPlayersForClub } from "../../../../domain/clubStorage.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import {
  isOfficialTournamentExperience,
  resolveTournamentExperienceAdapter,
} from "../experienceModeResolver.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import { deriveFormationModel } from "../batchB/deriveFormation.js";
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
  individualOverviewPath,
  individualParticipantsPath,
  individualPairsPath,
  individualPairDrawPath,
  individualRegistrationPublicationPath,
} from "../routes.js";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceFormationPairCard from "../visual/ExperienceFormationPairCard.jsx";
import ExperienceOperatorCard from "../visual/ExperienceOperatorCard.jsx";
import ExperienceReadinessPanel from "../visual/ExperienceReadinessPanel.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import { outlinedActionSx, primaryActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";

const TITLE = "Hình thành cặp / đội";
const SUBTITLE = "Ghép cặp / đội do BTC — không phải phòng bốc thăm";
const TEST_ID = "tournament-pairs-page";

function BoxProgress({ label, pct }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{pct}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6,
          borderRadius: 99,
          bgcolor: TOURNAMENT_COLOR.divider,
          "& .MuiLinearProgress-bar": { bgcolor: TOURNAMENT_COLOR.primary },
        }}
      />
    </Box>
  );
}

export default function IndividualPairFormationPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, activeClubId, revision, refreshClubs } = useClub();
  const { tournament, loading, error, update } = useCanonicalTournament(
    activeClub,
    tournamentId,
    revision
  );
  const [mode, setMode] = useState("together");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const selectedEventId = searchParams.get("eventId") || "";

  if (loading) {
    return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải hình thành cặp…" />;
  }
  if (error) {
    return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  }
  if (!tournament) {
    return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  }
  if (!isIndividualTournament(tournament)) {
    return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  }

  const model = deriveFormationModel(tournament, { selectedEventId, mode });
  const official = isOfficialTournamentExperience(tournament);
  const officialAdapter = official
    ? resolveTournamentExperienceAdapter(tournament, { selectedEventId })
    : null;
  const selectEvent = (eventId) => {
    const next = new URLSearchParams(searchParams);
    if (eventId) next.set("eventId", eventId);
    else next.delete("eventId");
    setSearchParams(next);
  };
  const contextLine = [model.tournamentName, model.eventName].filter(Boolean).join(" • ");

  const handleFormPairs = async () => {
    if (!official || !officialAdapter || !model.formPairsEnabled) return;
    setBusy(true);
    setMessage(null);
    const players = loadPlayersForClub(activeClubId) || [];
    const built = officialAdapter.commands.formPairs(tournament, {
      selectedEventId: model.eventId || selectedEventId,
      players,
    });
    if (!built.ok) {
      setBusy(false);
      setMessage({ type: "error", text: built.error || "Ghép cặp thất bại." });
      return;
    }
    const result = await update(built.patch);
    setBusy(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được cặp." });
      return;
    }
    refreshClubs();
    setMessage({
      type: "success",
      text: `Đã ghép ${(built.pairs || []).length} cặp (${built.mode}). F5 sẽ đọc lại drawEntries đã lưu.`,
    });
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
              Chốt cặp / đội
            </Button>
          </span>
          {official ? (
            <>
              <span title={model.formPairsHint}>
                <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={!model.formPairsEnabled || busy}
                    onClick={handleFormPairs}
                    sx={primaryActionSx}
                    data-testid="official-form-pairs-action"
                  >
                    {model.formPairsLabel}
                  </Button>
                </PermissionGate>
              </span>
              <span title={model.drawHint}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!model.pairingComplete && model.pairFormationMode !== "REGISTERED_PAIRS"}
                  onClick={() =>
                    navigate(individualPairDrawPath(tournamentId, model.eventId || selectedEventId))
                  }
                  sx={outlinedActionSx}
                  data-testid="official-goto-pair-draw"
                >
                  Sang bốc thăm ghép
                </Button>
              </span>
            </>
          ) : (
            <span title={model.drawHint}>
              <Button variant="contained" size="small" disabled sx={primaryActionSx}>
                Sang bốc thăm ghép
              </Button>
            </span>
          )}
        </Stack>
      }
    >
      <BatchBSiblingNav
        items={[
          { id: "registration", label: "Đăng ký", to: individualRegistrationPublicationPath(tournamentId, model.eventId), current: false },
          { id: "participants", label: "Người tham dự", to: individualParticipantsPath(tournamentId, model.eventId), current: false },
          { id: "pairs", label: "Cặp / đội", to: individualPairsPath(tournamentId, model.eventId), current: true },
        ]}
      />
      <BatchBEventPicker events={model.events} selectedEventId={selectedEventId || model.eventId} onSelect={selectEvent} />
      {model.needsEventChoice ? (
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1.5 }}>
          Chọn nội dung để xem cặp / đội. Không lấy nội dung mặc định.
        </Typography>
      ) : null}
      {message ? (
        <Alert severity={message.type} sx={{ mb: 1.25 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <ExperienceEventContextCard
        eyebrow="NGỮ CẢNH HÌNH THÀNH CẶP / ĐỘI"
        tournamentName={model.tournamentName}
        eventName={model.eventName}
        extra={`Cách ghép: ${model.modeLabel}${model.pairFormationMode ? ` • ${model.pairFormationMode}` : ""}`}
      />
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, md: true }}>
          <CenterKpiCard label="Tổng VĐV" value={model.kpis.athletes} />
        </Grid>
        <Grid size={{ xs: 6, md: true }}>
          <CenterKpiCard label="Đã ghép" value={model.kpis.paired} tone="success" />
        </Grid>
        <Grid size={{ xs: 6, md: true }}>
          <CenterKpiCard label="Chưa ghép" value={model.kpis.unpaired} tone={model.kpis.unpaired ? "warning" : "success"} />
        </Grid>
        <Grid size={{ xs: 6, md: true }}>
          <CenterKpiCard label="Cặp hình thành" value={model.kpis.formed} />
        </Grid>
        <Grid size={{ xs: 6, md: true }}>
          <CenterKpiCard label="Cảnh báo" value={model.kpis.warnings} tone="warning" />
        </Grid>
      </Grid>
      <BoxProgress label="Tiến độ hình thành cặp" pct={model.progressPct} />
      <ExperienceChipRow
        value={model.mode}
        onChange={official ? () => {} : setMode}
        items={model.modes}
      />
      <ExperienceOperatorCard sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: TOURNAMENT_COLOR.primary, mb: 0.5 }}>
          Tác động cách ghép
        </Typography>
        <Typography sx={{ fontSize: 13 }}>{model.modeImpact}</Typography>
        {official ? (
          <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
            Không ghép trên page load / F5 / đổi nội dung. Chỉ khi bấm nút tường minh.
          </Typography>
        ) : null}
      </ExperienceOperatorCard>
      <TournamentExperienceWorkspace
        rail={
          <>
            <ExperienceReadinessPanel
              title={model.readinessTitle}
              statusLabel={model.readinessStatusLabel}
              statusTone={model.notReady ? "warning" : "success"}
              items={model.readinessItems}
              lockLabel="Chốt cặp / đội"
              lockDisabled
              lockHint={model.lockHint}
            />
            <CenterRightRailCard title="Cảnh báo">
              {model.kpis.unpaired ? (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>
                  {model.kpis.unpaired} VĐV chưa ghép
                </Typography>
              ) : null}
              {model.groupsCreated ? (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>
                  Đã có bảng — không ghép lại
                </Typography>
              ) : null}
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                {model.lockHint}
              </Typography>
            </CenterRightRailCard>
          </>
        }
      >
        <Grid container spacing={1.25}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <ExperienceSectionTitle>Chưa ghép ({model.unpaired.length})</ExperienceSectionTitle>
            <Stack spacing={1}>
              {model.unpaired.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>Không có VĐV chưa ghép.</Typography>
              ) : (
                model.unpaired.map((player) => (
                  <ExperienceOperatorCard key={player.id}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{player.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                      {(player.playerIds || []).length
                        ? `playerIds: ${player.playerIds.join(", ")}`
                        : player.id}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                      {player.club} • Rating {player.rating} • Seed {player.seed}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{player.status}</Typography>
                  </ExperienceOperatorCard>
                ))
              )}
            </Stack>
            <span title={model.createPairHint}>
              <Button variant="contained" size="small" sx={{ mt: 1 }} disabled>
                Tạo cặp (0/2)
              </Button>
            </span>
          </Grid>
          <Grid size={{ xs: 12, lg: 7 }}>
            <ExperienceSectionTitle>Cặp đã hình thành ({model.formed.length})</ExperienceSectionTitle>
            {model.formed.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
                {official
                  ? "Chưa có cặp materialize trên nội dung này."
                  : "Chưa có cặp đăng ký cùng trên nội dung này."}
              </Typography>
            ) : (
              <Grid container spacing={1}>
                {model.formed.map((pair) => (
                  <Grid key={pair.id} size={{ xs: 12, sm: 6 }}>
                    <ExperienceFormationPairCard pair={pair} />
                    {pair.playerIds?.length ? (
                      <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, mt: 0.35 }}>
                        playerIds: {pair.playerIds.join(", ")}
                      </Typography>
                    ) : null}
                  </Grid>
                ))}
              </Grid>
            )}
          </Grid>
        </Grid>
      </TournamentExperienceWorkspace>
    </ExperienceBatchBFrame>
  );
}
