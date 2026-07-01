import { createTenantRecord, createUserRecord, assertTenantAccess, canPerformAction } from "../index.js";

function createInMemoryStore(initial = []) {
  const items = [...initial];
  return {
    list() {
      return [...items];
    },
    add(item) {
      items.push(item);
      return item;
    },
    replace(nextItems = []) {
      items.splice(0, items.length, ...nextItems);
      return items;
    },
    get(predicate) {
      return items.find(predicate) || null;
    },
    clear() {
      items.length = 0;
    },
  };
}

function resolveStore({ persistence, collection, initial = [] }) {
  if (persistence?.read && persistence?.write) {
    const existing = persistence.read(collection, initial);
    if (Array.isArray(existing)) {
      return {
        list() {
          return [...persistence.read(collection, initial)];
        },
        add(item) {
          const current = persistence.read(collection, initial);
          current.push(item);
          persistence.write(collection, current);
          return item;
        },
        replace(nextItems = []) {
          persistence.write(collection, nextItems);
          return nextItems;
        },
        get(predicate) {
          return persistence.read(collection, initial).find(predicate) || null;
        },
        clear() {
          persistence.write(collection, []);
        },
      };
    }
  }

  return createInMemoryStore(initial);
}

export function createTenantService({ persistence, collection = "tenants" } = {}) {
  const store = resolveStore({ persistence, collection });

  return {
    create(input = {}) {
      const tenant = createTenantRecord(input);
      store.add(tenant);
      return tenant;
    },
    getById(tenant_id) {
      return store.get((item) => item.tenant_id === tenant_id) || null;
    },
    list() {
      return store.list();
    },
  };
}

export function createUserService({ persistence, collection = "users" } = {}) {
  const store = resolveStore({ persistence, collection });

  return {
    create(input = {}) {
      const user = createUserRecord(input);
      store.add(user);
      return user;
    },
    getById(user_id) {
      return store.get((item) => item.user_id === user_id) || null;
    },
    list() {
      return store.list();
    },
  };
}

export function createAccessService({ permissionService } = {}) {
  return {
    authorize(user, scope = {}, permission) {
      const tenantCheck = assertTenantAccess(user, scope);
      if (!tenantCheck.ok) {
        return { ok: false, allowed: false, code: tenantCheck.code };
      }

      if (permission && permissionService?.hasPermission) {
        const role = user?.role;
        if (role && !permissionService.hasPermission(role, permission)) {
          return { ok: false, allowed: false, code: "PERMISSION_DENIED", permission };
        }
      }

      const decision = canPerformAction(user, scope, permission);
      return { ok: decision.ok, allowed: decision.allowed, permission, code: decision.code };
    },
  };
}

export function createAuditService() {
  const store = createInMemoryStore();

  return {
    log(input = {}) {
      const entry = {
        id: `audit-${Date.now()}`,
        tenant_id: input.tenant_id,
        actor_user_id: input.actor_user_id,
        action: input.action,
        target_id: input.target_id || null,
        created_at: new Date().toISOString(),
      };
      store.add(entry);
      return entry;
    },
    list() {
      return store.list();
    },
  };
}

export function createNotificationService({ persistence, collection = "notifications" } = {}) {
  const store = resolveStore({ persistence, collection });

  return {
    create(input = {}) {
      const entry = {
        id: `notification-${Date.now()}`,
        tenant_id: input.tenant_id,
        user_id: input.user_id,
        channel: input.channel,
        title: input.title,
        body: input.body || "",
        created_at: new Date().toISOString(),
        read: false,
      };
      store.add(entry);
      return entry;
    },
    list() {
      return store.list();
    },
    markAsRead(id) {
      const list = store.list();
      const target = list.find((item) => item.id === id);
      if (!target) {
        return null;
      }

      const updated = { ...target, read: true, status: "read" };
      const next = list.map((item) => (item.id === id ? updated : item));
      store.replace(next);
      return updated;
    },
    markAllAsRead() {
      const list = store.list();
      const next = list.map((item) => ({ ...item, read: true, status: "read" }));
      store.replace(next);
      return next;
    },
  };
}

export function createSettingService({ persistence, collection = "settings" } = {}) {
  const store = resolveStore({ persistence, collection });

  return {
    set(input = {}) {
      const entry = {
        id: `setting-${Date.now()}`,
        tenant_id: input.tenant_id,
        scope: input.scope || "tenant",
        key: input.key,
        value: input.value,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.add(entry);
      return entry;
    },
    get(tenant_id, key) {
      return store.get((item) => item.tenant_id === tenant_id && item.key === key) || null;
    },
    list() {
      return store.list();
    },
  };
}

export function createSubscriptionService() {
  const store = createInMemoryStore();

  return {
    create(input = {}) {
      const entry = {
        id: `subscription-${Date.now()}`,
        tenant_id: input.tenant_id,
        plan: input.plan || "trial",
        status: input.status || "active",
        feature_flags: input.feature_flags || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.add(entry);
      return entry;
    },
    getByTenant(tenant_id) {
      return store.get((item) => item.tenant_id === tenant_id) || null;
    },
    hasFeature(tenant_id, feature) {
      const subscription = this.getByTenant(tenant_id);
      return Boolean(subscription?.feature_flags?.[feature]);
    },
    list() {
      return store.list();
    },
  };
}

export function createPermissionService() {
  const matrix = {
    SUPER_ADMIN: ["tenant.manage", "user.manage", "subscription.manage", "audit.read"],
    TENANT_OWNER: ["tenant.manage", "user.manage", "subscription.manage", "audit.read"],
    VENUE_MANAGER: ["booking.manage", "court.manage", "player.manage"],
    CLUB_OWNER: ["booking.manage", "court.manage", "player.manage"],
    STAFF: ["booking.manage", "checkin.manage"],
    CASHIER: ["payment.manage"],
    REFEREE: ["match.update", "match.view"],
    PLAYER: ["player.view.self", "booking.view.self"],
  };

  return {
    hasPermission(role, permission) {
      return Boolean(matrix[role]?.includes(permission));
    },
    listMatrix() {
      return { ...matrix };
    },
  };
}
