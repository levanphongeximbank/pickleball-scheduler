/**
 * Messaging Experience (COMMS-06) — UI/gateway constants.
 * Not production activation. Demo gateway only until COMMS-05 remote gates clear.
 */

export const MESSAGING_EXPERIENCE_PHASE = Object.freeze({
  id: "COMMS-06",
  name: "messaging-experience",
  priorPhase: "COMMS-05",
  hasUi: true,
  /** Demo / in-memory only — not Staging/Production SoT. */
  productionAdapterWired: false,
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
