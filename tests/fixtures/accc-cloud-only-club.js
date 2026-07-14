/**
 * Production-parity ACCC fixture for PR-4.25 (no real PII).
 * Models: cloud members exist, club_data_v3 roster empty, mixed player mappings.
 */

export const ACCC_FIXTURE = Object.freeze({
  club: {
    id: "club-219e4a7cbd73437eb6271f02a53314c3",
    name: "ACCC Fixture Club",
    tenant_id: "venue-prod-main",
    status: "active",
    isDefault: false,
  },
  tenantId: "venue-prod-main",
  otherTenantClub: {
    id: "club-other-tenant-xxxx",
    name: "Other Tenant Club",
    tenant_id: "venue-other",
    status: "active",
  },
  defaultClub: {
    id: "default-club",
    name: "CLB Mặc định",
    tenantId: "venue-prod-main",
    isDefault: true,
    status: "active",
  },
  /** 12 membership rows → 10 unique active users after dedupe */
  membershipRows: [
    // duplicates (history) for user-01
    {
      id: "m-01-old",
      user_id: "user-01",
      display_name: "Player One",
      status: "left",
      updated_at: "2025-01-01T00:00:00.000Z",
    },
    {
      id: "m-01-active",
      user_id: "user-01",
      display_name: "Player One",
      status: "active",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    // duplicates for user-02
    {
      id: "m-02-removed",
      user_id: "user-02",
      display_name: "Player Two",
      status: "removed",
      updated_at: "2025-06-01T00:00:00.000Z",
    },
    {
      id: "m-02-active",
      user_id: "user-02",
      display_name: "Player Two",
      status: "active",
      updated_at: "2026-02-01T00:00:00.000Z",
    },
    {
      id: "m-03",
      user_id: "user-03",
      display_name: "Player Three",
      status: "active",
    },
    {
      id: "m-04",
      user_id: "user-04",
      display_name: "Player Four",
      status: "active",
    },
    {
      id: "m-05",
      user_id: "user-05",
      display_name: "Player Five",
      status: "active",
    },
    {
      id: "m-06",
      user_id: "user-06",
      display_name: "Player Six",
      status: "active",
    },
    {
      id: "m-07",
      user_id: "user-07",
      display_name: "Player Seven",
      status: "active",
    },
    {
      id: "m-08",
      user_id: "user-08",
      display_name: "Player Eight",
      status: "active",
    },
    {
      id: "m-09",
      user_id: "user-09",
      display_name: "Player Nine",
      status: "active",
    },
    {
      id: "m-10",
      user_id: "user-10",
      display_name: "Player Ten",
      status: "active",
    },
    // inactive — must not enter picker
    {
      id: "m-11-left",
      user_id: "user-11",
      display_name: "Player Eleven Left",
      status: "left",
    },
  ],
  /** 5 mapped + 5 unmapped */
  profilesByUserId: new Map([
    ["user-01", { id: "user-01", player_id: "player-accc-01", display_name: "Player One" }],
    ["user-02", { id: "user-02", player_id: "player-accc-02", display_name: "Player Two" }],
    ["user-03", { id: "user-03", player_id: "player-accc-03", display_name: "Player Three" }],
    ["user-04", { id: "user-04", player_id: "player-accc-04", display_name: "Player Four" }],
    ["user-05", { id: "user-05", player_id: "player-accc-05", display_name: "Player Five" }],
    ["user-06", { id: "user-06", player_id: null, display_name: "Player Six" }],
    ["user-07", { id: "user-07", player_id: null, display_name: "Player Seven" }],
    ["user-08", { id: "user-08", player_id: null, display_name: "Player Eight" }],
    ["user-09", { id: "user-09", player_id: null, display_name: "Player Nine" }],
    ["user-10", { id: "user-10", player_id: null, display_name: "Player Ten" }],
  ]),
  /** club_data_v3 roster empty */
  blobPlayers: [],
});
