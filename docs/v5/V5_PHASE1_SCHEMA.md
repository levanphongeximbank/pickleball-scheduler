# Phase 1 Schema Contract

## Objective

Define the canonical v5 platform schema contract used by the new core platform foundation.

## Core entities

### Tenant
- id: string
- tenant_id: string
- name: string
- plan: string
- status: string
- created_at: string
- updated_at: string

### User
- id: string
- user_id: string
- email: string
- role: string
- tenant_id: string
- created_at: string
- updated_at: string

### Role / Permission
- roles: array<string>
- permissions: array<string>
- role_permissions: map<string, array<string>>

### Subscription
- id: string
- tenant_id: string
- plan: string
- status: string
- feature_flags: object
- created_at: string
- updated_at: string

### Audit Event
- id: string
- tenant_id: string
- actor_user_id: string | null
- action: string
- entity_type: string | null
- target_id: string | null
- metadata: object
- created_at: string

### Notification
- id: string
- tenant_id: string
- user_id: string
- channel: string
- title: string
- body: string
- created_at: string

### Setting
- id: string
- tenant_id: string
- scope: string
- key: string
- value: string | object
- created_at: string
- updated_at: string

## Naming rules

- Prefer tenant_id everywhere for tenant-scoped records.
- Prefer singular core names for domain entities.
- Avoid mixing venueId, tenantId, clubId aliases for the same meaning in the core layer.

## Migration notes from v4

- Existing v4 club blob storage remains the legacy baseline.
- v5 core entities should be introduced as new canonical records.
- Legacy v4 data should be mapped into v5 schemas during future migration steps.
- No production rollout until migration tests pass in staging.
