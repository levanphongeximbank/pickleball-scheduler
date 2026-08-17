import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ROLES } from "../src/auth/roles.js";
import { clearAuthSession } from "../src/auth/authStorage.js";
import { saveVenues } from "../src/data/venue.js";
import { getTenantById, listTenants } from "../src/features/tenant/services/tenantService.js";
import {
  canOperateUnassignedTenant,
  canRenderTenantSwitcher,
  canSwitchTenant,
  CLUB_DETAIL_MISSING_TENANT_WARNING,
  firstTenantFallbackId,
  resolveClubDetailTenantGate,
  resolveTenantSwitcherView,
} from "../src/features/tenant/services/tenantSelectionModel.js";
import {
  commitTenantSwitch,
  createTenantSelectionRuntime,
} from "../src/features/tenant/services/tenantSelectionService.js";
import {
  clearActiveTenantId,
  loadActiveTenantId,
  saveActiveTenantId,
} from "../src/data/tenantSession.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";
const DEFAULT_TENANT = "default-tenant";

const CANONICAL_VENUES = [
  { id: DEFAULT_TENANT, name: "Default Tenant", status: "active" },
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

function enableSupabaseEnv() {
  const nodeEnv = typeof globalThis.process !== "undefined" ? globalThis.process.env : {};
  nodeEnv.VITE_SUPABASE_URL = "https://qyewbxjsiiyufanzcjcq.supabase.co";
  nodeEnv.VITE_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.test";
  nodeEnv.VITE_RBAC_ENABLED = "true";
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_SUPABASE_URL = nodeEnv.VITE_SUPABASE_URL;
    import.meta.env.VITE_SUPABASE_ANON_KEY = nodeEnv.VITE_SUPABASE_ANON_KEY;
    import.meta.env.VITE_RBAC_ENABLED = "true";
  }
}

function mockSupabaseClient(venues) {
  return {
    from() {
      return {
        select() {
          return {
            order() {
              return Promise.resolve({ data: venues, error: null });
            },
          };
        },
      };
    },
  };
}

function superAdmin(id = "sa-1") {
  return {
    id,
    email: `${id}@staging.local`,
    role: ROLES.SUPER_ADMIN,
    status: "active",
  };
}

function platformTech() {
  return {
    id: "tech-1",
    email: "kythuat@gmail.com",
    role: ROLES.SYSTEM_TECHNICIAN,
    status: "active",
  };
}

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function useCurrentTenantIdConsumer(runtime) {
  return runtime.getState().currentTenantId;
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  enableSupabaseEnv();
  saveVenues(CANONICAL_VENUES);
  clearActiveTenantId();
});

afterEach(() => {
  delete globalThis.localStorage;
});

describe("platform tenant switcher persistence 01 — mixed authority repro", () => {
  it("proves UI catalog and live getTenantById can diverge after a registry wipe", () => {
    const uiList = listTenants();
    assert.ok(uiList.some((row) => row.id === TENANT_A));
    assert.ok(uiList.some((row) => row.id === TENANT_B));

    saveVenues([]);

    assert.equal(getTenantById(TENANT_A), null);
    assert.equal(
      commitTenantSwitch({
        tenantId: TENANT_A,
        user: superAdmin(),
        catalog: [],
      }).ok,
      false,
      "empty catalog + empty registry must fail closed"
    );
  });

  it("selects venue-staging-a from the picker catalog even when local registry was wiped", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CANONICAL_VENUES,
    });

    assert.equal(runtime.getState().currentTenantId, null);
    runtime.wipeLocalRegistryKeepingCatalog();
    assert.equal(getTenantById(TENANT_A), null);

    const result = runtime.switchTenant(TENANT_A);
    assert.equal(result.ok, true);
    assert.equal(result.tenantId, TENANT_A);

    const state = runtime.getState();
    assert.equal(state.currentTenantId, TENANT_A);
    assert.equal(state.selectedLabel, "Venue Staging A");
    assert.equal(useCurrentTenantIdConsumer(runtime), TENANT_A);
    assert.equal(state.clubDetail.blocked, false);
  });
});

describe("platform tenant switcher persistence 01 — SA lifecycle", () => {
  it("starts unassigned, hydrates canonical A/B, and does not auto-pick first tenant", async () => {
    saveVenues([{ id: DEFAULT_TENANT, name: "Default Tenant", status: "active" }]);
    const runtime = createTenantSelectionRuntime({ user: superAdmin() });
    assert.equal(runtime.getState().currentTenantId, null);

    const hydrate = await runtime.hydrate(
      mockSupabaseClient([
        { id: TENANT_A, name: "Venue Staging A", status: "active" },
        { id: TENANT_B, name: "Venue Staging B", status: "active" },
      ])
    );
    assert.equal(hydrate.ok, true);

    const state = runtime.getState();
    assert.ok(state.catalog.some((row) => row.id === TENANT_A));
    assert.ok(state.catalog.some((row) => row.id === TENANT_B));
    assert.equal(state.currentTenantId, null);
    assert.ok(firstTenantFallbackId(state.catalog));
    assert.notEqual(state.currentTenantId, firstTenantFallbackId(state.catalog));
    assert.equal(state.selectedLabel, "Chọn tổ chức…");
  });

  it("null → A updates currentTenantId, label, and ClubDetail consumer", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CANONICAL_VENUES,
    });
    const result = runtime.switchTenant(TENANT_A);
    assert.equal(result.ok, true);

    const state = runtime.getState();
    assert.equal(state.currentTenantId, TENANT_A);
    assert.equal(state.value, TENANT_A);
    assert.equal(state.selectedLabel, "Venue Staging A");
    assert.equal(useCurrentTenantIdConsumer(runtime), TENANT_A);
    assert.equal(state.clubDetail.blocked, false);
    assert.equal(state.clubDetail.tenantId, TENANT_A);
  });

  it("A → B and B → A keep the explicit selection", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CANONICAL_VENUES,
    });
    assert.equal(runtime.switchTenant(TENANT_A).ok, true);
    assert.equal(runtime.switchTenant(TENANT_B).ok, true);
    assert.equal(runtime.getState().currentTenantId, TENANT_B);
    assert.equal(runtime.getState().selectedLabel, "Venue Staging B");

    assert.equal(runtime.switchTenant(TENANT_A).ok, true);
    assert.equal(runtime.getState().currentTenantId, TENANT_A);
    assert.equal(runtime.getState().selectedLabel, "Venue Staging A");
  });

  it("provider rerender does not erase the explicit selection", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CANONICAL_VENUES,
    });
    runtime.switchTenant(TENANT_A);
    const again = runtime.rerender();
    assert.equal(again.currentTenantId, TENANT_A);
    assert.equal(useCurrentTenantIdConsumer(runtime), TENANT_A);
  });

  it("simulated F5/remount restores the explicit Super Admin tenant", () => {
    const user = superAdmin();
    const runtime = createTenantSelectionRuntime({ user, catalog: CANONICAL_VENUES });
    runtime.switchTenant(TENANT_A);

    const restored = createTenantSelectionRuntime({ user, catalog: CANONICAL_VENUES });
    assert.equal(restored.getState().currentTenantId, TENANT_A);
    assert.equal(restored.getState().selectedLabel, "Venue Staging A");
    assert.equal(restored.remount().currentTenantId, TENANT_A);
  });

  it("auth semantic refresh does not reset the explicit tenant", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CANONICAL_VENUES,
    });
    runtime.switchTenant(TENANT_A);
    const refreshed = runtime.authSemanticRefresh();
    assert.equal(refreshed.currentTenantId, TENANT_A);
    assert.equal(refreshed.selectedLabel, "Venue Staging A");
  });

  it("tenant hydration after login does not erase selection", async () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CANONICAL_VENUES,
    });
    runtime.switchTenant(TENANT_A);
    await runtime.hydrate(
      mockSupabaseClient([
        { id: TENANT_A, name: "Venue Staging A", status: "active" },
        { id: TENANT_B, name: "Venue Staging B", status: "active" },
      ])
    );
    assert.equal(runtime.getState().currentTenantId, TENANT_A);
  });

  it("direct route ClubDetail keeps explicit tenant and still warns when none is selected", () => {
    const withTenant = resolveClubDetailTenantGate(TENANT_A);
    assert.equal(withTenant.blocked, false);

    const missing = resolveClubDetailTenantGate(null);
    assert.equal(missing.blocked, true);
    assert.equal(missing.warning, CLUB_DETAIL_MISSING_TENANT_WARNING);

    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CANONICAL_VENUES,
    });
    assert.equal(runtime.getState().clubDetail.blocked, true);
    runtime.switchTenant(TENANT_A);
    assert.equal(runtime.getState().clubDetail.blocked, false);
  });
});

describe("platform tenant switcher persistence 01 — fail closed and isolation", () => {
  it("rejects an invalid tenant and keeps currentTenantId null", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CANONICAL_VENUES,
    });
    const result = runtime.switchTenant("tenant-does-not-exist");
    assert.equal(result.ok, false);
    assert.equal(runtime.getState().currentTenantId, null);
    assert.equal(runtime.getState().clubDetail.blocked, true);
  });

  it("drops a stale selected tenant after successful canonical hydrate", async () => {
    const user = superAdmin();
    saveActiveTenantId("deleted-venue", user.id);
    const runtime = createTenantSelectionRuntime({ user, catalog: CANONICAL_VENUES });
    assert.equal(runtime.getState().currentTenantId, "deleted-venue");

    await runtime.hydrate(
      mockSupabaseClient([
        { id: TENANT_A, name: "Venue Staging A", status: "active" },
        { id: TENANT_B, name: "Venue Staging B", status: "active" },
      ])
    );
    assert.equal(runtime.getState().currentTenantId, null);
  });

  it("does not leak tenant selection across users or logout", () => {
    const sa1 = superAdmin("sa-1");
    const sa2 = superAdmin("sa-2");
    const first = createTenantSelectionRuntime({ user: sa1, catalog: CANONICAL_VENUES });
    first.switchTenant(TENANT_A);
    assert.equal(loadActiveTenantId(sa1.id), TENANT_A);

    first.logout();
    assert.equal(loadActiveTenantId(sa1.id), null);
    assert.equal(loadActiveTenantId(sa2.id), null);

    const second = createTenantSelectionRuntime({ user: sa2, catalog: CANONICAL_VENUES });
    assert.equal(second.getState().currentTenantId, null);

    saveActiveTenantId(TENANT_B, sa1.id);
    clearAuthSession();
    assert.equal(loadActiveTenantId(sa1.id), null);
    assert.equal(loadActiveTenantId(sa2.id), null);
  });

  it("keeps catalog identity aligned with switchTenant validation", () => {
    const runtime = createTenantSelectionRuntime({
      user: superAdmin(),
      catalog: CANONICAL_VENUES,
    });
    const option = runtime.getState().catalog.find((row) => row.id === TENANT_A);
    assert.ok(option);
    const result = runtime.switchTenant(option.id);
    assert.equal(result.ok, true);
    assert.equal(result.tenant.id, option.id);
    assert.equal(runtime.getState().value, option.id);
  });
});

describe("platform tenant switcher persistence 01 — authorization policy", () => {
  it("renders and switches for Super Admin only", () => {
    const sa = superAdmin();
    const tech = platformTech();
    const owner = {
      id: "owner-1",
      role: ROLES.TENANT_OWNER,
      venueId: TENANT_A,
      status: "active",
    };

    assert.equal(canRenderTenantSwitcher(sa), true);
    assert.equal(canSwitchTenant(sa), true);
    assert.equal(canOperateUnassignedTenant(sa), true);

    assert.equal(canRenderTenantSwitcher(tech), false);
    assert.equal(canSwitchTenant(tech), false);
    assert.equal(canOperateUnassignedTenant(tech), true);

    assert.equal(canRenderTenantSwitcher(owner), false);
    assert.equal(canSwitchTenant(owner), false);

    const denied = commitTenantSwitch({
      tenantId: TENANT_A,
      user: tech,
      catalog: CANONICAL_VENUES,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "FORBIDDEN");
  });

  it("TenantSwitcher view stays empty until an explicit tenant id is selected", () => {
    const view = resolveTenantSwitcherView({
      currentTenantId: null,
      tenants: CANONICAL_VENUES,
    });
    assert.equal(view.value, "");
    assert.equal(view.selectedLabel, "Chọn tổ chức…");
    assert.equal(view.hasSelection, false);
  });

  it("keeps a visible label when selected id is temporarily missing from catalog", () => {
    const view = resolveTenantSwitcherView({
      currentTenantId: TENANT_A,
      tenants: [],
      currentTenant: { id: TENANT_A, name: "Venue Staging A" },
    });
    assert.equal(view.value, TENANT_A);
    assert.equal(view.selectedLabel, "Venue Staging A");
    assert.equal(view.hasSelection, true);
  });

  it("falls back to selected id when display name is blank", () => {
    const view = resolveTenantSwitcherView({
      currentTenantId: TENANT_A,
      tenants: [{ id: TENANT_A, name: "   " }],
    });
    assert.equal(view.value, TENANT_A);
    assert.equal(view.selectedLabel, TENANT_A);
  });
});

describe("platform tenant switcher persistence 01 — source contracts", () => {
  it("TenantProvider commits through the shared switch service and does not auto-pick first tenant", () => {
    const source = readSrc("src/context/TenantContext.jsx");
    assert.match(source, /commitTenantSwitch/);
    assert.match(source, /tenantCatalog/);
    assert.doesNotMatch(source, /listTenants\(\)\s*\[\s*0\s*\]/);
    assert.match(source, /canOperateUnassignedTenant/);
    assert.match(source, /canSwitchTenant/);
  });

  it("TenantSwitcher lists the shared context catalog", () => {
    const source = readSrc("src/components/TenantSwitcher.jsx");
    assert.match(source, /tenants: contextTenants/);
    assert.match(source, /resolveTenantSwitcherView/);
    assert.doesNotMatch(source, /listTenants\(/);
  });

  it("ClubDetail uses the shared tenant gate helper", () => {
    const source = readSrc("src/pages/clubs/ClubDetailPage.jsx");
    assert.match(source, /resolveClubDetailTenantGate/);
    assert.match(source, /tenantGate\.warning/);
  });
});
