import { useMemo, useState } from "react";
import { Button, Stack, Typography } from "@mui/material";

import DrawRoomShell, { DrawPanel } from "../components/DrawRoomShell.jsx";
import {
  DrawHistoryList,
  DrawLedgerTable,
  DrawLifecycleButton,
  DrawPresentationOverlay,
  DrawProgressBar,
  DrawReadinessPanel,
  DrawRulesPanel,
  GroupDrawHero,
  GroupStatusCards,
} from "../components/drawRoomSurfaces.jsx";
import { TOURNAMENT_COLOR } from "../design/tournamentDesignTokens.js";
import { DRAW_LOCK_LABEL, resolveDrawRoomActionState } from "../drawRoom/drawRoomActionState.js";
import {
  FIXTURE_GROUP_DRAW_AWAITING,
  FIXTURE_GROUP_DRAW_HISTORY,
  FIXTURE_GROUP_DRAW_LEDGER,
  FIXTURE_GROUP_DRAW_RULES,
  FIXTURE_GROUP_DRAW_SUMMARY,
  FIXTURE_GROUPS,
} from "../fixtures/opsFixture.js";
import { FIXTURE_TOURNAMENT_ID } from "../fixtures/prototypeFixture.js";
import { tournamentPath } from "../navigation/tournamentNav.js";

const TOTAL_GROUP_DRAWS = 32;
const INITIAL_DRAWN = 18;

export default function GroupDrawRoomPage() {
  const [locked, setLocked] = useState(false);
  const [drawnCount, setDrawnCount] = useState(INITIAL_DRAWN);
  const [awaiting, setAwaiting] = useState(FIXTURE_GROUP_DRAW_AWAITING);
  const [ledger, setLedger] = useState(FIXTURE_GROUP_DRAW_LEDGER);
  const [history, setHistory] = useState(FIXTURE_GROUP_DRAW_HISTORY);
  const [groups, setGroups] = useState({
    A: { pairs: ["Minh Quân / Hoàng Nam", "Pair A2", "Pair A3", "Pair A4"], count: 4 },
    B: { pairs: ["Tuấn Anh / Đình Phúc", "Pair B2", "Pair B3", "Pair B4", "Pair B5"], count: 5 },
    C: { pairs: ["Thảo KV / Quốc Khánh", "Pair C2", "Pair C3", "Pair C4"], count: 4 },
    D: { pairs: ["Lan Anh / Minh Trí", "Pair D2", "Pair D3", "Pair D4", "Pair D5"], count: 5 },
  });
  const [live, setLive] = useState({
    number: 18,
    pair: "Gia Bảo / Lê Minh",
    group: "C",
    position: 5,
    capacity: 8,
    valid: true,
  });

  const capacityBalanced = true;
  const constraintsPass = true;
  const actionState = resolveDrawRoomActionState({
    drawnCount,
    expectedTotal: TOTAL_GROUP_DRAWS,
    locked,
    constraintsPass: capacityBalanced && constraintsPass,
    remainingNoun: "cặp chưa chia bảng",
  });

  const groupCards = FIXTURE_GROUPS.map((g) => ({
    id: g.id,
    count: groups[g.id].count,
    capacity: g.pairs,
    seedSummary: `S${groups[g.id].count}`,
    pairs: groups[g.id].pairs,
  }));

  const readinessItems = useMemo(() => [
    { label: "Đã bốc xong", ready: actionState.drawComplete, note: `${drawnCount}/${TOTAL_GROUP_DRAWS}` },
    { label: "Sức chứa cân bằng", ready: capacityBalanced, note: "Mục tiêu 8 cặp/bảng" },
    { label: "Luật hạt giống đạt", ready: true, note: "Rải hạt giống đạt" },
    { label: "Không vi phạm", ready: !FIXTURE_GROUP_DRAW_RULES.some((r) => r.tone === "warning"), note: "1 cảnh báo ưu tiên CLB" },
    { label: "Sẵn sàng khóa", ready: actionState.lockAllowed, note: actionState.lockHelper },
  ], [actionState, capacityBalanced, drawnCount]);

  const drawNext = () => {
    if (locked || !awaiting.length || drawnCount >= TOTAL_GROUP_DRAWS) return;
    const next = awaiting[0];
    const targetGroup = "C";
    const position = groups[targetGroup].count + 1;
    setLive({
      number: drawnCount + 1,
      pair: next.name,
      group: targetGroup,
      position,
      capacity: 8,
      valid: true,
    });
    setGroups((prev) => ({
      ...prev,
      [targetGroup]: {
        pairs: [...prev[targetGroup].pairs, next.name],
        count: prev[targetGroup].count + 1,
      },
    }));
    setLedger((prev) => [
      ...prev,
      { id: `GL-${drawnCount + 1}`, pair: next.name, group: targetGroup, seed: next.seed, position, status: "Valid" },
    ]);
    setHistory((prev) => [
      { time: "10:08", text: `Cặp ${drawnCount + 1} ${next.name} → Bảng ${targetGroup} vị trí ${position}/8`, tone: "success" },
      ...prev.slice(0, 4),
    ]);
    setAwaiting((prev) => prev.slice(1));
    setDrawnCount((c) => c + 1);
  };

  const undoLast = () => {
    if (locked || drawnCount <= INITIAL_DRAWN) return;
    const last = ledger[ledger.length - 1];
    setLedger((prev) => prev.slice(0, -1));
    setDrawnCount((c) => c - 1);
    setGroups((prev) => ({
      ...prev,
      [last.group]: {
        pairs: prev[last.group].pairs.filter((p) => p !== last.pair),
        count: prev[last.group].count - 1,
      },
    }));
    setAwaiting((prev) => [{ id: `GP-R-${last.id}`, name: last.pair, seed: last.seed, pool: "Nhóm A" }, ...prev]);
  };

  const ledgerRows = ledger.map((row) => ({
    id: row.id,
    cells: [
      { text: row.pair },
      { text: `Bảng ${row.group}` },
      { text: `S${row.seed}` },
      { text: `${row.position}/8` },
      { text: row.status === "Valid" ? "Hợp lệ" : row.status, tone: row.status === "Valid" ? "success" : "warning", bold: true },
    ],
  }));

  return (
    <DrawRoomShell
      title="Bốc thăm chia bảng"
      subtitle="Phòng bốc thăm"
      locked={locked}
      onLock={() => setLocked(true)}
      lockLabel={DRAW_LOCK_LABEL}
      lockDisabled={actionState.lockDisabled}
      onUndo={undoLast}
      undoDisabled={drawnCount <= INITIAL_DRAWN}
      expectedTotal={TOTAL_GROUP_DRAWS}
      drawnCount={drawnCount}
      presentation={
        <DrawPresentationOverlay
          tournament="PICK VN OPEN 2026"
          event="Đôi nam 3.5"
          title="Bốc thăm chia bảng"
          subtitle={`Cặp ${String(live.number).padStart(2, "0")} → Bảng ${live.group}`}
          hero={
            <GroupDrawHero
              drawNumber={live.number}
              pairName={live.pair}
              groupId={live.group}
              position={live.position}
              capacity={live.capacity}
              valid={live.valid}
            />
          }
          progress={<DrawProgressBar current={drawnCount} total={TOTAL_GROUP_DRAWS} label="" />}
        />
      }
      rail={
        <>
          <DrawPanel title="Tổng hợp hạt giống / nhóm bốc thăm">
            <Typography sx={{ fontSize: 12.5, color: "#FFF" }}>Tổng: {FIXTURE_GROUP_DRAW_SUMMARY.totalPairs} cặp</Typography>
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.navyTextMuted }}>
              {FIXTURE_GROUP_DRAW_SUMMARY.groups} bảng × {FIXTURE_GROUP_DRAW_SUMMARY.perGroup} cặp
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.navyTextMuted }}>{FIXTURE_GROUP_DRAW_SUMMARY.method}</Typography>
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.navyTextMuted }}>{FIXTURE_GROUP_DRAW_SUMMARY.seedRule}</Typography>
          </DrawPanel>
          <DrawRulesPanel rules={FIXTURE_GROUP_DRAW_RULES} />
          <DrawReadinessPanel
            statusLabel={actionState.statusLabel}
            statusTone={actionState.statusTone}
            items={readinessItems}
          />
          <DrawHistoryList title="Lịch sử bốc thăm gần đây" items={history} />
        </>
      }
    >
      <DrawProgressBar current={drawnCount} total={TOTAL_GROUP_DRAWS} />
      <DrawPanel title="Cặp chờ bốc">
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          {awaiting.map((pair) => (
            <Typography
              key={pair.id}
              sx={{
                px: 1,
                py: 0.5,
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 1,
                fontSize: 12,
                color: "#FFF",
              }}
            >
              {pair.name} • S{pair.seed} • {pair.pool}
            </Typography>
          ))}
        </Stack>
      </DrawPanel>
      <GroupDrawHero
        drawNumber={live.number}
        pairName={live.pair}
        groupId={live.group}
        position={live.position}
        capacity={live.capacity}
        valid={live.valid}
      />
      <Stack direction="row" spacing={1} sx={{ mb: 1.25 }}>
        <Button variant="contained" disabled={actionState.drawNextDisabled} onClick={drawNext}>
          Bốc cặp tiếp theo
        </Button>
        <DrawLifecycleButton to={tournamentPath(FIXTURE_TOURNAMENT_ID, "groups")} disabled={actionState.nextLifecycleDisabled}>
          Sang vòng bảng →
        </DrawLifecycleButton>
      </Stack>
      <GroupStatusCards groups={groupCards} />
      <DrawLedgerTable
        title="Kết quả chia bảng"
        columns={["Cặp", "Bảng", "Hạt giống", "Vị trí", "Trạng thái"]}
        rows={ledgerRows}
      />
    </DrawRoomShell>
  );
}
