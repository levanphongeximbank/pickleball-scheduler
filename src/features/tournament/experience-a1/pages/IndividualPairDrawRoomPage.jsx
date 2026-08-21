import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Grid, Stack, Typography } from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import TournamentAnimationDialog from "../../../../components/tournament/animation/TournamentAnimationDialog.jsx";
import { useTournamentAnimation } from "../../../../components/tournament/animation/useTournamentAnimation.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import {
  isOfficialTournamentExperience,
  resolveTournamentExperienceAdapter,
} from "../experienceModeResolver.js";
import { derivePairDrawModel } from "../batchC/derivePairDraw.js";
import ExperienceDrawRoomShell, {
  DrawRoomEventPicker,
  DrawRoomSiblingNav,
} from "../batchC/ExperienceDrawRoomShell.jsx";
import {
  DrawHistoryList,
  DrawLedgerTable,
  DrawPoolList,
  DrawPresentationOverlay,
  DrawProgressBar,
  DrawReadinessPanel,
  DrawRulesPanel,
  PairDrawHero,
} from "../batchC/ExperienceDrawRoomSurfaces.jsx";
import {
  DrawRoomError,
  DrawRoomLoading,
  DrawRoomMissingTournament,
  DrawRoomWrongFamily,
} from "../batchC/ExperienceDrawRoomStates.jsx";
import {
  DRAW_ROOM_CONTAINED_DISABLED_SX,
  DRAW_ROOM_OUTLINED_SX,
} from "../batchC/drawRoomButtonStyles.js";
import {
  individualGroupDrawPath,
  individualGroupStagePath,
  individualOverviewPath,
  individualPairDrawPath,
  individualPairsPath,
} from "../routes.js";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";

const TITLE = "Bốc thăm ghép cặp / đội";
const SUBTITLE = "Phòng bốc thăm";
const TEST_ID = "tournament-pair-draw-page";

export default function IndividualPairDrawRoomPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "";
  const anim = useTournamentAnimation();
  const [message, setMessage] = useState(null);

  if (loading) {
    return <DrawRoomLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải phòng bốc thăm…" />;
  }
  if (error) return <DrawRoomError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <DrawRoomMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) {
    return <DrawRoomWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  }

  const model = derivePairDrawModel(tournament, { selectedEventId });
  const official = isOfficialTournamentExperience(tournament);
  const officialAdapter = official
    ? resolveTournamentExperienceAdapter(tournament, { selectedEventId: model.eventId || selectedEventId })
    : null;

  const selectEvent = (eventId) => {
    const next = new URLSearchParams(searchParams);
    if (eventId) next.set("eventId", eventId);
    else next.delete("eventId");
    setSearchParams(next);
  };
  const eventId = model.eventId;

  const handlePresent = () => {
    if (!official || !officialAdapter || !model.presentEnabled) return;
    setMessage(null);
    const built = officialAdapter.commands.presentPairDraw(tournament, {
      selectedEventId: model.eventId || selectedEventId,
    });
    if (!built.ok) {
      setMessage({ type: "error", text: built.error || "Không trình chiếu được." });
      return;
    }
    if (built.mutates) {
      setMessage({ type: "error", text: "Lệnh trình chiếu không được phép ghi hồ sơ." });
      return;
    }
    anim.showAnimation(
      {
        ...built.presentation,
      },
      () => {
        setMessage({
          type: "success",
          text: `Đã trình chiếu ${built.unitCount} cặp — membership không đổi.`,
        });
      }
    );
  };

  return (
    <>
      <ExperienceDrawRoomShell
        testId={TEST_ID}
        title={TITLE}
        subtitle={SUBTITLE}
        locked={model.locked}
        statusLabel={model.actionState.statusLabel}
        lockDisabled={model.actionState.lockDisabled}
        lockHint={model.lockHint}
        undoHint={model.undoHint}
        expectedTotal={model.expectedTotal}
        drawnCount={model.drawnCount}
        tournamentName={model.tournamentName}
        eventName={model.eventName || "Chưa chọn nội dung"}
        overviewPath={individualOverviewPath(tournamentId)}
        nextLifecycle={{
          label: "Sang bốc thăm chia bảng",
          disabled: model.actionState.nextLifecycleDisabled,
          hint: model.nextHint,
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
                  current: true,
                },
                {
                  id: "group-draw",
                  label: "Chia bảng",
                  to: individualGroupDrawPath(tournamentId, eventId),
                  current: false,
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
            title="Bốc thăm ghép cặp / đội"
            hero={
              <PairDrawHero
                drawNumber={model.live.number}
                playerA={model.live.playerA}
                playerB={model.live.playerB}
                valid={model.live.valid}
                warning={model.live.warning}
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
            Chọn nội dung để xem bốc thăm. Không lấy nội dung mặc định.
          </Alert>
        ) : null}
        {model.blocker ? (
          <Alert
            severity="warning"
            sx={{ mb: 1.25 }}
            data-testid="official-pair-draw-blocker"
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
              <CenterKpiCard label="Đơn vị cạnh tranh" value={model.kpis.units} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <CenterKpiCard
                label="Chưa ghép"
                value={model.kpis.unpaired}
                tone={model.kpis.unpaired ? "warning" : "success"}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <CenterKpiCard label="Cảnh báo" value={model.kpis.warnings} tone="warning" />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <CenterKpiCard label="Bảng (Group)" value={model.kpis.groups} />
            </Grid>
          </Grid>
        ) : null}

        {official && model.pairFormationMode ? (
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.7)", mb: 1 }}>
            Cách hình thành: {model.pairFormationMode}
            {model.unitsSource ? ` • nguồn: ${model.unitsSource}` : ""}
            {model.groupDrawPublishStatus
              ? ` • Group Draw status: ${model.groupDrawPublishStatus}`
              : ""}
          </Typography>
        ) : null}

        <Grid container spacing={1.25}>
          <Grid size={{ xs: 12, md: 6 }}>
            <DrawPoolList title="Chưa ghép / còn lại" players={model.poolA} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <DrawPoolList title="Nhóm phụ (không dùng O4)" players={model.poolB} />
          </Grid>
        </Grid>
        <PairDrawHero
          drawNumber={model.live.number}
          playerA={model.live.playerA}
          playerB={model.live.playerB}
          valid={model.live.valid}
          warning={model.live.warning}
        />
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1.25, flexWrap: "wrap" }}>
          {official ? (
            <span title={model.presentHint}>
              <Button
                variant="contained"
                size="small"
                disabled={!model.presentEnabled}
                onClick={handlePresent}
                sx={!model.presentEnabled ? DRAW_ROOM_CONTAINED_DISABLED_SX : undefined}
                data-testid="official-pair-draw-present"
              >
                Trình chiếu cặp
              </Button>
            </span>
          ) : null}
          <span title={model.drawNextHint}>
            <Button variant="contained" size="small" disabled sx={DRAW_ROOM_CONTAINED_DISABLED_SX}>
              Bốc tiếp
            </Button>
          </span>
          <span title={model.undoHint}>
            <Button variant="outlined" size="small" disabled sx={DRAW_ROOM_OUTLINED_SX}>
              Hoàn tác
            </Button>
          </span>
          <Button
            variant="outlined"
            size="small"
            sx={DRAW_ROOM_OUTLINED_SX}
            onClick={() => navigate(individualPairsPath(tournamentId, eventId))}
          >
            Về hình thành cặp
          </Button>
        </Stack>
        <DrawProgressBar current={model.drawnCount} total={model.expectedTotal} />
        <DrawLedgerTable
          title="Kết quả đơn vị cạnh tranh"
          columns={["#", "VĐV A", "VĐV B", "Tổng", "Lệch", "Trạng thái", "Thời điểm"]}
          rows={model.ledger.map((row) => ({
            id: row.id,
            cells: [
              { text: String(row.number).padStart(2, "0"), bold: true },
              { text: row.a },
              { text: row.b },
              { text: row.total },
              { text: row.diff },
              { text: row.valid ? "Hợp lệ" : "Cảnh báo", tone: row.valid ? "success" : "warning" },
              { text: row.time },
            ],
          }))}
        />
        <DrawHistoryList title="Lịch sử trình chiếu (read model)" items={model.history} />
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.55)", mb: 1 }}>
          {official
            ? "Official Pair Draw: đọc cặp đã hình thành. Không ghép lại, không tạo bảng, không ghi trên load/F5/đổi nội dung."
            : "Đang đọc cặp đã đăng ký cùng trên hồ sơ. Chưa bốc thăm ghép mới trên màn này."}
        </Typography>
      </ExperienceDrawRoomShell>

      {official ? <TournamentAnimationDialog {...anim.dialogProps} /> : null}
    </>
  );
}
