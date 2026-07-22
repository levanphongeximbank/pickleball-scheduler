/**
 * CORE-14 Phase 1F — deterministic adapter occupancy identity.
 * Tuple excludes array index, input order, wall clock, and RNG.
 */

import { CORE14_OID_V1, CORE14_ADAPTER_CONTRACT_V1 } from "../constants/versions.js";
import { serializeCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";

/**
 * @param {{
 *   adapterContractVersion?: string,
 *   sourceContractVersion: string,
 *   resourceKey: object,
 *   sourceRecordIdentity: string,
 *   activityIdentity: string,
 *   startMs: number,
 *   endMs: number,
 *   occupancyRole: string,
 * }} tuple
 * @returns {string}
 */
export function createAdapterOccupancyId(tuple) {
  const resourceKeyCanonical = serializeCanonicalResourceKey(tuple.resourceKey);
  const material = {
    adapterContractVersion: tuple.adapterContractVersion || CORE14_ADAPTER_CONTRACT_V1,
    sourceContractVersion: tuple.sourceContractVersion,
    resourceKeyCanonical,
    sourceRecordIdentity: tuple.sourceRecordIdentity,
    activityIdentity: tuple.activityIdentity,
    startMs: tuple.startMs,
    endMs: tuple.endMs,
    occupancyRole: tuple.occupancyRole,
  };
  const hex = fingerprintValue(material, { includeMetadata: false });
  return `${CORE14_OID_V1}:${hex}`;
}
