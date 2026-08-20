export const PRESENTATION_SESSION = Object.freeze({
  OFFLINE: "OFFLINE",
  READY: "READY",
  LIVE: "LIVE",
  PAUSED: "PAUSED",
});

/**
 * Local UI-only session state — not persisted broadcast authority.
 * @param {string} status
 * @param {{ contentReady?: boolean }} [options]
 * contentReady: selected catalog output has real presentable content.
 */
export function resolvePresentationActions(status = PRESENTATION_SESSION.OFFLINE, options = {}) {
  const phase = status;
  const contentReady = options.contentReady !== false;
  const isLive = phase === PRESENTATION_SESSION.LIVE;
  const isPaused = phase === PRESENTATION_SESSION.PAUSED;
  const isReady = phase === PRESENTATION_SESSION.READY;
  const isOffline = phase === PRESENTATION_SESSION.OFFLINE;
  return {
    phase,
    startEnabled: (isOffline || isReady) && contentReady,
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
