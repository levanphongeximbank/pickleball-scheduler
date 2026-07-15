import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

import {
  getActiveClub,
  getActiveClubId,
  getActiveClubIdPreference,
  loadClubs,
} from "../data/club.js";
import {
  getClubSummary,
  switchActiveClub,
  switchActiveClubCanonical,
} from "../domain/clubService.js";
import {
  createClub as createClubOffline,
  renameClub as renameClubOffline,
  deleteClub as deleteClubOffline,
} from "../features/club/services/clubOfflineCommandAdapter.js";
import {
  createClub as createClubCommand,
  updateClub as updateClubCommand,
} from "../features/club/services/clubTenantService.js";
import { syncClubRegistryForUser } from "../features/club/services/clubRegistryCloudSync.js";
import {
  isClubRegistryCloudEnabled,
  isClubStorageV2Enabled,
} from "../features/club/config/clubRegistryFlags.js";
import { isClubCloudCommandAuthoritative } from "../features/club/services/clubLegacyWriteGuard.js";
import { isClubDataDirty } from "../domain/clubSyncMetadata.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { pullClubFromCloud } from "../ai/cloudSync.js";
import { isVenueScopedRole, isClubScopedRole, isPlatformWideRole } from "../auth/roles.js";
import { ensureWritableClubForVenueOwner } from "../features/club/services/venueOwnerClubService.js";
import { invalidateMyActiveClubMembershipCache } from "../features/club/services/clubActiveMembershipService.js";
import { hydrateClubScope, clearClubScope } from "../auth/clubScopeResolver.js";
import { hydrateGovernanceScope, clearGovernanceScope } from "../auth/governanceScopeResolver.js";
import { canonicalClubRepository } from "../features/club/repositories/index.js";
import { isCanonicalClubRepositoryEnabled } from "../features/club/config/canonicalRepositoryFlags.js";
import { hasSupabaseConfig } from "../auth/supabaseClient.js";
import { API_ERROR_CODES } from "../features/api/constants/apiErrors.js";
import {
  CLUB_READ_STATE,
  filterAccessibleCanonicalClubs,
  isCanonicalClubReadEnabled,
  resolveActiveClubSelection,
  toClubReadSnapshot,
} from "../features/club/context/clubCanonicalReadModel.js";
import { ensureMonthlySkillLevelProposals } from "../domain/skillLevelService.js";
import { useAuth } from "./AuthContext.jsx";
import { useTenant } from "./TenantContext.jsx";
import { canAccessClub } from "../auth/rbac.js";
import {
  listClubsForTenant,
} from "../features/tenant/guards/tenantGuard.js";
import { autoPullOnClubActivate, isAiAutoCloudSyncEnabled } from "../ai/autoCloudSync.js";

const ClubContext = createContext(null);

export function ClubProvider({ children }) {
  const { user, rbacEnabled, isAuthenticated } = useAuth();
  const { currentTenantId } = useTenant();

  // Phase 45A.1 — canonical Club READ cutover. When ON (flag + cloud backend),
  // canonicalClubRepository is the single Club-entity read gateway. When OFF
  // (Production default) or offline/no-Supabase, the legacy registry read path
  // is preserved unchanged for rollback and explicit local mode.
  const canonicalRead = isCanonicalClubReadEnabled({
    canonicalEnabled: isCanonicalClubRepositoryEnabled(),
    hasSupabase: hasSupabaseConfig(),
  });

  const [clubs, setClubs] = useState(() => loadClubs());
  const [activeClubId, setActiveClubId] = useState(() =>
    canonicalRead ? getActiveClubIdPreference() : getActiveClubId()
  );
  const [revision, setRevision] = useState(0);
  const [syncConflictMessage, setSyncConflictMessage] = useState(null);
  const [clubScopeStatus, setClubScopeStatus] = useState("idle");

  // Canonical read snapshot (only authoritative when canonicalRead === true).
  const [canonicalClubs, setCanonicalClubs] = useState([]);
  const [clubReadState, setClubReadState] = useState(
    canonicalRead ? CLUB_READ_STATE.IDLE : CLUB_READ_STATE.READY
  );
  const [clubReadErrorCode, setClubReadErrorCode] = useState(null);
  const [canonicalReloadNonce, setCanonicalReloadNonce] = useState(0);

  // Phase 44C.1 — hydrate the canonical allowed-club scope once per authenticated
  // user/tenant context. Cleared first so a tenant/user switch cannot temporarily
  // grant access from a previous context; protected guards deny until ready.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      clearClubScope();
      clearGovernanceScope();
      setClubScopeStatus("idle");
      return undefined;
    }

    let cancelled = false;
    clearClubScope();
    clearGovernanceScope();
    setClubScopeStatus("loading");

    // Phase 44C.1A — hydrate canonical governance elevation alongside club scope so
    // PLAYER president/vice-president elevation is decided by the cloud SSOT, never
    // by the local registry. Deny-by-default (no elevation) until ready.
    void Promise.all([
      hydrateClubScope({ user, tenantId: currentTenantId, rbacEnabled }),
      hydrateGovernanceScope({ user }),
    ]).then(([clubResult]) => {
      if (cancelled) {
        return;
      }
      setClubScopeStatus(clubResult?.ok ? "ready" : "error");
      setRevision((value) => value + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, currentTenantId, rbacEnabled]);

  // Phase 45A.1 — hydrate the Club-entity list from the canonical repository.
  // Snapshot is cleared on logout / user switch / tenant switch so a previous
  // context can never leak clubs. A cloud error/loading NEVER falls back to the
  // local registry (visibleClubs stays empty until READY).
  useEffect(() => {
    if (!canonicalRead) {
      return undefined;
    }

    if (!isAuthenticated || !user?.id) {
      setCanonicalClubs([]);
      setClubReadState(CLUB_READ_STATE.IDLE);
      setClubReadErrorCode(null);
      return undefined;
    }

    let cancelled = false;
    setCanonicalClubs([]);
    setClubReadState(CLUB_READ_STATE.LOADING);
    setClubReadErrorCode(null);

    void canonicalClubRepository
      .listClubsForCurrentScope({ user, tenantId: currentTenantId, rbacEnabled })
      .then((result) => {
        if (cancelled) {
          return;
        }
        const snapshot = toClubReadSnapshot(result);
        setCanonicalClubs(snapshot.clubs);
        setClubReadState(snapshot.state);
        setClubReadErrorCode(snapshot.errorCode);
        setRevision((value) => value + 1);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setCanonicalClubs([]);
        setClubReadState(CLUB_READ_STATE.ERROR);
        setClubReadErrorCode(API_ERROR_CODES.INTERNAL_ERROR);
        setRevision((value) => value + 1);
      });

    return () => {
      cancelled = true;
    };
  }, [canonicalRead, isAuthenticated, user, currentTenantId, rbacEnabled, canonicalReloadNonce]);

  const visibleClubs = useMemo(() => {
    if (canonicalRead) {
      // Cloud-authoritative canonical read: only expose clubs when READY.
      // Loading/error never leaks the legacy registry.
      if (clubReadState !== CLUB_READ_STATE.READY) {
        return [];
      }
      return filterAccessibleCanonicalClubs({
        clubs: canonicalClubs,
        user,
        rbacEnabled,
        isAuthenticated,
        canAccessClub,
      });
    }

    if (!rbacEnabled || !isAuthenticated || !currentTenantId) {
      return clubs;
    }

    const sourceClubs = isPlatformWideRole(user?.role)
      ? loadClubs()
      : listClubsForTenant(currentTenantId);
    const visible = sourceClubs.filter((club) =>
      canAccessClub(user, club.id, { venueId: club.venueId || null }, { rbacEnabled })
    );

    if (isClubScopedRole(user?.role) && user?.clubId) {
      const alreadyVisible = visible.some((club) => club.id === user.clubId);
      if (!alreadyVisible) {
        const assigned = loadClubs().find((club) => club.id === user.clubId && !club.isDefault);
        if (
          assigned &&
          canAccessClub(user, assigned.id, { venueId: assigned.venueId || null }, { rbacEnabled })
        ) {
          return [...visible, assigned];
        }
      }
    }

    return visible;
  }, [
    canonicalRead,
    canonicalClubs,
    clubReadState,
    clubs,
    currentTenantId,
    isAuthenticated,
    rbacEnabled,
    user,
  ]);

  useEffect(() => {
    if (canonicalRead) {
      return undefined;
    }
    if (!isAuthenticated || !user?.id || !isClubRegistryCloudEnabled()) {
      return undefined;
    }

    let cancelled = false;
    void syncClubRegistryForUser(user).then((result) => {
      if (!cancelled && result.ok) {
        setClubs(loadClubs());
        setRevision((value) => value + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canonicalRead, isAuthenticated, user, currentTenantId]);

  useEffect(() => {
    // Legacy blob-registry auto-provisioning/selection. In canonical read mode
    // active-club selection is handled by the canonical validation effect below.
    if (canonicalRead) {
      return;
    }
    if (!rbacEnabled || !isAuthenticated || !currentTenantId) {
      return;
    }

    const tenantClubs = listClubsForTenant(currentTenantId);
    if (tenantClubs.length === 0) {
      if (user && isVenueScopedRole(user.role)) {
        void Promise.resolve(ensureWritableClubForVenueOwner(user, { activeClubId })).then(
          (ensured) => {
            if (!ensured?.ok) {
              return;
            }
            if (ensured.clubId && ensured.clubId !== activeClubId) {
              setClubs(loadClubs());
              setActiveClubId(ensured.clubId);
              setRevision((value) => value + 1);
            } else if (ensured.created) {
              setClubs(loadClubs());
              setCanonicalReloadNonce((value) => value + 1);
              setRevision((value) => value + 1);
            }
          }
        );
      }
      return;
    }

    if (user && isClubScopedRole(user.role)) {
      return;
    }

    const nextClubId = tenantClubs[0].id;
    const activeInTenant = tenantClubs.some((club) => club.id === activeClubId);
    if (!activeInTenant && nextClubId !== activeClubId) {
      const result = switchActiveClub(nextClubId);
      if (result.ok) {
        setActiveClubId((current) => (current === nextClubId ? current : nextClubId));
        setRevision((value) => value + 1);
      }
    }
  }, [canonicalRead, activeClubId, currentTenantId, isAuthenticated, rbacEnabled, user]);

  useEffect(() => {
    // Legacy profiles.club_id-driven active switch. Not authoritative in
    // canonical read mode (membership SSOT is public.club_members).
    if (canonicalRead) {
      return;
    }
    if (!rbacEnabled || !isAuthenticated || !user?.clubId) {
      return;
    }

    if (!isClubScopedRole(user.role)) {
      return;
    }

    if (user.clubId === activeClubId) {
      return;
    }

    const canUseClub = visibleClubs.some((club) => club.id === user.clubId);
    if (!canUseClub) {
      return;
    }

    const result = switchActiveClub(user.clubId);
    if (result.ok) {
      setActiveClubId(user.clubId);
      setRevision((value) => value + 1);
    }
  }, [canonicalRead, activeClubId, isAuthenticated, rbacEnabled, user, visibleClubs]);

  useEffect(() => {
    if (!activeClubId || !isAuthenticated || !isAiAutoCloudSyncEnabled()) {
      return;
    }

    let cancelled = false;

    void autoPullOnClubActivate(activeClubId).then((result) => {
      if (!cancelled && result?.ok && !result.skipped && !result.error) {
        setRevision((value) => value + 1);
      }
    });

    const onClubConflict = (event) => {
      const conflictClubId = event?.detail?.clubId || activeClubId;

      if (isClubDataDirty(conflictClubId)) {
        setSyncConflictMessage(
          "Dữ liệu CLB đã được cập nhật trên cloud trong khi máy bạn có thay đổi chưa đồng bộ. Vào Cài đặt để đẩy lên hoặc tải lại."
        );
        return;
      }

      setSyncConflictMessage("Dữ liệu CLB đã được cập nhật bởi người khác — đang tải lại...");
      void pullClubFromCloud({
        clubId: conflictClubId,
        permission: PERMISSIONS.SCHEDULING_RUN,
      }).then((result) => {
        if (!cancelled && result?.ok) {
          setRevision((value) => value + 1);
          setSyncConflictMessage("Đã tải dữ liệu CLB mới nhất từ cloud.");
        } else if (!cancelled && result?.error) {
          setSyncConflictMessage(result.error);
        }
      });
    };

    window.addEventListener("club-data:version-conflict", onClubConflict);

    return () => {
      cancelled = true;
      window.removeEventListener("club-data:version-conflict", onClubConflict);
    };
  }, [activeClubId, isAuthenticated]);

  useEffect(() => {
    if (!activeClubId) {
      return;
    }

    const result = ensureMonthlySkillLevelProposals(activeClubId);
    if (
      result.ok &&
      !result.skipped &&
      (result.proposalCount > 0 || result.holds > 0)
    ) {
      setRevision((value) => value + 1);
    }
  }, [activeClubId]);

  const refreshClubs = useCallback(() => {
    if (canonicalRead) {
      setCanonicalReloadNonce((value) => value + 1);
      setActiveClubId(getActiveClubIdPreference());
    } else {
      setClubs(loadClubs());
      setActiveClubId(getActiveClubId());
    }
    setRevision((value) => value + 1);
  }, [canonicalRead]);

  const activeClub = useMemo(() => {
    if (canonicalRead) {
      // Existence/selection comes only from the canonical visible set.
      return resolveActiveClubSelection({
        preferredClubId: activeClubId,
        visibleClubs,
      }).activeClub;
    }

    const matched = visibleClubs.find((club) => club.id === activeClubId);
    if (matched) {
      return matched;
    }

    if (!rbacEnabled || !isAuthenticated) {
      return getActiveClub();
    }

    return visibleClubs[0] || null;
  }, [canonicalRead, visibleClubs, activeClubId, rbacEnabled, isAuthenticated]);

  // Canonical active-club validation: a stale/absent activeClubId is replaced
  // deterministically (first visible canonical club) or cleared. Never selects a
  // club absent from the canonical cloud registry.
  useEffect(() => {
    if (!canonicalRead) {
      return;
    }
    if (clubReadState !== CLUB_READ_STATE.READY) {
      return;
    }

    const selection = resolveActiveClubSelection({
      preferredClubId: activeClubId,
      visibleClubs,
    });

    if (selection.activeClubId === activeClubId) {
      return;
    }

    if (!selection.activeClubId) {
      setActiveClubId(null);
      setRevision((value) => value + 1);
      return;
    }

    const result = switchActiveClubCanonical(selection.activeClubId);
    if (result.ok) {
      setActiveClubId(selection.activeClubId);
      setRevision((value) => value + 1);
    }
  }, [canonicalRead, clubReadState, activeClubId, visibleClubs]);

  // Legacy active-club validation (blob registry). Skipped in canonical mode.
  useEffect(() => {
    if (canonicalRead) {
      return;
    }
    if (!rbacEnabled || !isAuthenticated) {
      return;
    }

    const hasAccess = visibleClubs.some((club) => club.id === activeClubId);
    if (hasAccess) {
      return;
    }

    const targetId =
      user?.clubId && visibleClubs.some((club) => club.id === user.clubId)
        ? user.clubId
        : visibleClubs[0]?.id;

    if (!targetId || targetId === activeClubId) {
      return;
    }

    const result = switchActiveClub(targetId);
    if (result.ok) {
      setActiveClubId(targetId);
      setRevision((value) => value + 1);
    }
  }, [canonicalRead, activeClubId, isAuthenticated, rbacEnabled, user, visibleClubs]);

  const summary = useMemo(
    () => getClubSummary(activeClub?.id || activeClubId),
    [activeClub?.id, activeClubId, revision]
  );

  const handleSwitchClub = useCallback(
    (clubId) => {
      const trimmed = String(clubId || "").trim();
      if (!trimmed) {
        return {
          ok: false,
          error: "CLB không hợp lệ.",
          code: API_ERROR_CODES.CLUB_REQUIRED,
        };
      }

      if (canonicalRead) {
        const allowed = visibleClubs.some((club) => club.id === trimmed);
        if (!allowed) {
          return {
            ok: false,
            error: "CLB không nằm trong phạm vi cho phép.",
            code: API_ERROR_CODES.CLUB_OUT_OF_SCOPE,
          };
        }

        invalidateMyActiveClubMembershipCache(user?.id || null);

        const result = switchActiveClubCanonical(trimmed);
        if (!result.ok) {
          return result;
        }

        setActiveClubId(trimmed);
        setRevision((value) => value + 1);
        return result;
      }

      if (rbacEnabled && isAuthenticated) {
        const allowed = visibleClubs.some((club) => club.id === trimmed);
        if (!allowed) {
          return {
            ok: false,
            error: "CLB không nằm trong phạm vi cho phép.",
            code: API_ERROR_CODES.CLUB_OUT_OF_SCOPE,
          };
        }
      }

      invalidateMyActiveClubMembershipCache(user?.id || null);

      const result = switchActiveClub(trimmed);

      if (!result.ok) {
        return result;
      }

      setActiveClubId(trimmed);
      setRevision((value) => value + 1);
      return result;
    },
    [canonicalRead, isAuthenticated, rbacEnabled, user?.id, visibleClubs]
  );

  // Phase 45A.3D — create/rename route through clubTenantService under V2.
  // Offline/V2-OFF keeps domain/clubService adapters.
  const handleCreateClub = useCallback(
    async (name) => {
      const result = isClubStorageV2Enabled()
        ? await createClubCommand({ name })
        : createClubOffline(name);

      if (!result.ok) {
        return result;
      }

      if (canonicalRead || isClubStorageV2Enabled()) {
        setCanonicalReloadNonce((value) => value + 1);
      } else {
        setClubs(loadClubs());
      }
      if (result.club?.id) {
        setActiveClubId(result.club.id);
      }
      setRevision((value) => value + 1);
      return result;
    },
    [canonicalRead]
  );

  const handleRenameClub = useCallback(
    async (clubId, name) => {
      const result = isClubStorageV2Enabled()
        ? await updateClubCommand(clubId, {
            name,
            expectedClubVersion:
              (canonicalRead
                ? canonicalClubs.find((c) => c.id === clubId)?.version
                : null) ??
              clubs.find((c) => c.id === clubId)?.version ??
              undefined,
          })
        : renameClubOffline(clubId, name);

      if (!result.ok) {
        return result;
      }

      if (canonicalRead || isClubStorageV2Enabled()) {
        setCanonicalReloadNonce((value) => value + 1);
      } else {
        setClubs(loadClubs());
      }
      setRevision((value) => value + 1);
      return result;
    },
    [canonicalRead, canonicalClubs, clubs]
  );

  const handleDeleteClub = useCallback(
    (clubId) => {
      // Phase 45A.3E — hard-delete deferred under V2 cloud; offline adapter blocks.
      if (isClubCloudCommandAuthoritative()) {
        return {
          ok: false,
          code: API_ERROR_CODES.FEATURE_DISABLED,
          error:
            "Xóa CLB trên cloud chưa hỗ trợ. Dùng vô hiệu hóa (status) hoặc chờ phase archive/delete.",
        };
      }

      const result = deleteClubOffline(clubId);

      if (!result.ok) {
        return result;
      }

      if (canonicalRead) {
        setCanonicalReloadNonce((value) => value + 1);
        setActiveClubId(getActiveClubIdPreference());
      } else {
        setClubs(loadClubs());
        setActiveClubId(getActiveClubId());
      }
      setRevision((value) => value + 1);
      return result;
    },
    [canonicalRead]
  );

  const value = useMemo(
    () => ({
      clubs: visibleClubs,
      allClubs: canonicalRead ? canonicalClubs : clubs,
      activeClub,
      activeClubId,
      revision,
      summary,
      clubScopeStatus,
      clubScopeReady: clubScopeStatus === "ready",
      // Phase 45A.1 — canonical read state surface.
      canonicalClubRead: canonicalRead,
      clubReadState,
      clubReadReady: canonicalRead ? clubReadState === CLUB_READ_STATE.READY : true,
      clubReadError: clubReadErrorCode,
      refreshClubs,
      switchClub: handleSwitchClub,
      createClub: handleCreateClub,
      renameClub: handleRenameClub,
      deleteClub: handleDeleteClub,
    }),
    [
      canonicalRead,
      canonicalClubs,
      clubs,
      visibleClubs,
      activeClub,
      activeClubId,
      revision,
      summary,
      clubScopeStatus,
      clubReadState,
      clubReadErrorCode,
      refreshClubs,
      handleSwitchClub,
      handleCreateClub,
      handleRenameClub,
      handleDeleteClub,
    ]
  );

  return (
    <ClubContext.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(syncConflictMessage)}
        autoHideDuration={6000}
        onClose={() => setSyncConflictMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSyncConflictMessage(null)}
          severity="warning"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {syncConflictMessage}
        </Alert>
      </Snackbar>
    </ClubContext.Provider>
  );
}

export function useClub() {
  const context = useContext(ClubContext);

  if (!context) {
    throw new Error("useClub must be used within ClubProvider");
  }

  return context;
}
