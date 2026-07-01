import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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
import {
  listClubsForTenant,
} from "../features/tenant/guards/tenantGuard.js";

const ClubContext = createContext(null);

export function ClubProvider({ children }) {
  const { rbacEnabled, isAuthenticated } = useAuth();
  const { currentTenantId } = useTenant();
  const [clubs, setClubs] = useState(() => loadClubs());
  const [activeClubId, setActiveClubId] = useState(() => getActiveClubId());
  const [revision, setRevision] = useState(0);

  const visibleClubs = useMemo(() => {
    if (!rbacEnabled || !isAuthenticated || !currentTenantId) {
      return clubs;
    }

    const tenantClubs = listClubsForTenant(currentTenantId);
    if (tenantClubs.length === 0) {
      return clubs;
    }

    return tenantClubs;
  }, [clubs, currentTenantId, isAuthenticated, rbacEnabled]);

  useEffect(() => {
    if (!rbacEnabled || !isAuthenticated || !currentTenantId) {
      return;
    }

    const tenantClubs = listClubsForTenant(currentTenantId);
    if (tenantClubs.length === 0) {
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
  }, [activeClubId, currentTenantId, isAuthenticated, rbacEnabled]);

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

  const activeClub = useMemo(
    () => visibleClubs.find((club) => club.id === activeClubId) || getActiveClub(),
    [visibleClubs, activeClubId]
  );

  const summary = useMemo(
    () => getClubSummary(activeClubId),
    [activeClubId, revision]
  );

  const handleSwitchClub = useCallback(
    (clubId) => {
      const result = switchActiveClub(clubId);

      if (!result.ok) {
        return result;
      }

      setActiveClubId(clubId);
      setRevision((value) => value + 1);
      return result;
    },
    []
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
      refreshClubs,
      handleSwitchClub,
      handleCreateClub,
      handleRenameClub,
      handleDeleteClub,
    ]
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const context = useContext(ClubContext);

  if (!context) {
    throw new Error("useClub must be used within ClubProvider");
  }

  return context;
}
