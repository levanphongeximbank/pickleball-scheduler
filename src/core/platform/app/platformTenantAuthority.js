/**
 * Wave 3 Phase B — Platform-owned Tenant durable-runtime authority.
 *
 * Canonical DB: public.platform_tenants
 * Runtime path: this port → TenantContext / tenantService
 *
 * localStorage is a cache/preference only. It is not an independent Tenant
 * identity authority once CLOUD_CANONICAL is bound.
 *
 * Before schema exists: COMPATIBILITY_PRE_SCHEMA (honest, not fake cloud success).
 * Never query public.tenants (legacy venue alias view).
 * Competition Platform is not an authority.
 */

export const PLATFORM_TENANTS_TABLE = "platform_tenants";
export const LEGACY_PUBLIC_TENANTS_VIEW = "tenants";

export const PLATFORM_TENANT_MODE = Object.freeze({
  UNPROBED: "UNPROBED",
  COMPATIBILITY_PRE_SCHEMA: "COMPATIBILITY_PRE_SCHEMA",
  SCHEMA_PRESENT_NOT_READABLE: "SCHEMA_PRESENT_NOT_READABLE",
  CLOUD_CANONICAL: "CLOUD_CANONICAL",
  QUERY_FAILED: "QUERY_FAILED",
});

export const PLATFORM_TENANT_ERROR = Object.freeze({
  SCHEMA_ABSENT: "PLATFORM_TENANTS_SCHEMA_ABSENT",
  NOT_READABLE: "PLATFORM_TENANTS_NOT_READABLE",
  QUERY_FAILED: "PLATFORM_TENANTS_QUERY_FAILED",
  WRITE_FAILED: "PLATFORM_TENANTS_WRITE_FAILED",
  CLIENT_MISSING: "PLATFORM_TENANTS_CLIENT_MISSING",
  LEGACY_VIEW_FORBIDDEN: "PLATFORM_TENANTS_LEGACY_VIEW_FORBIDDEN",
  CLOUD_WRITE_REQUIRED: "PLATFORM_TENANT_CLOUD_WRITE_REQUIRED",
  NOT_CANONICAL: "PLATFORM_TENANT_AUTHORITY_NOT_CANONICAL",
});

export const PLATFORM_TENANT_CACHE_ROLE = "CACHE_NOT_IDENTITY_AUTHORITY";

const PLATFORM_TENANT_SELECT =
  "id,name,slug,status,plan,timezone,owner_user_id,note,created_at,updated_at";

/** @type {{ queryAdapter: object|null, cacheAdapter: object|null } | null} */
let bound = null;

/** @type {{
 *   mode: string,
 *   lastCloudTenants: object[]|null,
 *   lastError: string|null,
 *   lastCode: string|null,
 *   probedAt: string|null,
 * }} */
let snapshot = createEmptySnapshot();

function createEmptySnapshot() {
  return {
    mode: PLATFORM_TENANT_MODE.UNPROBED,
    lastCloudTenants: null,
    lastError: null,
    lastCode: null,
    probedAt: null,
  };
}

export function assertNotLegacyPublicTenantsView(tableName) {
  const name = String(tableName || "").trim();
  if (name === LEGACY_PUBLIC_TENANTS_VIEW) {
    return {
      ok: false,
      code: PLATFORM_TENANT_ERROR.LEGACY_VIEW_FORBIDDEN,
      error: "public.tenants is a legacy venue alias view and must not be Tenant authority.",
    };
  }
  return { ok: true, tableName: name };
}

export function classifyPlatformTenantQueryError(error) {
  if (!error) {
    return null;
  }
  const code = String(error.code || "").trim();
  const message = String(error.message || "").toLowerCase();
  if (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  ) {
    return PLATFORM_TENANT_ERROR.SCHEMA_ABSENT;
  }
  if (
    code === "42501" ||
    code === "PGRST301" ||
    message.includes("permission denied") ||
    message.includes("row-level security") ||
    message.includes("not allowed")
  ) {
    return PLATFORM_TENANT_ERROR.NOT_READABLE;
  }
  return PLATFORM_TENANT_ERROR.QUERY_FAILED;
}

export function mapPlatformTenantRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const id = String(row.id || "").trim();
  if (!id) {
    return null;
  }
  return {
    id,
    name: String(row.name || id).trim() || id,
    slug: String(row.slug || "").trim(),
    status: String(row.status || "active").trim() || "active",
    plan: String(row.plan || "trial").trim() || "trial",
    timezone: String(row.timezone || "Asia/Ho_Chi_Minh").trim() || "Asia/Ho_Chi_Minh",
    ownerUserId: row.owner_user_id || row.ownerUserId || null,
    note: String(row.note || "").trim(),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    _authority: PLATFORM_TENANTS_TABLE,
  };
}

export function toPlatformTenantWriteRow(tenant) {
  const mapped = mapPlatformTenantRow(tenant) || mapPlatformTenantRow({ id: tenant?.id });
  if (!mapped) {
    return null;
  }
  return {
    id: mapped.id,
    name: mapped.name,
    slug: mapped.slug || mapped.id,
    status: mapped.status,
    plan: mapped.plan,
    timezone: mapped.timezone,
    owner_user_id: mapped.ownerUserId,
    note: mapped.note || "",
  };
}

/**
 * Duck-typed Supabase adapter. Injected client — Platform Core does not import Auth.
 * @param {(() => object|null)|object|null} getClient
 */
export function createSupabasePlatformTenantQueryAdapter(getClient) {
  function resolveClient() {
    return typeof getClient === "function" ? getClient() : getClient;
  }

  async function fromTenants() {
    const forbidden = assertNotLegacyPublicTenantsView(PLATFORM_TENANTS_TABLE);
    if (!forbidden.ok) {
      return { client: null, error: forbidden };
    }
    const client = resolveClient();
    if (!client || typeof client.from !== "function") {
      return {
        client: null,
        error: {
          ok: false,
          code: PLATFORM_TENANT_ERROR.CLIENT_MISSING,
          error: "Supabase client is not bound.",
        },
      };
    }
    return { client, error: null };
  }

  return {
    tableName: PLATFORM_TENANTS_TABLE,
    async probe() {
      const { client, error: clientError } = await fromTenants();
      if (clientError) {
        return clientError;
      }
      const { error } = await client.from(PLATFORM_TENANTS_TABLE).select("id").limit(1);
      if (error) {
        const code = classifyPlatformTenantQueryError(error);
        return { ok: false, code, error: error.message || String(error) };
      }
      return { ok: true, present: true };
    },
    async list() {
      const { client, error: clientError } = await fromTenants();
      if (clientError) {
        return clientError;
      }
      const { data, error } = await client
        .from(PLATFORM_TENANTS_TABLE)
        .select(PLATFORM_TENANT_SELECT)
        .order("name");
      if (error) {
        const code = classifyPlatformTenantQueryError(error);
        return { ok: false, code, error: error.message || String(error), tenants: [] };
      }
      const tenants = (data || []).map(mapPlatformTenantRow).filter(Boolean);
      return { ok: true, tenants };
    },
    async upsert(tenant) {
      const { client, error: clientError } = await fromTenants();
      if (clientError) {
        return clientError;
      }
      const row = toPlatformTenantWriteRow(tenant);
      if (!row) {
        return { ok: false, code: PLATFORM_TENANT_ERROR.WRITE_FAILED, error: "tenant id required" };
      }
      const { data, error } = await client
        .from(PLATFORM_TENANTS_TABLE)
        .upsert(row, { onConflict: "id" })
        .select(PLATFORM_TENANT_SELECT)
        .maybeSingle();
      if (error) {
        const code = classifyPlatformTenantQueryError(error) || PLATFORM_TENANT_ERROR.WRITE_FAILED;
        return { ok: false, code, error: error.message || String(error) };
      }
      const mapped = mapPlatformTenantRow(data) || mapPlatformTenantRow(row);
      return { ok: true, tenant: mapped };
    },
  };
}

export function bindPlatformTenantAuthority({ queryAdapter = null, cacheAdapter = null } = {}) {
  bound = {
    queryAdapter: queryAdapter || null,
    cacheAdapter: cacheAdapter || null,
  };
  snapshot = createEmptySnapshot();
}

export function isPlatformTenantAuthorityBound() {
  return bound != null;
}

export function __resetPlatformTenantAuthorityForTests() {
  bound = null;
  snapshot = createEmptySnapshot();
}

function readCache() {
  const read = bound?.cacheAdapter?.read;
  if (typeof read !== "function") {
    return [];
  }
  const rows = read();
  return Array.isArray(rows) ? rows : [];
}

function writeCache(tenants) {
  const write = bound?.cacheAdapter?.write;
  if (typeof write !== "function") {
    return;
  }
  write(Array.isArray(tenants) ? tenants : []);
}

export function getPlatformTenantAuthoritySnapshot() {
  return {
    bound: bound != null,
    hasQueryAdapter: Boolean(bound?.queryAdapter),
    cacheRole: bound?.cacheAdapter?.role || (bound?.cacheAdapter ? PLATFORM_TENANT_CACHE_ROLE : "UNBOUND"),
    mode: snapshot.mode,
    lastCloudCount: Array.isArray(snapshot.lastCloudTenants) ? snapshot.lastCloudTenants.length : 0,
    lastError: snapshot.lastError,
    lastCode: snapshot.lastCode,
    probedAt: snapshot.probedAt,
    claimedCloud: snapshot.mode === PLATFORM_TENANT_MODE.CLOUD_CANONICAL,
    dualAuthority: false,
  };
}

export function isCloudCanonicalTenantAuthority() {
  return snapshot.mode === PLATFORM_TENANT_MODE.CLOUD_CANONICAL;
}

export function listCachedPlatformTenants() {
  if (snapshot.mode === PLATFORM_TENANT_MODE.CLOUD_CANONICAL && Array.isArray(snapshot.lastCloudTenants)) {
    return snapshot.lastCloudTenants.slice();
  }
  return readCache();
}

/**
 * Probe + optional canonical list. Never reports cloud success when schema is absent
 * or the query failed.
 */
export async function refreshPlatformTenantAuthority() {
  snapshot.probedAt = new Date().toISOString();
  snapshot.lastError = null;
  snapshot.lastCode = null;

  if (!bound?.queryAdapter || typeof bound.queryAdapter.probe !== "function") {
    snapshot.mode = PLATFORM_TENANT_MODE.COMPATIBILITY_PRE_SCHEMA;
    snapshot.lastCloudTenants = null;
    return {
      ok: true,
      mode: snapshot.mode,
      tenants: readCache(),
      claimedCloud: false,
    };
  }

  const probe = await bound.queryAdapter.probe();
  if (!probe?.ok) {
    const code = probe?.code || PLATFORM_TENANT_ERROR.QUERY_FAILED;
    snapshot.lastCode = code;
    snapshot.lastError = probe?.error || code;
    snapshot.lastCloudTenants = null;
    if (code === PLATFORM_TENANT_ERROR.SCHEMA_ABSENT) {
      snapshot.mode = PLATFORM_TENANT_MODE.COMPATIBILITY_PRE_SCHEMA;
      return {
        ok: true,
        mode: snapshot.mode,
        tenants: readCache(),
        claimedCloud: false,
        code,
      };
    }
    if (code === PLATFORM_TENANT_ERROR.NOT_READABLE) {
      snapshot.mode = PLATFORM_TENANT_MODE.SCHEMA_PRESENT_NOT_READABLE;
      return {
        ok: false,
        mode: snapshot.mode,
        tenants: readCache(),
        claimedCloud: false,
        code,
        error: snapshot.lastError,
      };
    }
    snapshot.mode = PLATFORM_TENANT_MODE.QUERY_FAILED;
    return {
      ok: false,
      mode: snapshot.mode,
      tenants: readCache(),
      claimedCloud: false,
      code,
      error: snapshot.lastError,
    };
  }

  const listed = await bound.queryAdapter.list();
  if (!listed?.ok) {
    const code = listed?.code || PLATFORM_TENANT_ERROR.QUERY_FAILED;
    snapshot.mode = PLATFORM_TENANT_MODE.QUERY_FAILED;
    snapshot.lastCode = code;
    snapshot.lastError = listed?.error || code;
    snapshot.lastCloudTenants = null;
    return {
      ok: false,
      mode: snapshot.mode,
      tenants: readCache(),
      claimedCloud: false,
      code,
      error: snapshot.lastError,
    };
  }

  const tenants = Array.isArray(listed.tenants) ? listed.tenants : [];
  snapshot.mode = PLATFORM_TENANT_MODE.CLOUD_CANONICAL;
  snapshot.lastCloudTenants = tenants;
  writeCache(tenants);
  return {
    ok: true,
    mode: snapshot.mode,
    tenants,
    claimedCloud: true,
  };
}

export async function upsertCanonicalPlatformTenant(tenant) {
  if (snapshot.mode !== PLATFORM_TENANT_MODE.CLOUD_CANONICAL) {
    return {
      ok: false,
      code: PLATFORM_TENANT_ERROR.NOT_CANONICAL,
      error: "Cloud Tenant authority is not bound. Refusing dual-authority local write as canonical.",
    };
  }
  if (!bound?.queryAdapter || typeof bound.queryAdapter.upsert !== "function") {
    return {
      ok: false,
      code: PLATFORM_TENANT_ERROR.CLOUD_WRITE_REQUIRED,
      error: "Canonical Tenant writes require platform_tenants.",
    };
  }
  const result = await bound.queryAdapter.upsert(tenant);
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || PLATFORM_TENANT_ERROR.WRITE_FAILED,
      error: result?.error || "platform_tenants write failed",
    };
  }
  await refreshPlatformTenantAuthority();
  return { ok: true, tenant: result.tenant };
}
