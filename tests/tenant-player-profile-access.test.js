import test from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";
import {
  isBillingExemptPath,
  isSubscriptionOperationalExemptRole,
  isTenantSelfServiceExemptPath,
} from "../src/features/billing/guards/operationalRoutePolicy.js";
import { isAuthenticatedOnlyRoute } from "../src/auth/authGuard.js";

test("PLAYER profile routes are tenant self-service exempt", () => {
  assert.equal(isTenantSelfServiceExemptPath("/profile"), true);
  assert.equal(isTenantSelfServiceExemptPath("/player/profile"), true);
  assert.equal(isBillingExemptPath("/player/skill-assessment"), true);
});

test("PLAYER is exempt from tenant assignment requirement", () => {
  const playerNoTenant = createUserRecord({
    id: "player-no-tenant",
    role: ROLES.PLAYER,
    clubId: "club-staging-a",
  });

  assert.equal(isSubscriptionOperationalExemptRole(playerNoTenant), true);
});

test("auth guard treats athlete profile routes as authenticated-only", () => {
  assert.equal(isAuthenticatedOnlyRoute("/profile"), true);
  assert.equal(isAuthenticatedOnlyRoute("/player/profile"), true);
  assert.equal(isAuthenticatedOnlyRoute("/player/skill-assessment"), true);
});
