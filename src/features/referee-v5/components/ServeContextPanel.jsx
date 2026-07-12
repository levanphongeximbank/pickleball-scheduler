import { getPlayerDisplayName } from "../prototype/refereeV5PrototypeFixtures.js";
import { describeServeDirectionVi } from "../selectors/serveArrowSelector.js";
import { LOGICAL_SERVICE_SIDE } from "../constants/courtSides.js";

function sideLabel(side) {
  return side === LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT ? "Ô phải" : "Ô trái";
}

export default function ServeContextPanel({ visualState }) {
  const ctx = visualState.serveContext;
  if (!ctx) {
    return null;
  }

  const serverName = getPlayerDisplayName(ctx.servingPlayerId);
  const receiverName = getPlayerDisplayName(ctx.receivingPlayerId);

  return (
    <section
      className="rv5-serve-context"
      aria-label="Thông tin giao bóng"
      data-testid="serve-context-panel"
    >
      <p className="rv5-serve-context-row">
        <span className="rv5-serve-context-label">Người giao: </span>
        <strong data-testid="serve-context-server">{serverName}</strong>
      </p>
      <p className="rv5-serve-context-row">
        <span className="rv5-serve-context-label">Người đỡ: </span>
        <strong data-testid="serve-context-receiver">{receiverName}</strong>
      </p>
      <p className="rv5-serve-context-row">
        <span className="rv5-serve-context-label">Đội giao: </span>
        <strong>{visualState.servingTeamName}</strong>
      </p>
      {!visualState.isSingles ? (
        <p className="rv5-serve-context-row">
          <span className="rv5-serve-context-label">Server: </span>
          <strong data-testid="serve-context-server-number">{ctx.serverNumber ?? "—"}</strong>
        </p>
      ) : null}
      <p className="rv5-serve-context-row">
        <span className="rv5-serve-context-label">Ô giao: </span>
        <strong>{sideLabel(ctx.servingLogicalServiceSide)}</strong>
      </p>
      <p className="rv5-serve-context-row">
        <span className="rv5-serve-context-label">Ô nhận: </span>
        <strong>Ô chéo đối diện</strong>
      </p>
      <p className="rv5-serve-context-row">
        <span className="rv5-serve-context-label">Hướng giao: </span>
        <strong data-testid="serve-context-direction">
          {describeServeDirectionVi(ctx.serveDirection)}
        </strong>
      </p>
    </section>
  );
}
