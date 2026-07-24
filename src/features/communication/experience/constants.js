/**
 * Messaging Experience (COMMS-06/07) — UI/gateway constants.
 * Runtime mode selection lives in `../runtime/` (COMMS-07).
 */

export const MESSAGING_EXPERIENCE_PHASE = Object.freeze({
  id: "COMMS-07",
  name: "messaging-experience-integration",
  priorPhase: "COMMS-06",
  hasUi: true,
  /** Production-oriented gateway composition exists; remote activation still blocked. */
  productionAdapterWired: true,
  remotePersistenceActive: false,
  remoteRealtimeActive: false,
});

export const MESSAGING_ROUTE_PATH = "/messages";

export const MESSAGING_MENU_KEY = "communication-messaging";

/** Internal tabs — display labels are Vietnamese in UI. */
export const MESSAGING_TAB = Object.freeze({
  DIRECT: "DIRECT",
  CLUB: "CLUB",
  COMMUNITY: "COMMUNITY",
  REQUESTS: "REQUESTS",
});

export const MESSAGING_TAB_VALUES = Object.freeze(Object.values(MESSAGING_TAB));

export const MESSAGING_TAB_LABEL = Object.freeze({
  [MESSAGING_TAB.DIRECT]: "Cá nhân",
  [MESSAGING_TAB.CLUB]: "Câu lạc bộ",
  [MESSAGING_TAB.COMMUNITY]: "Cộng đồng",
  [MESSAGING_TAB.REQUESTS]: "Yêu cầu trò chuyện",
});

/**
 * Experience-layer body length guard (contracts only require non-empty).
 * Align UI validation until a canonical max lands in domain contracts.
 */
export const MESSAGE_BODY_MAX_LENGTH = 4000;

export const MESSAGE_PREVIEW_MAX_LENGTH = 240;

export const DEMO_GATEWAY_MARKER = Object.freeze({
  adapterKind: "IN_MEMORY_DEMO",
  productionReady: false,
  note: "COMMS-06 demo gateway — not a production Communication adapter",
});
