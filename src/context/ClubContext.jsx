import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

import { getActiveClub, getActiveClubId, loadClubs } from "../data/club.js";
import {
  createClub,
  deleteClub,
  getClubSummary,
  renameClub,
  switchActiveClub,
} from "../domain/clubService.js";
import { ensureMonthlySkillLevelProposals } from "../domain/skillLevelService.js";
import { useAuth } from "./AuthContext.jsx";
import { useTenant } from "./TenantContext.jsx";
import { canAccessClub } from "../auth/rbac.js";
import {
  listClubsForTenant,
} from "../features/tenant/guards/tenantGuard.js";
import { autoPullOnClubActivate, isAiAutoCloudSyncEnabled } from "../ai/autoCloudSync.js";
import { syncClubRegistryForUser } from "../features/club/services/clubRegistryCloudSync.js";
import { isClubRegistryCloudEnabled } from "../features/club/config/clubRegistryFlags.js";
import { isClubDataDirty } from "../domain/clubSyncMetadata.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { pullClubFromCloud } from "../ai/cloudSync.js";
import { isVenueScopedRole, isClubScopedRole, isPlatformWideRole } from "../auth/roles.js";
import { ensureWritableClubForVenueOwner } from "../features/club/services/venueOwnerClubService.js";
import { invalidateMyActiveClubMembershipCache } from "../features/club/services/clubActiveMembershipService.js";
import { hydrateClubScope, clearClubScope } from "../auth/clubScopeResolver.js";
import { hydrateGovernanceScope, clearGovernanceScope } from "../auth/governanceScopeResolver.js";

const ClubContext = createContext(null);

export function ClubProvider({ children }) {
  const { user, rbacEnabled, isAuthenticated } = useAuth();
  const { currentTenantId } = useTenant();
  const [clubs, setClubs] = useState(() => loadClubs());
  const [activeClubId, setActiveClubId] = useState(() => getActiveClubId());
  const [revision, setRevision] = useState(0);
  const [syncConflictMessage, setSyncConflictMessage] = useState(null);
  const [clubScopeStatus, setClubScopeStatus] = useState("idle");

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

  const visibleClubs = useMemo(() => {
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
  }, [clubs, currentTenantId, isAuthenticated, rbacEnabled, user]);

  useEffect(() => {
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
  }, [isAuthenticated, user, currentTenantId]);

  useEffect(() => {
    if (!rbacEnabled || !isAuthenticated || !currentTenantId) {
      return;
    }

    const tenantClubs = listClubsForTenant(currentTenantId);
    if (tenantClubs.length === 0) {
      if (user && isVenueScopedRole(user.role)) {
        const ensured = ensureWritableClubForVenueOwner(user, { activeClubId });
        if (ensured.ok && ensured.clubId && ensured.clubId !== activeClubId) {
          setClubs(loadClubs());
          setActiveClubId(ensured.clubId);
          setRevision((value) => value + 1);
        } else if (ensured.ok && ensured.created) {
          setClubs(loadClubs());
          setRevision((value) => value + 1);
        }
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
  }, [activeClubId, currentTenantId, isAuthenticated, rbacEnabled, user]);

  useEffect(() => {
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
  }, [activeClubId, isAuthenticated, rbacEnabled, user, visibleClubs]);

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
    setClubs(loadClubs());
    setActiveClubId(getActiveClubId());
    setRevision((value) => value + 1);
  }, []);

  const activeClub = useMemo(() => {
    const matched = visibleClubs.find((club) => club.id === activeClubId);
    if (matched) {
      return matched;
    }

    if (!rbacEnabled || !isAuthenticated) {
      return getActiveClub();
    }

    return visibleClubs[0] || null;
  }, [visibleClubs, activeClubId, rbacEnabled, isAuthenticated]);

  useEffect(() => {
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
  }, [activeClubId, isAuthenticated, rbacEnabled, user, visibleClubs]);

  const summary = useMemo(
    () => getClubSummary(activeClub?.id || activeClubId),
    [activeClub?.id, activeClubId, revision]
  );

  const handleSwitchClub = useCallback(
    (clubId) => {
      const trimmed = String(clubId || "").trim();
      if (!trimmed) {
        return { ok: false, error: "CLB không hợp lệ.", code: "CLUB_INVALID" };
      }

      if (rbacEnabled && isAuthenticated) {
        const allowed = visibleClubs.some((club) => club.id === trimmed);
        if (!allowed) {
          return {
            ok: false,
            error: "CLB không nằm trong phạm vi cho phép.",
            code: "CLUB_OUT_OF_SCOPE",
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
    [isAuthenticated, rbacEnabled, user?.id, visibleClubs]
  );

  const handleCreateClub = useCallback((name) => {
    const result = createClub(name);

    if (!result.ok) {
      return result;
    }

    setClubs(loadClubs());
    setActiveClubId(result.club.id);
    setRevision((value) => value + 1);
    return result;
  }, []);

  const handleRenameClub = useCallback((clubId, name) => {
    const result = renameClub(clubId, name);

    if (!result.ok) {
      return result;
    }

    setClubs(loadClubs());
    setRevision((value) => value + 1);
    return result;
  }, []);

  const handleDeleteClub = useCallback(
    (clubId) => {
      const result = deleteClub(clubId);

      if (!result.ok) {
        return result;
      }

      setClubs(loadClubs());
      setActiveClubId(getActiveClubId());
      setRevision((value) => value + 1);
      return result;
    },
    []
  );

  const value = useMemo(
    () => ({
      clubs: visibleClubs,
      allClubs: clubs,
      activeClub,
      activeClubId,
      revision,
      summary,
      clubScopeStatus,
      clubScopeReady: clubScopeStatus === "ready",
      refreshClubs,
      switchClub: handleSwitchClub,
      createClub: handleCreateClub,
      renameClub: handleRenameClub,
      deleteClub: handleDeleteClub,
    }),
    [
      clubs,
      visibleClubs,
      activeClub,
      activeClubId,
      revision,
      summary,
      clubScopeStatus,
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
