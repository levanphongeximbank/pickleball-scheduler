/** Maps billing store collection keys to Supabase table names. */
export const BILLING_COLLECTION_TABLES = Object.freeze({
  plans: "plans",
  planLimits: "plan_limits",
  subscriptions: "tenant_subscriptions",
  invoices: "invoices",
  invoiceItems: "invoice_items",
  payments: "payments",
  billingEvents: "billing_events",
  billingAuditLogs: "billing_audit_logs",
});

export function getBillingTableName(collection) {
  return BILLING_COLLECTION_TABLES[collection] || collection;
}
