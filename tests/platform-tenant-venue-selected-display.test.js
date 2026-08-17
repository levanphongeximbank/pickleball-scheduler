/**
 * Wave 1 — selected operational Tenant/Venue must stay visibly labelled
 * across club switch, F5, catalog rehydrate, and TOKEN_REFRESHED.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ROLES } from "../src/auth/roles.js";
import { saveVenues } from "../src/data/venue.js";
import { clearActiveTenantId } from "../src/data/tenantSession.js";
import { resolveTenantSwitcherView } from "../src/features/tenant/services/tenantSelectionModel.js";
import { createTenantSelectionRuntime } from "../src/features/tenant/services/tenantSelectionService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";

const CATALOG = [
  { id: TENANT_A, name: "Venue Staging A", status: "active" },
  { id: TENANT_B, name: "Venue Staging B", status: "active" },
];

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function superAdmin() {
  return {
    id: "sa-display-1",
    email: "sa-display@staging.local",
    role: ROLES.SUPER_ADMIN,
    status: "active",
  };
}

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  saveVenues(CATALOG);
  clearActiveTenantId();
});

afterEach(() => {
  delete globalThis.localStorage;
});

describe("platform tenant/venue selected display — projection", () => {
  it("selected Tenant/Venue renders a visible human-readable label", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CATALOG,
    });
    assert.equal(runtime.switchTenant(TENANT_A).ok, true);
    const state = runtime.getState();
    assert.equal(state.currentTenantId, TENANT_A);
    assert.equal(state.value, TENANT_A);
    assert.equal(state.selectedLabel, "Venue Staging A");
    assert.notEqual(state.selectedLabel, "Chọn tổ chức…");
  });

  it("F5 / remount retains the selected label", () => {
    const user = superAdmin();
    const runtime = createTenantSelectionRuntime({ user, catalog: CATALOG });
    runtime.switchTenant(TENANT_A);

    const restored = createTenantSelectionRuntime({ user, catalog: CATALOG });
    assert.equal(restored.getState().selectedLabel, "Venue Staging A");
    assert.equal(restored.remount().selectedLabel, "Venue Staging A");
  });

  it("tenant catalog refresh retains the selected label", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CATALOG,
    });
    runtime.switchTenant(TENANT_A);

    // Simulate catalog object rebuild (new array / new row objects, same ids).
    runtime.setCatalog([
      { id: TENANT_B, name: "Venue Staging B", status: "active" },
      { id: TENANT_A, name: "Venue Staging A", status: "active" },
    ]);

    const state = runtime.getState();
    assert.equal(state.currentTenantId, TENANT_A);
    assert.equal(state.selectedLabel, "Venue Staging A");
  });

  it("TOKEN_REFRESHED / auth semantic refresh retains the selected label", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CATALOG,
    });
    runtime.switchTenant(TENANT_A);
    const refreshed = runtime.authSemanticRefresh();
    assert.equal(refreshed.currentTenantId, TENANT_A);
    assert.equal(refreshed.selectedLabel, "Venue Staging A");
  });

  it("explicit Tenant A → Tenant B updates the visible label", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CATALOG,
    });
    runtime.switchTenant(TENANT_A);
    assert.equal(runtime.getState().selectedLabel, "Venue Staging A");
    runtime.switchTenant(TENANT_B);
    assert.equal(runtime.getState().selectedLabel, "Venue Staging B");
  });

  it("unresolved selection renders the explicit placeholder", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CATALOG,
    });
    const state = runtime.getState();
    assert.equal(state.currentTenantId, null);
    assert.equal(state.value, "");
    assert.equal(state.selectedLabel, "Chọn tổ chức…");
  });

  it("does not auto-pick the first tenant", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CATALOG,
    });
    assert.equal(runtime.getState().currentTenantId, null);
    assert.equal(runtime.getState().selectedLabel, "Chọn tổ chức…");
  });

  it("catalog mid-rebuild keeps label via currentTenant display record", () => {
    const view = resolveTenantSwitcherView({
      currentTenantId: TENANT_A,
      tenants: [],
      currentTenant: { id: TENANT_A, name: "Venue Staging A" },
    });
    assert.equal(view.value, TENANT_A);
    assert.equal(view.selectedLabel, "Venue Staging A");
  });

  it("Club A/B switching does not blank Tenant/Venue display (id authority unchanged)", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CATALOG,
    });
    runtime.switchTenant(TENANT_A);
    // Club switch is a separate authority — tenant selection runtime must keep label.
    const afterClubA = runtime.rerender();
    assert.equal(afterClubA.selectedLabel, "Venue Staging A");
    const afterClubB = runtime.rerender();
    assert.equal(afterClubB.currentTenantId, TENANT_A);
    assert.equal(afterClubB.selectedLabel, "Venue Staging A");
  });
});

describe("platform tenant/venue selected display — shell contracts", () => {
  it("TenantSwitcher uses currentTenant display fallback and light/context contrast", () => {
    const source = readSrc("src/components/TenantSwitcher.jsx");
    assert.match(source, /currentTenant/);
    assert.match(source, /resolveTenantSwitcherView/);
    assert.match(source, /tenant-switcher-selected-label/);
    assert.match(source, /light:\s*LIGHT_STYLES/);
    assert.match(source, /context:\s*LIGHT_STYLES/);
    assert.match(source, /SHELL_COLORS\.textPrimary/);
    assert.doesNotMatch(source, /VARIANT_STYLES\[variant\] \|\| VARIANT_STYLES\.dark;\s*$/);
  });

  it("desktop CanonicalTopBar keeps organization zone minWidth for visible label", () => {
    const topBar = readSrc("src/features/canonical-shell/components/CanonicalTopBar.jsx");
    assert.match(topBar, /canonical-topbar-organization-zone/);
    assert.match(topBar, /minWidth:\s*zones\.organization\.widthMin/);
    assert.match(topBar, /CanonicalTenantSwitcher/);

    const wrapper = readSrc(
      "src/features/canonical-shell/components/CanonicalTenantSwitcher.jsx"
    );
    assert.match(wrapper, /TenantSwitcher/);
    assert.match(wrapper, /variant="context"/);
  });

  it("Header and Canonical shells share TenantSwitcher projection (no second authority)", () => {
    const header = readSrc("src/components/Header.jsx");
    const topBar = readSrc("src/features/canonical-shell/components/CanonicalTopBar.jsx");
    assert.match(header, /TenantSwitcher/);
    assert.match(topBar, /CanonicalTenantSwitcher/);
    assert.doesNotMatch(header, /selectedTenantLabel|organizationName/);
    assert.doesNotMatch(topBar, /selectedTenantLabel|organizationName/);
  });
});
