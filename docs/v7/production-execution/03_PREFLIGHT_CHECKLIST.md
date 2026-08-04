# Preflight Checklist

- target project_ref confirmed: `expuvcohlcjzvrrauvud`
- baseline SHA confirmed: `fe80e367e848da7c4448b8a40b5a0641014ce37b`
- credential hygiene reviewed and gitignored local credential path verified
- backup and recovery prerequisites confirmed from canonical Phase 6 evidence
- backup and recovery authority present in `docs/platform-governance-operations/pgo-02-incident-recovery-readiness/04_BACKUP_RESTORE_AND_RECOVERY_AUTHORITY.md`
- copy governance present in `docs/platform-governance-operations/pgo-07-data-protection-privacy-retention-records-governance/05_BACKUP_RESTORE_REPLICA_AND_DATA_COPY_GOVERNANCE.md`
- storage restore evidence present in `docs/v6/storage-recovery-drill-01/FRESH_PREFIX_RESTORE_CERTIFICATION.md` and `docs/v6/storage-recovery-drill-01/FRESH_PREFIX_RESTORE_CERTIFICATION.json`
- monitoring and operations evidence present in `docs/production-operations/prod-ops-24h-01/07_BACKUP_MONITORING_AND_OPERATIONS.md`, `docs/production-operations/prod-ops-7d-01/03_MONITORING_AND_LOGGING.md`, and `docs/production-operations/prod-ops-30d-01/04_MONITORING_EFFECTIVENESS.md`
- notification SQL pack artifacts present in `docs/supabase-notification-phase2b-production-*.sql`
- canary plan present and bounded
- rollback matrix present and bounded
- fresh Owner GO required before any mutation step
