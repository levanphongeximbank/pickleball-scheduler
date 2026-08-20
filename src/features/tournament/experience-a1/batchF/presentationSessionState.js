export const PRESENTATION_SESSION = Object.freeze({
  OFFLINE: "OFFLINE",
  READY: "READY",
  LIVE: "LIVE",
  PAUSED: "PAUSED",
});

/** Local UI-only session state — not persisted broadcast authority. */
export function resolvePresentationActions(status = PRESENTATION_SESSION.OFFLINE) {
  const phase = status;
  const isLive = phase === PRESENTATION_SESSION.LIVE;
  const isPaused = phase === PRESENTATION_SESSION.PAUSED;
  const isReady = phase === PRESENTATION_SESSION.READY;
  const isOffline = phase === PRESENTATION_SESSION.OFFLINE;
  return {
    phase,
    startEnabled: isOffline || isReady,
    startVisible: !isPaused,
    pauseEnabled: isLive,
    resumeEnabled: isPaused,
    resumeVisible: isPaused,
    switchEnabled: isLive || isPaused || isReady,
    fullscreenEnabled: isLive || isPaused || isReady,
    previewEnabled: true,
    modeLabel: isLive
      ? "Trình chiếu đang phát"
      : isPaused
        ? "Tạm dừng"
        : isReady
          ? "Xem trước / Sẵn sàng"
          : "Ngoại tuyến",
  };
}
