/**
 * Player Portal MVP sections — presentation adapter only (E2E-04).
 * Does not redesign legacy IndividualPlayerPortalPage; maps projection → sections.
 */

import { deepFreeze } from "../../operations/fingerprint.js";

/**
 * @param {object} projection
 * @returns {ReadonlyArray<object>}
 */
export function buildPlayerPortalSections(projection) {
  const p = projection || {};
  const sections = [
    {
      id: "overview",
      title: "Overview",
      competition: p.competition || null,
      player: p.player || null,
      blockingIssues: p.blockingIssues || [],
    },
    {
      id: "registration-eligibility",
      title: "Registration / Eligibility",
      registrationState: p.player?.registrationState || null,
      eligibilityState: p.player?.eligibilityState || null,
      division: p.player?.division || null,
      category: p.player?.category || null,
      seed: p.player?.seed ?? null,
      poolId: p.player?.poolId || null,
    },
    {
      id: "check-in",
      title: "Check-in",
      checkIn: p.checkIn || null,
    },
    {
      id: "schedule-court",
      title: "Schedule / Court",
      schedule: p.schedule || null,
    },
    {
      id: "match-status",
      title: "Match status",
      matches: p.matches || null,
    },
    {
      id: "standings-qualification",
      title: "Standings / Qualification",
      standings: p.standings || null,
      qualification: p.qualification || null,
    },
    {
      id: "knockout-final",
      title: "Knockout / Final result",
      knockout: p.knockout || null,
      finalResult: p.finalResult || null,
    },
  ];

  return deepFreeze(
    sections.map((s) => ({
      ...s,
      allowedActions: (p.allowedActions || []).filter((a) =>
        String(a.action || "").startsWith("player.")
      ),
    }))
  );
}
