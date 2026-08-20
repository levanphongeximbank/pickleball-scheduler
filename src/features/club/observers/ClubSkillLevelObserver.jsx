/**
 * Business observer — monthly skill-level proposals on club activation.
 * Must not be a side-effect authority of Platform ClubContext.
 */
import { useEffect } from "react";

import { useClub } from "../../../context/ClubContext.jsx";
import { ensureMonthlySkillLevelProposals } from "../../../domain/skillLevelService.js";

export function ClubSkillLevelObserver() {
  const { activeClubId, refreshClubs } = useClub();

  useEffect(() => {
    if (!activeClubId) {
      return;
    }

    try {
      const result = ensureMonthlySkillLevelProposals(activeClubId);
      if (
        result?.ok &&
        !result.skipped &&
        (result.proposalCount > 0 || result.holds > 0)
      ) {
        refreshClubs();
      }
    } catch {
      // Skill-level runtime absence must not invalidate Club activation.
    }
  }, [activeClubId, refreshClubs]);

  return null;
}
