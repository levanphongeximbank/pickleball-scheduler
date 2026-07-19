/**
 * Phase 2E — React hook: canonical governance read model for Club UI surfaces.
 *
 * Provides loading / ready / error states, version, labels, and refresh after
 * mutation / VERSION_CONFLICT. Does not open a refresh loop: refresh is explicit.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  GOVERNANCE_READ_STATE,
  toGovernanceDisplayLabels,
} from "../context/governanceCanonicalReadModel.js";
import {
  buildGovernanceReadModelFromClub,
  readClubGovernance,
  refreshClubGovernanceReadModel,
  shouldRefetchGovernanceOnConflict,
} from "../services/governanceReadService.js";

/**
 * @param {{
 *   clubId?: string|null,
 *   clubSeed?: object|null,
 *   revision?: number,
 *   hydrateProfiles?: boolean,
 *   enabled?: boolean,
 * }} params
 */
export function useGovernanceReadModel({
  clubId = null,
  clubSeed = null,
  revision = 0,
  hydrateProfiles = true,
  enabled = true,
} = {}) {
  const [state, setState] = useState(GOVERNANCE_READ_STATE.IDLE);
  const [readModel, setReadModel] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [version, setVersion] = useState(null);
  const requestSeq = useRef(0);
  const inFlight = useRef(false);

  const applyResult = useCallback((result) => {
    if (!result?.ok) {
      setState(GOVERNANCE_READ_STATE.ERROR);
      setReadModel(null);
      setErrorCode(result?.code || "INTERNAL_ERROR");
      setErrorMessage(result?.error || "Không tải được quản trị CLB.");
      setVersion(null);
      return;
    }
    setState(GOVERNANCE_READ_STATE.READY);
    setReadModel(result.readModel);
    setErrorCode(null);
    setErrorMessage(null);
    setVersion(result.version ?? result.readModel?.club_version ?? null);
  }, []);

  const load = useCallback(
    async ({ forceRpc = false } = {}) => {
      const id = String(clubId || "").trim();
      if (!enabled || !id) {
        setState(GOVERNANCE_READ_STATE.IDLE);
        setReadModel(null);
        setErrorCode(null);
        setErrorMessage(null);
        setVersion(null);
        return null;
      }

      const seq = ++requestSeq.current;
      if (inFlight.current && !forceRpc) {
        // Allow parallel only when forced (conflict refresh); otherwise skip duplicate.
      }
      inFlight.current = true;
      setState(GOVERNANCE_READ_STATE.LOADING);

      try {
        let result;
        if (!forceRpc && clubSeed?.id === id) {
          result = await buildGovernanceReadModelFromClub(clubSeed, {
            hydrateProfiles,
          });
        } else {
          result = await readClubGovernance(id, { hydrateProfiles });
        }
        if (seq !== requestSeq.current) {
          return null;
        }
        applyResult(result);
        return result;
      } finally {
        if (seq === requestSeq.current) {
          inFlight.current = false;
        }
      }
    },
    [clubId, clubSeed, enabled, hydrateProfiles, applyResult]
  );

  useEffect(() => {
    void load({ forceRpc: false });
  }, [load, revision]);

  const refresh = useCallback(
    async (mutationResult = null) => {
      const id = String(clubId || "").trim();
      if (!id) {
        return null;
      }
      const seq = ++requestSeq.current;
      setState(GOVERNANCE_READ_STATE.LOADING);
      const result = await refreshClubGovernanceReadModel(id, {
        previousVersion: version,
        mutationResult,
        hydrateProfiles,
      });
      if (seq !== requestSeq.current) {
        return null;
      }
      applyResult(result);
      return result;
    },
    [clubId, version, hydrateProfiles, applyResult]
  );

  const handleMutationResult = useCallback(
    async (mutationResult) => {
      if (!mutationResult) {
        return null;
      }
      if (
        mutationResult.ok ||
        shouldRefetchGovernanceOnConflict(
          mutationResult.code || mutationResult.serverCode
        )
      ) {
        return refresh(mutationResult);
      }
      return null;
    },
    [refresh]
  );

  const labels = readModel
    ? readModel.labels || toGovernanceDisplayLabels(readModel)
    : null;

  return {
    state,
    loading: state === GOVERNANCE_READ_STATE.LOADING,
    ready: state === GOVERNANCE_READ_STATE.READY,
    error: state === GOVERNANCE_READ_STATE.ERROR,
    errorCode,
    errorMessage,
    readModel,
    labels,
    version,
    owner: readModel?.owner || null,
    president: readModel?.president || null,
    vicePresidents: readModel?.vice_presidents || [],
    refresh,
    handleMutationResult,
    reload: () => load({ forceRpc: true }),
  };
}

export default useGovernanceReadModel;
