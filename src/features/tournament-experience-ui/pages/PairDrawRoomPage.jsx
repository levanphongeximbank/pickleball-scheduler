import { useMemo, useState } from "react";
import { Button, Grid, Stack } from "@mui/material";

import DrawRoomShell from "../components/DrawRoomShell.jsx";
import {
  DrawHistoryList,
  DrawLedgerTable,
  DrawLifecycleButton,
  DrawPoolList,
  DrawPresentationOverlay,
  DrawProgressBar,
  DrawReadinessPanel,
  DrawRulesPanel,
  PairDrawHero,
} from "../components/drawRoomSurfaces.jsx";
import {
  FIXTURE_PAIR_DRAW_HISTORY,
  FIXTURE_PAIR_DRAW_LEDGER,
  FIXTURE_PAIR_DRAW_POOL_A,
  FIXTURE_PAIR_DRAW_POOL_B,
  FIXTURE_PAIR_DRAW_RULES,
  FIXTURE_PAIR_DRAW_TOTAL,
} from "../fixtures/opsFixture.js";
import { DRAW_LOCK_LABEL, resolveDrawRoomActionState } from "../drawRoom/drawRoomActionState.js";
import { FIXTURE_TOURNAMENT_ID } from "../fixtures/prototypeFixture.js";
import { tournamentPath } from "../navigation/tournamentNav.js";

const INITIAL_DRAWN = 8;

export default function PairDrawRoomPage() {
  const [locked, setLocked] = useState(false);
  const [drawnCount, setDrawnCount] = useState(INITIAL_DRAWN);
  const [ledger, setLedger] = useState(FIXTURE_PAIR_DRAW_LEDGER);
  const [history, setHistory] = useState(FIXTURE_PAIR_DRAW_HISTORY);
  const [poolA, setPoolA] = useState(FIXTURE_PAIR_DRAW_POOL_A);
  const [poolB, setPoolB] = useState(FIXTURE_PAIR_DRAW_POOL_B);
  const [live, setLive] = useState({
    number: 8,
    playerA: FIXTURE_PAIR_DRAW_POOL_A[0],
    playerB: FIXTURE_PAIR_DRAW_POOL_B[0],
    valid: true,
    warning: null,
  });

  const constraintsPass = true;
  const actionState = resolveDrawRoomActionState({
    drawnCount,
    expectedTotal: FIXTURE_PAIR_DRAW_TOTAL,
    locked,
    constraintsPass,
    remainingNoun: "cặp chưa bốc",
  });

  const readinessItems = useMemo(() => [
    { label: "Số lượt đã bốc", ready: actionState.drawComplete, note: `${drawnCount}/${FIXTURE_PAIR_DRAW_TOTAL}` },
    { label: "Vi phạm luật", ready: !history.some((h) => h.tone === "warning"), note: "1 cảnh báo hạt giống (dữ liệu mẫu)" },
    { label: "Kiểm tra ràng buộc", ready: constraintsPass, note: "Tách CLB đạt" },
    { label: "Sẵn sàng khóa", ready: actionState.lockAllowed, note: actionState.lockHelper },
  ], [actionState, constraintsPass, drawnCount, history]);

  const drawNext = () => {
    if (locked || drawnCount >= FIXTURE_PAIR_DRAW_TOTAL) return;
    const nextA = poolA[0];
    const nextB = poolB[0];
    if (!nextA || !nextB) return;
    const nextNumber = drawnCount + 1;
    const diff = Math.abs(nextA.rating - nextB.rating);
    const valid = diff <= 0.15;
    setLive({
      number: nextNumber,
      playerA: nextA,
      playerB: nextB,
      valid,
      warning: valid ? null : "Ràng buộc hạt giống",
    });
    setLedger((prev) => [
      ...prev,
      {
        id: `D-${String(nextNumber).padStart(2, "0")}`,
        number: nextNumber,
        a: nextA.name,
        b: nextB.name,
        total: Number((nextA.rating + nextB.rating).toFixed(2)),
        diff,
        valid,
      },
    ]);
    setHistory((prev) => [
      { time: "09:18", text: `#${String(nextNumber).padStart(2, "0")} ${nextA.name} + ${nextB.name} — ${valid ? "Hợp lệ" : "Cảnh báo"}`, tone: valid ? "success" : "warning" },
      ...prev.slice(0, 4),
    ]);
    setPoolA((prev) => prev.slice(1));
    setPoolB((prev) => prev.slice(1));
    setDrawnCount((c) => c + 1);
  };

  const undoLast = () => {
    if (locked || drawnCount <= INITIAL_DRAWN) return;
    const last = ledger[ledger.length - 1];
    setLedger((prev) => prev.slice(0, -1));
    setDrawnCount((c) => c - 1);
    setPoolA((prev) => [{ id: `PA-R-${last.number}`, name: last.a, club: "—", rating: 0 }, ...prev]);
    setPoolB((prev) => [{ id: `PB-R-${last.number}`, name: last.b, club: "—", rating: 0 }, ...prev]);
    setLive({
      number: last.number - 1,
      playerA: { name: last.a, club: "—", rating: 0 },
      playerB: { name: last.b, club: "—", rating: 0 },
      valid: last.valid,
      warning: null,
    });
  };

  const ledgerRows = ledger.map((row) => ({
    id: row.id,
    cells: [
      { text: `#${row.number}` },
      { text: row.a },
      { text: row.b },
      { text: row.total.toFixed(2) },
      { text: row.diff.toFixed(2) },
      { text: row.valid ? "Hợp lệ" : "Cảnh báo", tone: row.valid ? "success" : "warning", bold: true },
    ],
  }));

  return (
    <DrawRoomShell
      title="Bốc thăm ghép cặp / đội"
      locked={locked}
      onLock={() => setLocked(true)}
      lockLabel={DRAW_LOCK_LABEL}
      lockDisabled={actionState.lockDisabled}
      onUndo={undoLast}
      undoDisabled={drawnCount <= INITIAL_DRAWN}
      expectedTotal={FIXTURE_PAIR_DRAW_TOTAL}
      drawnCount={drawnCount}
      presentation={
        <DrawPresentationOverlay
          tournament="PICK VN OPEN 2026"
          event="Đôi nam 3.5"
          title="Bốc thăm ghép cặp"
          subtitle={`Cặp ${String(live.number).padStart(2, "0")} • ${drawnCount}/${FIXTURE_PAIR_DRAW_TOTAL}`}
          hero={
            <PairDrawHero
              drawNumber={live.number}
              playerA={live.playerA}
              playerB={live.playerB}
              valid={live.valid}
              warning={live.warning}
            />
          }
          progress={<DrawProgressBar current={drawnCount} total={FIXTURE_PAIR_DRAW_TOTAL} label="" />}
        />
      }
      rail={
        <>
          <DrawRulesPanel rules={FIXTURE_PAIR_DRAW_RULES} />
          <DrawReadinessPanel
            title="Mức sẵn sàng"
            statusLabel={actionState.statusLabel}
            statusTone={actionState.statusTone}
            items={readinessItems}
          />
          <DrawHistoryList title="Lịch sử gần đây" items={history} />
        </>
      }
    >
      <DrawProgressBar current={drawnCount} total={FIXTURE_PAIR_DRAW_TOTAL} />
      <Grid container spacing={1.25}>
        <Grid size={{ xs: 12, md: 3 }}>
          <DrawPoolList title="Nhóm A" players={poolA} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <PairDrawHero
            drawNumber={live.number}
            playerA={live.playerA}
            playerB={live.playerB}
            valid={live.valid}
            warning={live.warning}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button variant="contained" disabled={actionState.drawNextDisabled} onClick={drawNext}>
              Bốc tiếp
            </Button>
            <DrawLifecycleButton to={tournamentPath(FIXTURE_TOURNAMENT_ID, "group-draw")} disabled={actionState.nextLifecycleDisabled}>
              Sang bốc thăm chia bảng →
            </DrawLifecycleButton>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <DrawPoolList title="Nhóm B" players={poolB} />
        </Grid>
      </Grid>
      <DrawLedgerTable
        title="Kết quả đã bốc"
        columns={["#", "VĐV A", "VĐV B", "Tổng", "Chênh", "Hợp lệ"]}
        rows={ledgerRows}
      />
    </DrawRoomShell>
  );
}
