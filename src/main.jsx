import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";

import { TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE } from "./features/tournament-experience-ui/design/tournamentDesignTokens.js";

/**
 * Prototype routes boot an isolated React tree.
 * Production App / Auth / MainLayout / court-resource must not load here —
 * that graph currently throws on node:crypto in the browser and blanks #root.
 */
async function boot() {
  const pathname = window.location.pathname;
  if (pathname.startsWith(TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE)) {
    const { mountTournamentExperiencePrototype } = await import(
      "./features/tournament-experience-ui/mountPrototype.jsx"
    );
    mountTournamentExperiencePrototype();
    return;
  }

  await import("./appEntry.jsx");
}

void boot();
