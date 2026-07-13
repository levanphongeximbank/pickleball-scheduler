/** Wave 1 cohort manifest — staging @staging.local only; no Wave 0 users. */
export const STAGING_REF = "qyewbxjsiiyufanzcjcq";
export const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
export const WAVE0_AUTH_IDS = new Set([
  "7b381912-2190-415c-b099-6b1e87567b7a",
  "54f5ee47-3d78-4b50-b286-2ebfdf948b2e",
  "d8997acc-cf9b-4b2e-9027-302e830bf12f",
]);

export const WAVE0_EMAILS = new Set([
  "player@staging.local",
  "player.nomember@staging.local",
  "vicepresident@staging.local",
]);

/** @type {Array<{slot:string,email:string,display_name:string,tenant_id:string,gender:string,experience_band:string,expected_skill_band:string,create:boolean}>} */
export const WAVE1_MANIFEST = [
  { slot: "W1-01", email: "qa42l.nomember@staging.local", display_name: "qa42l.nomember", tenant_id: "platform", gender: "", experience_band: "new", expected_skill_band: "1.5-2.5", create: false },
  { slot: "W1-02", email: "club@staging.local", display_name: "club", tenant_id: "venue-staging-a", gender: "Nam", experience_band: "experienced", expected_skill_band: "3.0-3.5", create: false },
  { slot: "W1-03", email: "rating.wave1.01@staging.local", display_name: "Wave1 Player 01", tenant_id: "venue-staging-a", gender: "Nam", experience_band: "new", expected_skill_band: "1.5-2.5", create: true },
  { slot: "W1-04", email: "rating.wave1.02@staging.local", display_name: "Wave1 Player 02", tenant_id: "platform", gender: "Nữ", experience_band: "new", expected_skill_band: "1.5-2.5", create: true },
  { slot: "W1-05", email: "rating.wave1.03@staging.local", display_name: "Wave1 Player 03", tenant_id: "venue-staging-a", gender: "Nam", experience_band: "casual", expected_skill_band: "1.5-2.5", create: true },
  { slot: "W1-06", email: "rating.wave1.04@staging.local", display_name: "Wave1 Player 04", tenant_id: "platform", gender: "Nữ", experience_band: "experienced", expected_skill_band: "3.0-3.5", create: true },
  { slot: "W1-07", email: "rating.wave1.05@staging.local", display_name: "Wave1 Player 05", tenant_id: "venue-staging-a", gender: "Nam", experience_band: "experienced", expected_skill_band: "3.0-3.5", create: true },
  { slot: "W1-08", email: "rating.wave1.06@staging.local", display_name: "Wave1 Player 06", tenant_id: "platform", gender: "", experience_band: "experienced", expected_skill_band: "3.0-3.5", create: true },
  { slot: "W1-09", email: "rating.wave1.07@staging.local", display_name: "Wave1 Player 07", tenant_id: "venue-staging-a", gender: "Nữ", experience_band: "experienced", expected_skill_band: "3.0-3.5", create: true },
  { slot: "W1-10", email: "rating.wave1.08@staging.local", display_name: "Wave1 Player 08", tenant_id: "platform", gender: "Nam", experience_band: "experienced", expected_skill_band: "4.0-4.5", create: true },
  { slot: "W1-11", email: "rating.wave1.09@staging.local", display_name: "Wave1 Player 09", tenant_id: "venue-staging-a", gender: "Nữ", experience_band: "experienced", expected_skill_band: "4.0-4.5", create: true },
  { slot: "W1-12", email: "rating.wave1.10@staging.local", display_name: "Wave1 Player 10", tenant_id: "platform", gender: "Nam", experience_band: "experienced", expected_skill_band: "4.0-4.5", create: true },
];

export function resolveVenueId(tenantId) {
  return tenantId === "platform" ? null : tenantId;
}

export function resolveTenantFromProfile(profile) {
  return profile?.venue_id ? String(profile.venue_id) : "platform";
}
