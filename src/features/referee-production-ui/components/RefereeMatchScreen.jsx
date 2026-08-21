import { Link as RouterLink } from "react-router-dom";
import { useEffect, useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import GroupsIcon from "@mui/icons-material/Groups";
import SportsVolleyballIcon from "@mui/icons-material/SportsVolleyball";
import PersonIcon from "@mui/icons-material/Person";
import FlagIcon from "@mui/icons-material/Flag";
import ListAltIcon from "@mui/icons-material/ListAlt";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PauseCircleOutlinedIcon from "@mui/icons-material/PauseCircleOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CanonicalCourtView from "./CanonicalCourtView.jsx";
import { deriveCourtPresentation } from "../projection/deriveCourtPresentation.js";

function Banner({ kind, children, testId }) {
  return (
    <div className={`rp-banner rp-banner-${kind}`} data-testid={testId}>
      {children}
    </div>
  );
}

function pointLabel(displayName, fallback) {
  const name = String(displayName || "").trim();
  if (!name) return `+ Điểm ${fallback}`;
  return `+ Điểm ${name}`;
}

function DreamBreakerPanel({ db }) {
  if (!db?.isDreambreaker) return null;
  if (!db.hasActiveRotation) {
    return (
      <Banner kind="warn" testId="dreambreaker-fail-closed">
        DreamBreaker thiếu dữ liệu xoay vòng từ Team domain.
      </Banner>
    );
  }
  return (
    <div className="rp-db" data-testid="dreambreaker-panel">
      <strong>DreamBreaker</strong>
      <div className="rp-db-grid">
        <div data-testid="db-side-a">
          <span className="rp-db-label">Đang thi đấu A</span>
          <p>{db.sideAActivePlayer?.displayName || "Chưa có VĐV"}</p>
          {db.nextPlayerA ? (
            <span className="rp-db-next">Tiếp: {db.nextPlayerA.displayName}</span>
          ) : null}
        </div>
        <div data-testid="db-side-b">
          <span className="rp-db-label">Đang thi đấu B</span>
          <p>{db.sideBActivePlayer?.displayName || "Chưa có VĐV"}</p>
          {db.nextPlayerB ? (
            <span className="rp-db-next">Tiếp: {db.nextPlayerB.displayName}</span>
          ) : null}
        </div>
      </div>
      {db.rotationProgress ? (
        <p className="rp-db-progress" data-testid="db-rotation-progress">
          Xoay vòng {db.rotationProgress.pointsInRotation ?? "—"}/
          {db.rotationProgress.rotationPoints ?? "—"}
        </p>
      ) : null}
    </div>
  );
}

function RulesPanel({ rules }) {
  if (!rules?.rows?.length) return null;
  return (
    <section className="rp-rules" data-testid="match-rules-panel">
      <h2 className="rp-rules-title">
        <ListAltIcon fontSize="inherit" aria-hidden="true" />
        {rules.title || "LUẬT TRẬN"}
      </h2>
      <dl className="rp-rules-grid">
        {rules.rows.map((row) => (
          <div key={row.key} className="rp-rules-row" data-testid={`rule-${row.key}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ServingStatusStrip({ serving, expectedVersion, compactVersion = true }) {
  if (!serving) return null;
  const hasAny =
    serving.servingTeamName ||
    serving.servingPlayerName ||
    serving.receivingPlayerName ||
    (serving.showServiceTurn && serving.serviceTurn != null) ||
    serving.gameLabel;
  if (!hasAny) return null;
  const turnLabel =
    serving.serviceTurn != null ? String(serving.serviceTurn) : "—";
  return (
    <div className="rp-serve-strip" data-testid="serving-status-strip">
      <span className="rp-serve-cell" data-testid="serve-team">
        <SportsVolleyballIcon className="rp-serve-icon" fontSize="inherit" aria-hidden="true" />
        <span>
          Giao bóng
          <strong data-testid="serving-player-name">
            {serving.servingPlayerName || "—"}
          </strong>
        </span>
      </span>
      <span className="rp-serve-cell" data-testid="receive-player">
        <PersonIcon className="rp-serve-icon rp-serve-icon-teal" fontSize="inherit" aria-hidden="true" />
        <span>
          Đỡ bóng
          <strong data-testid="receiving-player-name">
            {serving.receivingPlayerName || "—"}
          </strong>
        </span>
      </span>
      {serving.showServiceTurn ? (
        <span className="rp-serve-cell" data-testid="service-turn">
          <PersonIcon className="rp-serve-icon rp-serve-icon-green" fontSize="inherit" aria-hidden="true" />
          <span>
            Lượt giao
            <strong data-testid="service-turn-number">{turnLabel}</strong>
          </span>
        </span>
      ) : null}
      {serving.serviceCourtLabel ? (
        <span className="rp-serve-cell" data-testid="service-court">
          <SyncAltIcon className="rp-serve-icon rp-serve-icon-muted" fontSize="inherit" aria-hidden="true" />
          <span>
            Ô giao
            <strong data-testid="service-court-label">{serving.serviceCourtLabel}</strong>
          </span>
        </span>
      ) : null}
      {serving.receiverCourtLabel ? (
        <span className="rp-serve-cell" data-testid="receiver-court">
          <SyncAltIcon className="rp-serve-icon rp-serve-icon-muted" fontSize="inherit" aria-hidden="true" />
          <span>
            Ô nhận
            <strong data-testid="receiver-court-label">{serving.receiverCourtLabel}</strong>
          </span>
        </span>
      ) : null}
      {serving.serviceDirection ? (
        <span className="rp-serve-cell" data-testid="service-direction">
          <SyncAltIcon className="rp-serve-icon rp-serve-icon-muted" fontSize="inherit" aria-hidden="true" />
          <span>
            Hướng giao
            <strong>{serving.serviceDirection}</strong>
          </span>
        </span>
      ) : null}
      {serving.gameLabel ? (
        <span className="rp-serve-cell" data-testid="serve-game">
          <EmojiEventsIcon className="rp-serve-icon rp-serve-icon-muted" fontSize="inherit" aria-hidden="true" />
          <span>
            Game
            <strong>{serving.gameLabel.replace(/^Game\s+/i, "")}</strong>
          </span>
        </span>
      ) : null}
      {expectedVersion != null && !compactVersion ? (
        <span className="rp-serve-cell rp-serve-version" data-testid="serve-version">
          <InfoOutlinedIcon className="rp-serve-icon rp-serve-icon-info" fontSize="inherit" aria-hidden="true" />
          <span>
            Version
            <strong>{expectedVersion}</strong>
          </span>
        </span>
      ) : null}
    </div>
  );
}

function OperationHistoryPanel({ history }) {
  if (!history) return null;
  const rows = Array.isArray(history.rows) ? history.rows : [];
  return (
    <section className="rp-op-history" data-testid="match-operation-history">
      <h2 className="rp-op-history-title">Lịch sử trận</h2>
      {rows.length === 0 ? (
        <p className="rp-sub" data-testid="match-history-empty">
          Chưa có sự kiện ghi điểm từ runtime.
        </p>
      ) : (
        <ol className="rp-op-history-list" data-testid="match-history-list" data-source={history.source || "canonical"}>
          {[...rows].reverse().map((row) => (
            <li key={row.id} data-testid={`history-row-${row.kind}`} data-history-kind={row.kind}>
              <strong>{row.label}</strong>
              {row.detail ? <span>{row.detail}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SideIdentityBlock({ sideKey, entryLabel, members, playerNames, testId }) {
  const rows =
    Array.isArray(members) && members.length
      ? members.map((m) => ({
          id: m.participantId || m.displayName || m.name,
          name: m.displayName || m.name || "Chưa có tên",
          position: m.logicalPositionLabel || null,
        }))
      : Array.isArray(playerNames)
        ? playerNames.filter(Boolean).map((name) => ({ id: name, name, position: null }))
        : [];
  return (
    <div className="rp-side-identity" data-testid={testId}>
      <span className="rp-side-identity-key">Side {sideKey}</span>
      {entryLabel ? (
        <strong className="rp-side-entry" data-testid={`${testId}-entry`}>
          {entryLabel}
        </strong>
      ) : null}
      <ul className="rp-side-athletes" data-testid={`${testId}-athletes`}>
        {rows.length ? (
          rows.map((row) => (
            <li key={row.id}>
              {row.position ? <span className="rp-logical-pos">{row.position}</span> : null}
              {row.name}
            </li>
          ))
        ) : (
          <li className="rp-side-athlete-empty">Chưa có tên VĐV</li>
        )}
      </ul>
    </div>
  );
}

function LineupSetupPanel({
  view,
  open,
  pending,
  stale,
  onClose,
  onConfirm,
}) {
  const court = view?.courtProjection || {};
  const left = court.sides?.left || {};
  const right = court.sides?.right || {};
  const leftIsA = (left.scoringSide || "SIDE_A") === "SIDE_A";
  const sideASource = leftIsA ? left : right;
  const sideBSource = leftIsA ? right : left;
  const initialSideA = (sideASource.activePlayers || []).map((p) => p.playerId).filter(Boolean);
  const initialSideB = (sideBSource.activePlayers || []).map((p) => p.playerId).filter(Boolean);
  const sideAKey = initialSideA.join("|");
  const sideBKey = initialSideB.join("|");
  const isDoublesLineup =
    view?.expectedPlayersPerSide === 2 ||
    view?.isDoubles === true ||
    court.geometry === "DOUBLES" ||
    initialSideA.length >= 2 ||
    initialSideB.length >= 2;
  const isSideOut = view?.isSideOut === true;
  const openingTurnDefault = (() => {
    const fromCourt = Number(court.serving?.serviceTurn);
    if (Number.isFinite(fromCourt) && fromCourt > 0) return fromCourt;
    const fromMeta = Number(view?.scoringRules?.metadata?.openingServiceTurn);
    if (isSideOut && isDoublesLineup) {
      return Number.isFinite(fromMeta) && fromMeta > 0 ? fromMeta : 2;
    }
    return 1;
  })();
  const [sideA, setSideA] = useState([]);
  const [sideB, setSideB] = useState([]);
  const [serverPlayerId, setServerPlayerId] = useState("");
  const [serverNumber, setServerNumber] = useState(openingTurnDefault);

  useEffect(() => {
    if (!open) return;
    const nextA = sideAKey ? sideAKey.split("|") : [];
    const nextB = sideBKey ? sideBKey.split("|") : [];
    setSideA(nextA);
    setSideB(nextB);
    setServerPlayerId(
      court.serving?.serverPlayerId || nextA[0] || nextB[0] || ""
    );
    setServerNumber(openingTurnDefault);
  }, [open, view?.matchId, sideAKey, sideBKey, court.serving?.serverPlayerId, openingTurnDefault]);

  if (!open) return null;

  const names = {};
  for (const p of [
    ...(left.activePlayers || []),
    ...(right.activePlayers || []),
  ]) {
    if (p?.playerId) {
      names[p.playerId] = p.displayName || "VĐV";
    }
  }

  const labelA = sideASource.participant?.displayName || "Bên A";
  const labelB = sideBSource.participant?.displayName || "Bên B";

  const swap = (side) => {
    if (side === "A") setSideA((prev) => (prev.length >= 2 ? [prev[1], prev[0]] : prev));
    else setSideB((prev) => (prev.length >= 2 ? [prev[1], prev[0]] : prev));
  };

  const allPlayers = [
    ...sideA.map((id) => ({ id, side: "A", name: names[id] || "VĐV" })),
    ...sideB.map((id) => ({ id, side: "B", name: names[id] || "VĐV" })),
  ];

  const canConfirm = Boolean(serverPlayerId) && !pending && !stale;
  const positionLabel = (sideIds, index) => {
    if (!isDoublesLineup) return null;
    return index === 0 ? "RIGHT" : index === 1 ? "LEFT" : null;
  };

  return (
    <section className="rp-lineup-panel" data-testid="lineup-setup-panel">
      <h2 className="rp-lineup-title">Sắp xếp đội hình (bắt buộc)</h2>
      <p className="rp-lineup-hint">
        Chọn vị trí VĐV trên sân và người giao bóng đầu tiên trước khi ghi điểm.
        {isDoublesLineup ? " Vị trí: RIGHT / LEFT." : null}
      </p>

      <div className="rp-lineup-sides">
        <div className="rp-lineup-side" data-testid="lineup-side-a">
          <strong>{labelA}</strong>
          <ol data-testid="lineup-side-a-players">
            {sideA.map((id, index) => (
              <li key={id} data-testid={`lineup-player-${id}`} data-participant-id={id}>
                {positionLabel(sideA, index) ? (
                  <span className="rp-logical-pos" data-testid={`lineup-pos-${id}`}>
                    {positionLabel(sideA, index)}
                  </span>
                ) : null}{" "}
                {names[id] || id}
              </li>
            ))}
          </ol>
          {sideA.length >= 2 ? (
            <button
              type="button"
              className="rp-btn rp-btn-ghost rp-btn-inline"
              disabled={pending}
              onClick={() => swap("A")}
              data-testid="btn-swap-side-a"
            >
              Đổi RIGHT ↔ LEFT
            </button>
          ) : null}
        </div>
        <div className="rp-lineup-side" data-testid="lineup-side-b">
          <strong>{labelB}</strong>
          <ol data-testid="lineup-side-b-players">
            {sideB.map((id, index) => (
              <li key={id} data-testid={`lineup-player-${id}`} data-participant-id={id}>
                {positionLabel(sideB, index) ? (
                  <span className="rp-logical-pos" data-testid={`lineup-pos-${id}`}>
                    {positionLabel(sideB, index)}
                  </span>
                ) : null}{" "}
                {names[id] || id}
              </li>
            ))}
          </ol>
          {sideB.length >= 2 ? (
            <button
              type="button"
              className="rp-btn rp-btn-ghost rp-btn-inline"
              disabled={pending}
              onClick={() => swap("B")}
              data-testid="btn-swap-side-b"
            >
              Đổi RIGHT ↔ LEFT
            </button>
          ) : null}
        </div>
      </div>

      <fieldset className="rp-lineup-fieldset">
        <legend>Người giao bóng đầu tiên</legend>
        <div className="rp-lineup-servers" data-testid="lineup-server-options">
          {allPlayers.map((p) => (
            <label key={p.id} className="rp-lineup-option" data-testid={`lineup-server-${p.id}`}>
              <input
                type="radio"
                name="opening-server"
                value={p.id}
                checked={serverPlayerId === p.id}
                onChange={() => setServerPlayerId(p.id)}
                disabled={pending}
                data-participant-id={p.id}
              />
              <span>
                {p.name}
                <em> ({p.side === "A" ? labelA : labelB})</em>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {isSideOut && isDoublesLineup ? (
        <fieldset className="rp-lineup-fieldset">
          <legend>Lượt giao</legend>
          <div className="rp-lineup-turns" data-testid="lineup-turn-options">
            {[1, 2].map((n) => (
              <label key={n} className="rp-lineup-option">
                <input
                  type="radio"
                  name="service-turn"
                  value={n}
                  checked={serverNumber === n}
                  onChange={() => setServerNumber(n)}
                  disabled={pending}
                />
                <span>Lượt {n}</span>
              </label>
            ))}
          </div>
          <p className="rp-lineup-hint" data-testid="opening-turn-hint">
            Side-Out đôi: mở đầu mặc định 0-0-2.
          </p>
        </fieldset>
      ) : null}

      <div className="rp-lineup-actions">
        {!view?.lineupRequired ? (
          <button
            type="button"
            className="rp-btn rp-btn-ghost"
            disabled={pending}
            onClick={onClose}
            data-testid="btn-lineup-cancel"
          >
            Đóng
          </button>
        ) : null}
        <button
          type="button"
          className="rp-btn rp-btn-primary"
          disabled={!canConfirm}
          onClick={() =>
            onConfirm?.({
              playerPositions: { sideA, sideB },
              serverPlayerId,
              serverNumber: isSideOut && isDoublesLineup ? serverNumber : 1,
              servingSide: sideA.includes(serverPlayerId)
                ? "SIDE_A"
                : sideB.includes(serverPlayerId)
                  ? "SIDE_B"
                  : "SIDE_A",
            })
          }
          data-testid="btn-lineup-confirm"
        >
          Xác nhận đội hình
        </button>
      </div>
    </section>
  );
}

function GameHistoryPanel({ summary }) {
  if (!summary) return null;
  const current = summary.currentGamePoints;
  const previous = Array.isArray(summary.previousGames) ? summary.previousGames : [];
  const last = previous.length ? previous[previous.length - 1] : null;
  return (
    <section className="rp-game-history" data-testid="game-summary-panel">
      <div className="rp-game-history-half" data-testid="current-game-summary">
        <span className="rp-game-history-label">
          Game {summary.currentGame || 1} (hiện tại)
        </span>
        {current ? (
          <span className="rp-game-history-score">
            A <strong>{current.sideA}</strong> • <strong>{current.sideB}</strong> B
          </span>
        ) : (
          <span className="rp-game-history-score">—</span>
        )}
      </div>
      <div className="rp-game-history-half" data-testid="previous-game-history">
        <span className="rp-game-history-label">Game trước</span>
        {last ? (
          <span className="rp-game-history-score">
            A <strong>{last.sideA}</strong> • <strong>{last.sideB}</strong> B
          </span>
        ) : (
          <span className="rp-game-history-score">—</span>
        )}
      </div>
      {summary.bestOf ? (
        <div className="rp-game-won" data-testid="games-won">
          Games won: {Number(summary.gamesWon?.SIDE_A || 0)}–
          {Number(summary.gamesWon?.SIDE_B || 0)}
          {` (Best of ${summary.bestOf})`}
        </div>
      ) : null}
    </section>
  );
}

export default function RefereeMatchScreen({
  view,
  loading,
  error,
  pendingAction,
  stale,
  onStart,
  onPointA,
  onPointB,
  onSuspend,
  onResume,
  onChangeEnds,
  onConfigureLineup,
  onChangeServe,
  onUndoLastScoringAction,
  onSubmitResult,
  onCorrect,
  onReload,
}) {
  const [confirmChangeEnds, setConfirmChangeEnds] = useState(false);
  const [lineupOpen, setLineupOpen] = useState(false);

  useEffect(() => {
    if (view?.lineupRequired) setLineupOpen(true);
  }, [view?.lineupRequired, view?.matchId]);

  if (loading) {
    return (
      <div className="rp-page rp-page-match" data-testid="referee-match-screen">
        <p className="rp-sub">Đang tải trận…</p>
      </div>
    );
  }

  if (error && !view) {
    return (
      <div className="rp-page rp-page-match" data-testid="referee-match-screen">
        <Banner kind="error" testId="match-error">
          {error}
        </Banner>
        <button type="button" className="rp-btn rp-btn-ghost" onClick={onReload}>
          Tải lại
        </button>
      </div>
    );
  }

  if (!view) return null;

  const court = view.courtProjection || {};
  const pending = Boolean(pendingAction);
  const db = court.dreambreaker;
  // One shared orientation authority for scoreboard, court, and +Point buttons.
  const presentation = deriveCourtPresentation(view);
  const leftScoring = presentation.leftScoringSide;
  const rightScoring = presentation.rightScoringSide;
  const leftTeam = presentation.leftTeam;
  const rightTeam = presentation.rightTeam;
  const leftPlayersLine = presentation.leftParticipants.length
    ? presentation.leftParticipants.join(" / ")
    : null;
  const rightPlayersLine = presentation.rightParticipants.length
    ? presentation.rightParticipants.join(" / ")
    : null;
  const leftName = leftTeam;
  const rightName = rightTeam;
  const leftPointHandler =
    leftScoring === "SIDE_B" ? onPointB : onPointA;
  const rightPointHandler =
    rightScoring === "SIDE_A" ? onPointA : onPointB;
  const leftCanPoint =
    leftScoring === "SIDE_B" ? view.canPointSideB : view.canPointSideA;
  const rightCanPoint =
    rightScoring === "SIDE_A" ? view.canPointSideA : view.canPointSideB;
  const leftPendingKey = `point:${leftScoring}`;
  const rightPendingKey = `point:${rightScoring}`;
  const changeEndsRequired = court.sideChangeRequired === true;
  const changeEndConfirmBlocked =
    pending ||
    stale ||
    view.changeEndConfirmBlocked === true ||
    view.isOptimisticPresentation === true;
  const showManualChangeEnds = view.canChangeEnds === true && !changeEndsRequired;
  const changeEndAt =
    view.servingStatus?.changeEndAt ||
    view.rulesPanel?.changeEndAt ||
    view.gameSummary?.changeEndPolicy ||
    null;
  const scoreA = presentation.leftScore;
  const scoreB = presentation.rightScore;
  const statusLive =
    String(view.matchStatus || "").toUpperCase() === "IN_PROGRESS" ||
    /đang/i.test(String(view.matchStatusLabel || ""));
  const versionLabel =
    view.diagnostics?.expectedVersion ?? view.expectedVersion ?? null;

  const handleConfirmChangeEnds = () => {
    setConfirmChangeEnds(false);
    onChangeEnds?.();
  };

  return (
    <div
      className="rp-page rp-page-match"
      data-testid="referee-match-screen"
      data-mode={view.competitionMode}
      data-pending={pending ? "true" : "false"}
      data-stale={stale ? "true" : "false"}
    >
      <header className="rp-match-header" data-testid="match-header">
        <div className="rp-match-header-top">
          <RouterLink
            className="rp-match-back-icon"
            to="/referee"
            aria-label="Quay lại danh sách trận"
            data-testid="btn-back-assignments"
          >
            <ArrowBackIcon fontSize="small" />
          </RouterLink>
          <h1 className="rp-match-title">Điều hành trận</h1>
          {view.matchStatusLabel ? (
            <span
              className={`rp-live-badge${statusLive ? " is-live" : ""}`}
              data-testid="match-status-badge"
            >
              ((•)) {String(view.matchStatusLabel).toUpperCase()}
            </span>
          ) : null}
        </div>
      </header>

      {view.resultStatus && view.resultStatus !== "NONE" ? (
        <Banner
          kind={view.acceptedOfficialResult ? "ok" : "info"}
          testId="result-status"
        >
          {view.resultStatusLabel}
        </Banner>
      ) : null}

      {stale ? (
        <Banner kind="warn" testId="stale-banner">
          Dữ liệu đã đổi trên máy chủ. Hòa giải trước khi ghi điểm.
          <button
            type="button"
            className="rp-btn rp-btn-ghost rp-btn-inline"
            onClick={onReload}
            data-testid="btn-reconcile"
          >
            Hòa giải
          </button>
        </Banner>
      ) : null}

      {pending ? (
        <Banner kind="info" testId="pending-banner">
          Đang xác nhận...
        </Banner>
      ) : null}

      {error ? (
        <Banner kind="error" testId="match-error">
          {error}
        </Banner>
      ) : null}

      {view.preStart && view.preStart.ok === false ? (
        <Banner kind="warn" testId="precheck-banner">
          Chưa đủ điều kiện bắt đầu. Kiểm tra phân công và đội hình rồi thử lại.
        </Banner>
      ) : null}

      {view.lineupRequired ? (
        <Banner kind="warn" testId="lineup-required-banner">
          Bắt buộc sắp xếp đội hình: chọn người giao bóng đầu tiên và vị trí VĐV trên sân.
        </Banner>
      ) : null}

      <div className="rp-console" data-testid="referee-console-layout">
        <aside className="rp-zone rp-zone-context" data-testid="console-zone-context">
          <div className="rp-match-context" data-testid="match-context-row">
            <span className="rp-match-context-item">
              <SportsTennisIcon fontSize="inherit" aria-hidden="true" />
              {view.courtLabel || "Sân?"}
            </span>
            <span className="rp-match-context-item">
              <EmojiEventsIcon fontSize="inherit" aria-hidden="true" />
              {view.competitionName}
            </span>
            {view.competitionModeLabel ? (
              <span className="rp-match-context-item" data-testid="match-mode-label">
                <GroupsIcon fontSize="inherit" aria-hidden="true" />
                {view.competitionModeLabel}
              </span>
            ) : null}
            {view.competitionContentLabel ? (
              <span className="rp-match-context-item" data-testid="match-content-label">
                <FlagIcon fontSize="inherit" aria-hidden="true" />
                {view.competitionContentLabel}
              </span>
            ) : null}
            <span className="rp-match-context-item">
              <AccountTreeIcon fontSize="inherit" aria-hidden="true" />
              {view.stageRoundLabel || view.stageName || view.roundName || "—"}
            </span>
          </div>

          <div className="rp-side-stack" data-testid="match-side-identities">
            <SideIdentityBlock
              sideKey="A"
              entryLabel={view.participantDisplay?.sideA?.entryLabel || view.participantDisplay?.sideA?.label}
              members={view.participantDisplay?.sideA?.members}
              playerNames={view.participantDisplay?.sideA?.playerNames}
              testId="side-identity-a"
            />
            <SideIdentityBlock
              sideKey="B"
              entryLabel={view.participantDisplay?.sideB?.entryLabel || view.participantDisplay?.sideB?.label}
              members={view.participantDisplay?.sideB?.members}
              playerNames={view.participantDisplay?.sideB?.playerNames}
              testId="side-identity-b"
            />
          </div>

          <RulesPanel rules={view.rulesPanel} />
          {versionLabel != null ? (
            <p className="rp-technical-detail" data-testid="serve-version">
              <InfoOutlinedIcon fontSize="inherit" aria-hidden="true" /> Version {versionLabel}
            </p>
          ) : null}
        </aside>

        <main className="rp-zone rp-zone-score" data-testid="console-zone-score">
          <section
            className="rp-scoreboard"
            data-testid="scoreboard"
            data-orientation={presentation.courtOrientation}
            data-left-scoring-side={leftScoring}
            data-right-scoring-side={rightScoring}
            aria-live="polite"
          >
            <div className="rp-scoreboard-trio" data-testid="current-game-score">
              <div
                className={`rp-score-side${
                  presentation.servingSide === leftScoring ? " is-serving" : ""
                }`}
              >
                <GroupsIcon className="rp-score-side-icon" fontSize="small" aria-hidden="true" />
                <div className="rp-score-team-name" data-testid="team-name-a">
                  {leftTeam}
                </div>
                {leftPlayersLine && leftPlayersLine !== leftTeam ? (
                  <div className="rp-score-label" data-testid="participant-names-a">
                    {leftPlayersLine}
                  </div>
                ) : (
                  <div className="rp-score-label" data-testid="participant-names-a">
                    {leftPlayersLine || leftTeam}
                  </div>
                )}
              </div>
              <div className="rp-score-center">
                <span
                  className={`rp-score-num${pending && String(pendingAction || "").startsWith("point") ? " is-pending" : ""}`}
                  data-testid="score-a"
                >
                  {scoreA}
                </span>
                <span className="rp-score-colon" aria-hidden="true">
                  :
                </span>
                <span
                  className={`rp-score-num${pending && String(pendingAction || "").startsWith("point") ? " is-pending" : ""}`}
                  data-testid="score-b"
                >
                  {scoreB}
                </span>
                {pending && String(pendingAction || "").startsWith("point") ? (
                  <span className="rp-score-pending" data-testid="score-pending-hint">
                    Đang xác nhận...
                  </span>
                ) : null}
              </div>
              <div
                className={`rp-score-side rp-score-side-right${
                  presentation.servingSide === rightScoring ? " is-serving" : ""
                }`}
              >
                <GroupsIcon className="rp-score-side-icon" fontSize="small" aria-hidden="true" />
                <div className="rp-score-team-name" data-testid="team-name-b">
                  {rightTeam}
                </div>
                {rightPlayersLine && rightPlayersLine !== rightTeam ? (
                  <div className="rp-score-label" data-testid="participant-names-b">
                    {rightPlayersLine}
                  </div>
                ) : (
                  <div className="rp-score-label" data-testid="participant-names-b">
                    {rightPlayersLine || rightTeam}
                  </div>
                )}
              </div>
            </div>
          </section>

          <ServingStatusStrip serving={view.servingStatus} expectedVersion={versionLabel} />

          <CanonicalCourtView courtProjection={court} />

          <DreamBreakerPanel db={db} />

          <LineupSetupPanel
            view={view}
            open={lineupOpen || view.lineupRequired === true}
            pending={pending}
            stale={stale}
            onClose={() => setLineupOpen(false)}
            onConfirm={async (payload) => {
              const result = await onConfigureLineup?.(payload);
              if (result?.ok !== false) setLineupOpen(false);
            }}
          />

          {view.canSwitchPositions || view.lineupRequired ? (
            <button
              type="button"
              className={`rp-btn rp-btn-ghost rp-btn-lineup${view.lineupRequired ? " is-required" : ""}`}
              disabled={pending || stale}
              onClick={() => setLineupOpen(true)}
              data-testid="btn-switch-positions"
            >
              <GroupsIcon fontSize="small" aria-hidden="true" />
              Sắp xếp đội hình
              {view.lineupRequired ? " *" : ""}
            </button>
          ) : null}

          {view.canStart ? (
            <button
              type="button"
              className="rp-btn rp-btn-primary rp-actions-wide"
              disabled={pending || stale}
              onClick={onStart}
              data-testid="btn-start"
            >
              Bắt đầu trận
            </button>
          ) : null}

          {view.canScore ? (
            <div className="rp-score-actions" data-testid="score-actions">
              {view.isSideOut ? (
                <>
                  {leftCanPoint ? (
                    <button
                      type="button"
                      className="rp-btn rp-btn-a rp-actions-wide"
                      disabled={pending || stale}
                      onClick={leftPointHandler}
                      data-testid={
                        leftScoring === "SIDE_A" ? "btn-point-a" : "btn-point-b"
                      }
                      data-scoring-side={leftScoring}
                      data-display-end="left"
                    >
                      {String(pendingAction || "").startsWith("point")
                        ? "Đang xác nhận..."
                        : pointLabel(leftName, leftScoring === "SIDE_B" ? "B" : "A")}
                    </button>
                  ) : null}
                  {rightCanPoint ? (
                    <button
                      type="button"
                      className="rp-btn rp-btn-b rp-actions-wide"
                      disabled={pending || stale}
                      onClick={rightPointHandler}
                      data-testid={
                        rightScoring === "SIDE_B" ? "btn-point-b" : "btn-point-a"
                      }
                      data-scoring-side={rightScoring}
                      data-display-end="right"
                    >
                      {String(pendingAction || "").startsWith("point")
                        ? "Đang xác nhận..."
                        : pointLabel(rightName, rightScoring === "SIDE_A" ? "A" : "B")}
                    </button>
                  ) : null}
                  {view.canChangeServe ? (
                    <button
                      type="button"
                      className="rp-btn rp-btn-warn rp-actions-wide"
                      disabled={pending || stale}
                      onClick={onChangeServe}
                      data-testid="btn-change-serve"
                    >
                      {pendingAction === "change-serve" ? "Đang xác nhận..." : "ĐỔI GIAO"}
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="rp-btn rp-btn-a"
                    disabled={pending || stale || leftCanPoint === false}
                    onClick={leftPointHandler}
                    data-testid={leftScoring === "SIDE_A" ? "btn-point-a" : "btn-point-b"}
                    data-scoring-side={leftScoring}
                    data-display-end="left"
                  >
                    {String(pendingAction || "") === leftPendingKey
                      ? "Đang xác nhận..."
                      : pointLabel(leftName, leftScoring === "SIDE_B" ? "B" : "A")}
                  </button>
                  <button
                    type="button"
                    className="rp-btn rp-btn-b"
                    disabled={pending || stale || rightCanPoint === false}
                    onClick={rightPointHandler}
                    data-testid={rightScoring === "SIDE_B" ? "btn-point-b" : "btn-point-a"}
                    data-scoring-side={rightScoring}
                    data-display-end="right"
                  >
                    {String(pendingAction || "") === rightPendingKey
                      ? "Đang xác nhận..."
                      : pointLabel(rightName, rightScoring === "SIDE_A" ? "A" : "B")}
                  </button>
                </>
              )}
              <button
                type="button"
                className="rp-btn rp-btn-ghost rp-actions-wide rp-btn-undo"
                disabled={pending || stale || view.canUndo !== true}
                onClick={onUndoLastScoringAction}
                data-testid="btn-undo-last-scoring-action"
                aria-label="Hoàn tác lần ghi gần nhất"
                title={
                  view.canUndo === true
                    ? "Hoàn tác lần ghi gần nhất"
                    : view.undoAvailability?.message ||
                      "Không thể hoàn tác lần ghi gần nhất"
                }
              >
                {pendingAction === "undo"
                  ? "Đang hoàn tác..."
                  : "↶ Hoàn tác lần ghi gần nhất"}
              </button>
            </div>
          ) : view.canUndo === true || pendingAction === "undo" ? (
            <div className="rp-score-actions" data-testid="score-actions">
              <button
                type="button"
                className="rp-btn rp-btn-ghost rp-actions-wide rp-btn-undo"
                disabled={pending || stale || view.canUndo !== true}
                onClick={onUndoLastScoringAction}
                data-testid="btn-undo-last-scoring-action"
                aria-label="Hoàn tác lần ghi gần nhất"
              >
                {pendingAction === "undo"
                  ? "Đang hoàn tác..."
                  : "↶ Hoàn tác lần ghi gần nhất"}
              </button>
            </div>
          ) : null}
        </main>

        <aside className="rp-zone rp-zone-tools" data-testid="console-zone-tools">
          <GameHistoryPanel summary={view.gameSummary} />
          <OperationHistoryPanel history={view.operationHistory} />

          {changeEndAt ? (
            <div className="rp-change-ends-section" data-testid="change-ends-section">
              <div className="rp-change-ends-policy" data-testid="change-ends-policy">
                <SyncAltIcon fontSize="inherit" aria-hidden="true" />
                <span>
                  Điểm đổi đầu sân: <strong data-testid="change-ends-threshold">{changeEndAt}</strong>
                </span>
              </div>
              {changeEndsRequired ? (
                <div className="rp-change-ends-required" data-testid="change-ends-warning">
                  <div className="rp-change-ends-copy-block">
                    <p className="rp-change-ends-title">
                      <FlagIcon fontSize="inherit" aria-hidden="true" /> ĐÃ ĐẾN ĐIỂM ĐỔI ĐẦU SÂN
                    </p>
                    <p className="rp-change-ends-copy">
                      {view.isOptimisticPresentation
                        ? "Đang chờ máy chủ xác nhận..."
                        : "Vui lòng xác nhận sau khi hai bên đã đổi đầu sân (cùng sân thi đấu)."}
                    </p>
                  </div>
                  {!confirmChangeEnds ? (
                    <button
                      type="button"
                      className="rp-btn rp-btn-warn rp-btn-change-ends"
                      disabled={changeEndConfirmBlocked}
                      onClick={() => setConfirmChangeEnds(true)}
                      data-testid="btn-change-ends-required"
                    >
                      <SyncAltIcon fontSize="inherit" aria-hidden="true" /> XÁC NHẬN ĐỔI ĐẦU SÂN
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : changeEndsRequired ? (
            <div className="rp-change-ends-required" data-testid="change-ends-warning">
              <div className="rp-change-ends-copy-block">
                <p className="rp-change-ends-title">
                  <FlagIcon fontSize="inherit" aria-hidden="true" /> ĐÃ ĐẾN ĐIỂM ĐỔI ĐẦU SÂN
                </p>
                <p className="rp-change-ends-copy">
                  {view.isOptimisticPresentation
                    ? "Đang chờ máy chủ xác nhận..."
                    : "Vui lòng xác nhận sau khi hai bên đã đổi đầu sân (cùng sân thi đấu)."}
                </p>
              </div>
              {!confirmChangeEnds ? (
                <button
                  type="button"
                  className="rp-btn rp-btn-warn rp-btn-change-ends"
                  disabled={changeEndConfirmBlocked}
                  onClick={() => setConfirmChangeEnds(true)}
                  data-testid="btn-change-ends-required"
                >
                  <SyncAltIcon fontSize="inherit" aria-hidden="true" /> XÁC NHẬN ĐỔI ĐẦU SÂN
                </button>
              ) : null}
            </div>
          ) : null}

          {confirmChangeEnds ? (
            <div className="rp-confirm" data-testid="change-ends-confirm">
              <p>Xác nhận đổi đầu sân? Hướng sân chỉ đổi sau khi máy chủ xác nhận (ACK).</p>
              <div className="rp-confirm-actions">
                <button
                  type="button"
                  className="rp-btn rp-btn-ghost"
                  onClick={() => setConfirmChangeEnds(false)}
                  data-testid="btn-change-ends-cancel"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  className="rp-btn rp-btn-warn"
                  disabled={pending}
                  onClick={handleConfirmChangeEnds}
                  data-testid="btn-change-ends-confirm"
                >
                  XÁC NHẬN ĐỔI ĐẦU SÂN
                </button>
              </div>
            </div>
          ) : null}

          {showManualChangeEnds ? (
            <button
              type="button"
              className="rp-btn rp-btn-warn rp-actions-wide"
              disabled={pending || stale}
              onClick={() => setConfirmChangeEnds(true)}
              data-testid="btn-change-ends"
            >
              Đổi đầu sân
            </button>
          ) : null}
        </aside>
      </div>

      <div className="rp-footer-actions" data-testid="match-footer-actions">
        <RouterLink className="rp-footer-btn" to="/referee" data-testid="btn-footer-back">
          <ListAltIcon fontSize="small" aria-hidden="true" />
          Quay lại DS trận
        </RouterLink>
        {view.canCorrect ? (
          <button
            type="button"
            className="rp-footer-btn"
            disabled={pending || stale}
            onClick={onCorrect}
            data-testid="btn-correct"
          >
            <EditOutlinedIcon fontSize="small" aria-hidden="true" />
            Sửa
          </button>
        ) : null}
        {view.canSuspend ? (
          <button
            type="button"
            className="rp-footer-btn rp-footer-btn-warn"
            disabled={pending}
            onClick={onSuspend}
            data-testid="btn-suspend"
          >
            <PauseCircleOutlinedIcon fontSize="small" aria-hidden="true" />
            Tạm dừng
          </button>
        ) : view.canResume ? (
          <button
            type="button"
            className="rp-footer-btn rp-footer-btn-primary"
            disabled={pending}
            onClick={onResume}
            data-testid="btn-resume"
          >
            <PlayArrowIcon fontSize="small" aria-hidden="true" />
            Tiếp tục
          </button>
        ) : null}
        {view.canComplete ? (
          <button
            type="button"
            className="rp-footer-btn rp-footer-btn-complete"
            disabled={pending || stale}
            onClick={onSubmitResult}
            data-testid="btn-complete"
          >
            <FlagIcon fontSize="small" aria-hidden="true" />
            KẾT THÚC TRẬN
          </button>
        ) : null}
      </div>
    </div>
  );
}
