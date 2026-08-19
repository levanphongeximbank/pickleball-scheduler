import { useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Grid, Stack, Typography } from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
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
  individualGroupDrawPath,
  individualGroupStagePath,
  individualOverviewPath,
  individualPairDrawPath,
} from "../routes.js";

const TITLE = "Bốc thăm ghép cặp / đội";
const SUBTITLE = "Phòng bốc thăm";
const TEST_ID = "tournament-pair-draw-page";

export default function IndividualPairDrawRoomPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "";

  if (loading) return <DrawRoomLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải phòng bốc thăm…" />;
  if (error) return <DrawRoomError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <DrawRoomMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) {
    return <DrawRoomWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  }

  const model = derivePairDrawModel(tournament, { selectedEventId });
  const selectEvent = (eventId) => {
    const next = new URLSearchParams(searchParams);
    if (eventId) next.set("eventId", eventId);
    else next.delete("eventId");
    setSearchParams(next);
  };
  const eventId = model.eventId;

  return (
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
              { id: "pair-draw", label: "Ghép cặp / đội", to: individualPairDrawPath(tournamentId, eventId), current: true },
              { id: "group-draw", label: "Chia bảng", to: individualGroupDrawPath(tournamentId, eventId), current: false },
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
      {model.emptyEvents ? <Alert severity="info" sx={{ mb: 1.25 }}>Chưa có nội dung trên hồ sơ.</Alert> : null}
      {model.needsEventChoice ? <Alert severity="info" sx={{ mb: 1.25 }}>Chọn nội dung để xem bốc thăm.</Alert> : null}
      <Grid container spacing={1.25}>
        <Grid size={{ xs: 12, md: 6 }}>
          <DrawPoolList title="Nhóm A" players={model.poolA} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <DrawPoolList title="Nhóm B" players={model.poolB} />
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
        <span title={model.drawNextHint}>
          <Button variant="contained" size="small" disabled>
            Bốc tiếp
          </Button>
        </span>
        <span title={model.undoHint}>
          <Button variant="outlined" size="small" disabled sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.2)" }}>
            Hoàn tác
          </Button>
        </span>
      </Stack>
      <DrawProgressBar current={model.drawnCount} total={model.expectedTotal} />
      <DrawLedgerTable
        title="Kết quả bốc thăm"
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
      <DrawHistoryList title="Lịch sử bốc thăm" items={model.history} />
      <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.55)", mb: 1 }}>
        Đang đọc cặp đã đăng ký cùng trên hồ sơ. Chưa bốc thăm ghép mới trên màn này.
      </Typography>
    </ExperienceDrawRoomShell>
  );
}
