# Phase 1 — Core Platform Checklist

Status: Ready to begin only after the v5 blueprint has been reviewed and approved.

## Scope

Phase 1 focuses on the core SaaS platform foundation:

- tenant
- venue
- user
- role
- permission
- subscription
- audit log
- notification
- setting

## Required deliverables

### Core schema
- [ ] Canonical tenant schema defined
- [ ] Canonical user schema defined
- [ ] Canonical role and permission schema defined
- [ ] Canonical subscription schema defined
- [ ] Canonical audit log schema defined
- [ ] Canonical notification schema defined
- [ ] Canonical settings schema defined

### Core types
- [ ] Canonical TypeScript / JS domain types created
- [ ] Standardized UUID / text contract defined
- [ ] No mixed tenant naming conventions remain in the core models

### Core services
- [ ] Tenant service implemented
- [ ] User service implemented
- [ ] Permission service implemented
- [ ] Subscription service implemented
- [ ] Audit service implemented
- [ ] Notification service implemented
- [ ] Setting service implemented

### Core stores / persistence
- [ ] Persistence boundary defined
- [ ] Tenant-scoped write paths implemented
- [ ] Migration path from v4 to v5 documented

### Security and policy
- [ ] RBAC production default enabled in the new platform core
- [ ] RLS policy matrix defined and implemented
- [ ] Tenant data isolation enforced at the service/database layer
- [ ] Audit events recorded for critical actions

### Testing and validation
- [ ] Unit tests for role/permission checks
- [ ] Unit tests for tenant isolation
- [ ] Migration tests for v4 -> v5 data transition
- [ ] Staging verification checklist completed

## Exit criteria for Phase 1

Phase 1 is complete only when all of the following are true:

- [ ] Core schema exists and is documented
- [ ] Core services are implemented and tested
- [ ] RBAC and RLS policy matrix is verified
- [ ] Audit and notification base layer is present
- [ ] Seed roles / permissions / plans are available
- [ ] Migration tests pass in staging
- [ ] No production rollout is attempted before staging acceptance
