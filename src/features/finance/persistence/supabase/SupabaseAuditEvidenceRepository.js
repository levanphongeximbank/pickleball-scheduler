/**
 * Supabase Finance audit evidence repository (Phase 1G).
 */

import { requireTenantScope } from "../repositories/durablePorts.js";
import { FINANCE_TABLES } from "./schema.js";
import {
  auditEvidenceFromRow,
  auditEvidenceToRow,
  normalizeAuditEvidenceForWrite,
} from "./rowMappers.js";
import { fetchByTenantId, insertRow, updateWithExpectedVersion } from "./repositorySupport.js";

/**
 * @param {object} client
 */
export function createSupabaseAuditEvidenceRepository(client) {
  const table = FINANCE_TABLES.auditEvidence;
  return Object.freeze({
    async create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      // createAuditEvidenceRecord rejects secrets / raw payloads
      const record = normalizeAuditEvidenceForWrite(input, tid);
      const row = await insertRow(client, table, auditEvidenceToRow(record), "AuditEvidence", tid);
      return auditEvidenceFromRow(row);
    },
    async getById(tenantId, id) {
      const row = await fetchByTenantId(client, table, tenantId, id, "AuditEvidence");
      return auditEvidenceFromRow(row);
    },
    async update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      const current = await this.getById(tid, id);
      const merged = normalizeAuditEvidenceForWrite(
        {
          ...current,
          ...nextInput,
          id: current.id,
          tenantId: tid,
          version: current.version,
          createdAt: current.createdAt,
        },
        tid
      );
      const patch = auditEvidenceToRow({ ...merged, version: expectedVersion + 1 });
      const row = await updateWithExpectedVersion(
        client,
        table,
        tid,
        id,
        expectedVersion,
        patch,
        "AuditEvidence"
      );
      return auditEvidenceFromRow(row);
    },
  });
}
