import { getScopedStorageKey } from "../data/club.js";

import {

  loadCourtsForClub,

  loadPlayersForClub,

} from "../domain/clubStorage.js";



const COURTS_KEY = "courts";

const PLAYERS_KEY = "players";



export function loadCourtsFromStorage(clubId) {

  return loadCourtsForClub(clubId);

}



export function loadPlayersFromStorage(clubId) {

  return loadPlayersForClub(clubId);

}



export function loadInitialSelectedCourts(courts = []) {

  return courts

    .filter((court) => court?.active !== false)

    .map((court) => court.id);

}



export { getScopedStorageKey, COURTS_KEY, PLAYERS_KEY };

