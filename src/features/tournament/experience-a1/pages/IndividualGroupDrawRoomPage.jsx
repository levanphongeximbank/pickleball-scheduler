import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Grid, Stack, Typography } from "@mui/material";

import { useAuth } from "../../../../context/AuthContext.jsx";
import { useClub } from "../../../../context/ClubContext.jsx";
import PermissionGate from "../../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../../auth/permissions.js";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { loadPlayersForClub } from "../../../../domain/clubStorage.js";
import TournamentAnimationDialog from "../../../../components/tournament/animation/TournamentAnimationDialog.jsx";
import { useTournamentAnimation } from "../../../../components/tournament/animation/useTournamentAnimation.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import {
  isOfficialTournamentExperience,
  resolveTournamentExperienceAdapter,
} from "../experienceModeResolver.js";
import { deriveGroupDrawModel } from "../batchC/deriveGroupDraw.js";
import ExperienceDrawRoomShell, {
  DrawPanel,
  DrawRoomEventPicker,
  DrawRoomSiblingNav,
} from "../batchC/ExperienceDrawRoomShell.jsx";
import {
  DrawHistoryList,
  DrawLedgerTable,
  DrawPresentationOverlay,
  DrawProgressBar,
  DrawReadinessPanel,
  DrawRulesPanel,
  GroupDrawHero,
  GroupStatusCards,
} from "../batchC/ExperienceDrawRoomSurfaces.jsx";
import {
  DrawRoomError,
  DrawRoomLoading,
  DrawRoomMissingTournament,
  DrawRoomWrongFamily,
} from "../batchC/ExperienceDrawRoomStates.jsx";
import { DRAW_ROOM_CONTAINED_DISABLED_SX, DRAW_ROOM_OUTLINED_SX } from "../batchC/drawRoomButtonStyles.js";
import {
  individualGroupDrawPath,
  individualGroupStagePath,
  individualOverviewPath,
  individualPairDrawPath,
  individualPairsPath,
} from "../routes.js";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import { TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";

const TITLE = "Bốc thăm chia bảng";
const SUBTITLE = "Phòng bốc thăm";
const TEST_ID = "tournament-group-draw-page";

export default function IndividualGroupDrawRoomPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, can, rbacEnabled } = useAuth();
  const { activeClub, activeClubId, revision, refreshClubs } = useClub();
  const { tournament, loading, error, update } = useCanonicalTournament(
    activeClub,
    tournamentId,
    revision
  );
  const selectedEventId = searchParams.get("eventId") || "";
  const anim = useTournamentAnimation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  if (loading) {
    return (
      <DrawRoomLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải phòng bốc thăm…" />
    );
  }
  if (error) return <DrawRoomError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <DrawRoomMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) {
    return <DrawRoomWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  }

  const model = deriveGroupDrawModel(tournament, { selectedEventId });
  const official = isOfficialTournamentExperience(tournament);
  const officialAdapter = official
    ? resolveTournamentExperienceAdapter(tournament, {
        selectedEventId: model.eventId || selectedEventId,
      })
    : null;

  const selectEvent = (eventId) => {
    const next = new URLSearchParams(searchParams);
    if (eventId) next.set("eventId", eventId);
    else next.delete("eventId");
    setSearchParams(next);
  };
  const eventId = model.eventId;
  const goGroups = () => navigate(individualGroupStagePath(tournamentId, eventId));

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

  const handleCreate = async (isRedraw = false) => {
    if (!official || !officialAdapter) return;
    setBusy(true);
    setMessage(null);
    const players = loadPlayersForClub(activeClubId) || [];
    const command = isRedraw
      ? officialAdapter.commands.regenerateGroupDraw
      : officialAdapter.commands.createGroupDraw;
    const built = command(tournament, {
      selectedEventId: model.eventId || selectedEventId,
      players,
      clubId: activeClubId,
      userId: user?.id,
      actor: user ? { id: user.id, email: user.email } : null,
      hostClubName: activeClub?.name || "",
      isRedraw,
    });
    const ok = await persistCommand(
      built,
      isRedraw
        ? `Đã chia lại ${built.groupCount || 0} bảng (rating-neutral).`
        : `Đã chia ${built.groupCount || 0} bảng (rating-neutral). O5 không tạo trận.`
    );
    setBusy(false);
    if (ok && built.groups?.length) {
      const present = officialAdapter.commands.presentGroupDraw(
        { ...tournament, events: built.patch.events },
        { selectedEventId: model.eventId || selectedEventId }
      );
      if (present.ok && !present.mutates) {
        anim.showAnimation({ ...present.presentation }, () => {});
      }
    }
  };

  const handleLock = async () => {
    if (!official || !officialAdapter) return;
    setBusy(true);
    setMessage(null);
    const built = officialAdapter.commands.lockGroupDraw(tournament, {
      selectedEventId: model.eventId || selectedEventId,
      userId: user?.id,
      actor: user ? { id: user.id, email: user.email } : null,
    });
    await persistCommand(built, "Đã khóa bốc thăm chia bảng.");
    setBusy(false);
  };

  const handlePublish = async () => {
    if (!official || !officialAdapter) return;
    setBusy(true);
    setMessage(null);
    const built = officialAdapter.commands.publishGroupDraw(tournament, {
      selectedEventId: model.eventId || selectedEventId,
      userId: user?.id,
      actor: user ? { id: user.id, email: user.email } : null,
    });
    await persistCommand(built, "Đã công bố bốc thăm — không tạo lịch/trận.");
    setBusy(false);
  };

  const handleReopen = async () => {
    if (!official || !officialAdapter) return;
    setBusy(true);
    setMessage(null);
    const built = officialAdapter.commands.reopenGroupDraw(tournament, {
      selectedEventId: model.eventId || selectedEventId,
      userId: user?.id,
      actor: user ? { id: user.id, email: user.email } : null,
      canPermission: can,
      rbacEnabled,
      canIntervene: false,
    });
    await persistCommand(built, "Đã mở lại trạng thái bốc thăm.");
    setBusy(false);
  };

  const handlePresent = () => {
    if (!official || !officialAdapter || !model.presentEnabled) return;
    setMessage(null);
    const built = officialAdapter.commands.presentGroupDraw(tournament, {
      selectedEventId: model.eventId || selectedEventId,
    });
    if (!built.ok) {
      setMessage({ type: "error", text: built.error || "Không trình chiếu được." });
      return;
    }
    if (built.mutates) {
      setMessage({ type: "error", text: "Trình chiếu không được ghi hồ sơ." });
      return;
    }
    anim.showAnimation({ ...built.presentation }, () => {
      setMessage({ type: "success", text: "Đã trình chiếu — membership bảng không đổi." });
    });
  };

  return (
    <>
      <ExperienceDrawRoomShell
        testId={TEST_ID}
        title={TITLE}
        subtitle={SUBTITLE}
        locked={model.locked}
        statusLabel={model.drawStatusLabel}
        lockDisabled={!model.lockEnabled || busy}
        lockHint={model.lockHint}
        undoHint={model.undoHint}
        expectedTotal={model.expectedTotal}
        drawnCount={model.drawnCount}
        tournamentName={model.tournamentName}
        eventName={model.eventName || "Chưa chọn nội dung"}
        overviewPath={individualOverviewPath(tournamentId)}
        nextLifecycle={{
          label: "Sang vòng bảng",
          disabled: model.actionState.nextLifecycleDisabled,
          hint: model.nextHint,
          onClick: goGroups,
        }}
        extraNav={
          <>
            <DrawRoomSiblingNav
              items={[
                {
                  id: "pairs",
                  label: "Hình thành cặp",
                  to: individualPairsPath(tournamentId, eventId),
                  current: false,
                },
                {
                  id: "pair-draw",
                  label: "Ghép cặp / đội",
                  to: individualPairDrawPath(tournamentId, eventId),
                  current: false,
                },
                {
                  id: "group-draw",
                  label: "Chia bảng",
                  to: individualGroupDrawPath(tournamentId, eventId),
                  current: true,
                },
                {
                  id: "groups",
                  label: "Vòng bảng",
                  to: individualGroupStagePath(tournamentId, eventId),
                  current: false,
                },
              ]}
            />
            <DrawRoomEventPicker
              events={model.events}
              selectedEventId={selectedEventId || model.eventId}
              onSelect={selectEvent}
            />
          </>
        }
        presentation={
          <DrawPresentationOverlay
            tournament={model.tournamentName}
            event={model.eventName}
            title="Bốc thăm chia bảng"
            hero={
              <GroupDrawHero
                drawNumber={model.live.number}
                pairName={model.live.pair}
                groupId={model.live.group}
                position={model.live.position}
                capacity={model.live.capacity}
                valid={model.live.valid}
              />
            }
            progress={<DrawProgressBar current={model.drawnCount} total={model.expectedTotal} />}
          />
        }
        rail={
          <>
            <DrawReadinessPanel
              items={model.readinessItems}
              statusLabel={model.actionState.statusLabel}
              statusTone={model.actionState.statusTone}
            />
            <DrawRulesPanel rules={model.rules} />
          </>
        }
      >
        {model.emptyEvents ? (
          <Alert severity="info" sx={{ mb: 1.25 }}>
            Chưa có nội dung trên hồ sơ.
          </Alert>
        ) : null}
        {model.needsEventChoice ? (
          <Alert severity="info" sx={{ mb: 1.25 }}>
            Chọn nội dung để xem chia bảng. Không lấy nội dung mặc định.
          </Alert>
        ) : null}
        {model.blocker ? (
          <Alert
            severity="warning"
            sx={{ mb: 1.25 }}
            data-testid="official-group-draw-blocker"
            action={
              official ? (
                <Button
                  color="inherit"
                  size="small"
                  component={RouterLink}
                  to={individualPairsPath(tournamentId, eventId)}
                >
                  Hình thành cặp
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

        {official ? (
          <Grid container spacing={1.25} sx={{ mb: 1.25 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <CenterKpiCard label="Đơn vị (cặp)" value={model.kpis.units} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <CenterKpiCard label="VĐV" value={model.kpis.players ?? model.playerCount ?? 0} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <CenterKpiCard label="Bảng" value={model.kpis.groups} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <CenterKpiCard
                label="Chưa chia"
                value={model.kpis.awaiting}
                tone={model.kpis.awaiting ? "warning" : "success"}
              />
            </Grid>
          </Grid>
        ) : null}

        {official ? (
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.7)", mb: 1 }}>
            {model.summary.method}
            {model.drawPublishStatus ? ` • status: ${model.drawPublishStatus}` : ""}
            {model.ratingNeutral ? " • rating-neutral" : ""}
          </Typography>
        ) : null}

        <DrawPanel title="Cặp chờ chia bảng">
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.navyTextMuted, mb: 0.75 }}>
            {model.summary.totalPairs} cặp
            {model.summary.playerCount != null ? ` • ${model.summary.playerCount} VĐV` : ""}
            {" • "}
            {model.summary.groups} bảng • {model.summary.method}
          </Typography>
          {model.awaiting.length === 0 ? (
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.navyTextMuted }}>
              Không còn cặp chờ chia bảng.
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {model.awaiting.map((item) => (
                <Typography key={item.id} sx={{ fontSize: 13, color: "#FFF" }}>
                  {item.name}
                </Typography>
              ))}
            </Stack>
          )}
        </DrawPanel>
        <GroupStatusCards groups={model.groupCards} />
        <GroupDrawHero
          drawNumber={model.live.number}
          pairName={model.live.pair}
          groupId={model.live.group}
          position={model.live.position}
          capacity={model.live.capacity}
          valid={model.live.valid}
        />
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1.25, flexWrap: "wrap" }}>
          {official ? (
            <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
              <span title={model.createHint}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={!model.createEnabled || busy}
                  onClick={() => handleCreate(false)}
                  sx={!model.createEnabled ? DRAW_ROOM_CONTAINED_DISABLED_SX : undefined}
                  data-testid="official-group-draw-create"
                >
                  Chia bảng ngẫu nhiên
                </Button>
              </span>
              <span title={model.regenerateHint}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!model.regenerateEnabled || busy}
                  onClick={() => handleCreate(true)}
                  sx={DRAW_ROOM_OUTLINED_SX}
                  data-testid="official-group-draw-regenerate"
                >
                  Chia lại
                </Button>
              </span>
              <span title={model.lockHint}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!model.lockEnabled || busy}
                  onClick={handleLock}
                  sx={DRAW_ROOM_OUTLINED_SX}
                  data-testid="official-group-draw-lock"
                >
                  {model.lockLabel}
                </Button>
              </span>
              <span title={model.publishHint}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!model.publishEnabled || busy}
                  onClick={handlePublish}
                  sx={DRAW_ROOM_OUTLINED_SX}
                  data-testid="official-group-draw-publish"
                >
                  Công bố
                </Button>
              </span>
              <span title={model.reopenHint}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!model.reopenEnabled || busy}
                  onClick={handleReopen}
                  sx={DRAW_ROOM_OUTLINED_SX}
                  data-testid="official-group-draw-reopen"
                >
                  Mở lại
                </Button>
              </span>
              <span title={model.presentHint}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!model.presentEnabled || busy}
                  onClick={handlePresent}
                  sx={DRAW_ROOM_OUTLINED_SX}
                  data-testid="official-group-draw-present"
                >
                  Trình chiếu
                </Button>
              </span>
            </PermissionGate>
          ) : (
            <span title={model.drawNextHint}>
              <Button variant="contained" size="small" disabled sx={DRAW_ROOM_CONTAINED_DISABLED_SX}>
                Bốc cặp tiếp theo
              </Button>
            </span>
          )}
        </Stack>
        <DrawProgressBar current={model.drawnCount} total={model.expectedTotal} />
        <DrawLedgerTable
          title="Kết quả chia bảng"
          columns={["Cặp", "Bảng", "Vị trí", "Hạt", "Trạng thái"]}
          rows={model.ledger.map((row) => ({
            id: row.id,
            cells: [
              { text: row.pair, bold: true },
              { text: row.group },
              { text: String(row.position) },
              { text: row.seed },
              { text: row.status, tone: "success" },
            ],
          }))}
        />
        <DrawHistoryList title="Lịch sử chia bảng" items={model.history} />
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.55)", mb: 1 }}>
          {official
            ? "Official Group Draw: không đổi membership cặp; không VPR/Rating/seed/AI Balance; O5 không tạo lịch/trận."
            : model.lockHint}
        </Typography>
      </ExperienceDrawRoomShell>
      {official ? <TournamentAnimationDialog {...anim.dialogProps} /> : null}
    </>
  );
}
