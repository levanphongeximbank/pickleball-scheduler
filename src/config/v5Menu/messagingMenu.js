import { FEATURE_STATUS, menuLeaf } from "./menuBuilders.js";

/**
 * Communication Messaging Experience (COMMS-06/07).
 * Distinct from CRM outreach `/crm/messages`.
 * Path/key duplicated intentionally to avoid config ↔ feature circular imports.
 * Runtime: DEMO (dev/test) | PRODUCTION (certified) | UNAVAILABLE (fail-closed).
 */
export const MESSAGING_MENU_LEAF = menuLeaf({
  key: "communication-messaging",
  icon: "chat",
  text: "Tin nhắn",
  path: "/messages",
  match: "communication-messaging",
  featureStatus: FEATURE_STATUS.LIVE,
  featureNote:
    "COMMS-07 Messaging Experience — runtime DEMO/PRODUCTION/UNAVAILABLE; CRM /crm/messages remains outreach SoT",
});
