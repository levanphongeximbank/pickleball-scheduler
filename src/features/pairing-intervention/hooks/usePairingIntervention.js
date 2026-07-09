import { useCallback, useMemo, useRef } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { INTERVENTION_PHASE } from "../constants.js";
import {
  canPairingIntervention,
  guardPairingIntervention,
  logCourtPairingOverride,
  logGroupOverride,
  logPairingOverride,
} from "../services/pairingInterventionService.js";

export function usePairingIntervention({
  phase = INTERVENTION_PHASE.TOURNAMENT,
  tournamentStatus = null,
  previewMode = false,
  clubId = null,
  resourceId = "",
} = {}) {
  const { user } = useAuth();
  const { isSuperAdmin } = useTenant();
  const undoRef = useRef(null);

  const guard = useMemo(
    () => guardPairingIntervention({ user, phase, tournamentStatus, previewMode }),
    [user, phase, tournamentStatus, previewMode]
  );

  const canIntervene = isSuperAdmin && guard.ok;

  const saveUndo = useCallback((snapshot) => {
    undoRef.current = snapshot;
  }, []);

  const popUndo = useCallback(() => {
    const snapshot = undoRef.current;
    undoRef.current = null;
    return snapshot;
  }, []);

  const auditEntryChange = useCallback(
    async ({ interventionType, before, after, reason = "" }) => {
      if (!canIntervene) {
        return { ok: false };
      }
      return logPairingOverride({
        user,
        resourceId,
        clubId,
        interventionType,
        before,
        after,
        reason,
      });
    },
    [canIntervene, user, resourceId, clubId]
  );

  const auditGroupChange = useCallback(
    async ({ interventionType, before, after, reason = "" }) => {
      if (!canIntervene) {
        return { ok: false };
      }
      return logGroupOverride({
        user,
        resourceId,
        clubId,
        interventionType,
        before,
        after,
        reason,
      });
    },
    [canIntervene, user, resourceId, clubId]
  );

  const auditCourtChange = useCallback(
    async ({ interventionType, before, after, reason = "" }) => {
      if (!canIntervene) {
        return { ok: false };
      }
      return logCourtPairingOverride({
        user,
        resourceId,
        clubId,
        interventionType,
        before,
        after,
        reason,
      });
    },
    [canIntervene, user, resourceId, clubId]
  );

  return {
    user,
    isSuperAdmin,
    canIntervene,
    guard,
    canPairingIntervention: canPairingIntervention({
      user,
      phase,
      tournamentStatus,
      previewMode,
    }),
    saveUndo,
    popUndo,
    auditEntryChange,
    auditGroupChange,
    auditCourtChange,
  };
}
