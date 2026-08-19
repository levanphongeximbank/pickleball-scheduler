import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Stack, Typography } from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
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
} from "../routes.js";
import { TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";

const TITLE = "Bốc thăm chia bảng";
const SUBTITLE = "Phòng bốc thăm";
const TEST_ID = "tournament-group-draw-page";

export default function IndividualGroupDrawRoomPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "";

  if (loading) return <DrawRoomLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải phòng bốc thăm…" />;
  if (error) return <DrawRoomError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <DrawRoomMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) {
    return <DrawRoomWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  }

  const model = deriveGroupDrawModel(tournament, { selectedEventId });
  const selectEvent = (eventId) => {
    const next = new URLSearchParams(searchParams);
    if (eventId) next.set("eventId", eventId);
    else next.delete("eventId");
    setSearchParams(next);
  };
  const eventId = model.eventId;
  const goGroups = () => navigate(individualGroupStagePath(tournamentId, eventId));

  return (
    <ExperienceDrawRoomShell
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      locked={model.locked}
      statusLabel={model.drawStatusLabel}
      lockDisabled={model.actionState.lockDisabled}
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
              { id: "pair-draw", label: "Ghép cặp / đội", to: individualPairDrawPath(tournamentId, eventId), current: false },
              { id: "group-draw", label: "Chia bảng", to: individualGroupDrawPath(tournamentId, eventId), current: true },
              { id: "groups", label: "Vòng bảng", to: individualGroupStagePath(tournamentId, eventId), current: false },
            ]}
          />
          <DrawRoomEventPicker events={model.events} selectedEventId={selectedEventId} onSelect={selectEvent} />
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
            statusLabel={model.actionState.readinessLabel}
            statusTone={model.actionState.statusTone}
          />
          <DrawRulesPanel rules={model.rules} />
        </>
      }
    >
      {model.emptyEvents ? <Alert severity="info" sx={{ mb: 1.25 }}>Chưa có nội dung trên hồ sơ.</Alert> : null}
      {model.needsEventChoice ? <Alert severity="info" sx={{ mb: 1.25 }}>Chọn nội dung để xem chia bảng.</Alert> : null}
      <DrawPanel title="Cặp chờ bốc">
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.navyTextMuted, mb: 0.75 }}>
          {model.summary.totalPairs} cặp • {model.summary.groups} bảng • {model.summary.method}
        </Typography>
        {model.awaiting.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.navyTextMuted }}>Không còn cặp chờ chia bảng.</Typography>
        ) : (
          <Stack spacing={0.5}>
            {model.awaiting.map((item) => (
              <Typography key={item.id} sx={{ fontSize: 13, color: "#FFF" }}>
                {item.name} • Hạt {item.seed}
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
        <span title={model.drawNextHint}>
          <Button variant="contained" size="small" disabled sx={DRAW_ROOM_CONTAINED_DISABLED_SX}>
            Bốc cặp tiếp theo
          </Button>
        </span>
        <span title={model.undoHint}>
          <Button variant="outlined" size="small" disabled sx={DRAW_ROOM_OUTLINED_SX}>
            Hoàn tác
          </Button>
        </span>
      </Stack>
      <DrawProgressBar current={model.drawnCount} total={model.expectedTotal} />
      <DrawLedgerTable
        title="Kết quả bốc thăm"
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
      <DrawHistoryList title="Lịch sử bốc thăm" items={model.history} />
      <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.55)", mb: 1 }}>
        {model.lockHint}
      </Typography>
    </ExperienceDrawRoomShell>
  );
}
