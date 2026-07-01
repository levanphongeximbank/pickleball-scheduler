import { deserializeBillingRow } from "../repositories/billingRowMap.js";

/**
 * Create or fetch trial subscription via Supabase RPC (owner-safe, no direct insert).
 * Requires docs/supabase-billing-phase9-trial-rpc.sql applied on staging.
 */
export async function ensureTrialSubscriptionRpc(store, { tenantId } = {}) {
  if (!store?.client?.rpc) {
    return { ok: false, error: "supabase_client_unavailable", code: "NO_CLIENT" };
  }

  const payload = {};
  if (tenantId) {
    payload.p_tenant_id = tenantId;
  }

  const { data, error } = await store.client.rpc("billing_create_trial_subscription", payload);

  if (error) {
    const message = error.message || String(error);
    const code = message.includes("billing_create_trial_subscription")
      ? "RPC_NOT_APPLIED"
      : error.code || "RPC_ERROR";
    return { ok: false, error: message, code };
  }

  if (!data) {
    return { ok: false, error: "empty_rpc_response", code: "RPC_EMPTY" };
  }

  const row = deserializeBillingRow("subscriptions", data);
  const current = store.read("subscriptions") || [];
  const index = current.findIndex((item) => item.id === row.id || item.tenant_id === row.tenant_id);
  const next =
    index === -1
      ? [...current, row]
      : current.map((item, i) => (i === index ? { ...item, ...row } : item));
  store.write("subscriptions", next);

  if (typeof store.hydrate === "function") {
    try {
      await store.hydrate("billingAuditLogs");
      await store.hydrate("billingEvents");
    } catch {
      // Non-fatal — subscription row is primary
    }
  }

  return { ok: true, subscription: row };
}
