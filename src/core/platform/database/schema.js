export const V5_PLATFORM_SCHEMA = {
  version: 1,
  tables: {
    tenants: {
      columns: [
        { name: "id", type: "text", primaryKey: true },
        { name: "tenant_id", type: "text", unique: true },
        { name: "name", type: "text", notNull: true },
        { name: "plan", type: "text", default: "trial" },
        { name: "status", type: "text", default: "active" },
        { name: "created_at", type: "timestamptz", default: "now()" },
        { name: "updated_at", type: "timestamptz", default: "now()" },
      ],
    },
    users: {
      columns: [
        { name: "id", type: "text", primaryKey: true },
        { name: "user_id", type: "text", unique: true },
        { name: "email", type: "text", notNull: true },
        { name: "role", type: "text", default: "PLAYER" },
        { name: "tenant_id", type: "text", notNull: true },
        { name: "created_at", type: "timestamptz", default: "now()" },
        { name: "updated_at", type: "timestamptz", default: "now()" },
      ],
    },
    subscriptions: {
      columns: [
        { name: "id", type: "text", primaryKey: true },
        { name: "tenant_id", type: "text", unique: true },
        { name: "plan", type: "text", default: "trial" },
        { name: "status", type: "text", default: "active" },
        { name: "feature_flags", type: "jsonb", default: "'{}'::jsonb" },
        { name: "created_at", type: "timestamptz", default: "now()" },
        { name: "updated_at", type: "timestamptz", default: "now()" },
      ],
    },
    audit_logs: {
      columns: [
        { name: "id", type: "text", primaryKey: true },
        { name: "tenant_id", type: "text", notNull: true },
        { name: "actor_user_id", type: "text" },
        { name: "action", type: "text", notNull: true },
        { name: "target_id", type: "text" },
        { name: "metadata", type: "jsonb", default: "'{}'::jsonb" },
        { name: "created_at", type: "timestamptz", default: "now()" },
      ],
    },
    notifications: {
      columns: [
        { name: "id", type: "text", primaryKey: true },
        { name: "tenant_id", type: "text", notNull: true },
        { name: "user_id", type: "text" },
        { name: "channel", type: "text", default: "email" },
        { name: "title", type: "text", notNull: true },
        { name: "body", type: "text", default: "" },
        { name: "created_at", type: "timestamptz", default: "now()" },
      ],
    },
    settings: {
      columns: [
        { name: "id", type: "text", primaryKey: true },
        { name: "tenant_id", type: "text", notNull: true },
        { name: "scope", type: "text", default: "tenant" },
        { name: "key", type: "text", notNull: true },
        { name: "value", type: "jsonb", default: "'{}'::jsonb" },
        { name: "created_at", type: "timestamptz", default: "now()" },
        { name: "updated_at", type: "timestamptz", default: "now()" },
      ],
    },
  },
};
