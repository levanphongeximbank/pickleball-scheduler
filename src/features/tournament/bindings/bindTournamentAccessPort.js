/**
 * Composition binding — Tournament domain + Club bridge → Platform tournament access port.
 */
import { bindTournamentAccessPort } from "../../../auth/ports/tournamentAccessPort.js";
import { assertTournamentAccess } from "../../../domain/tournamentService.js";
import { resolveTournamentClubId } from "../../club/services/clubTournamentBridge.js";

let bound = false;

export function bindTournamentAccessPortFromDomain() {
  if (bound) {
    return;
  }
  bindTournamentAccessPort({
    assertTournamentAccess,
    resolveTournamentClubId,
  });
  bound = true;
}
