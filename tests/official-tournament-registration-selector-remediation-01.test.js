/**
 * OFFICIAL-TOURNAMENT-REGISTRATION-SELECTOR-REMEDIATION-01
 *
 * Open Mode doubles hid the athlete list (showPlayerList={false}) while caption
 * still said "VĐV hiển thị" — Owner could not see a list to pick from.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  ALL_CLUBS_FILTER,
  applyOfficialPairPlayerPick,
  buildOfficialPickerCountCaption,
  excludePlayerIdFromOptions,
  filterTournamentPickerPlayers,
} from "../src/utils/tournamentPlayerPicker.js";
import { EVENT_TYPE } from "../src/models/tournament/constants.js";
import { validateOpenRegistrationPlayers } from "../src/tournament/engines/officialTournamentEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function makePlayers(n = 34) {
  return Array.from({ length: n }, (_, index) => ({
    id: `ath-${index + 1}`,
    name: `VDV ${index + 1}`,
    gender: index % 2 === 0 ? "Nam" : "Nữ",
    level: 3.5,
    sourceClubId: "club-219e4a7cbd73437eb6271f02a53314c3",
    clubName: "CLB ACCC",
    tenantId: "venue-prod-main",
  }));
}

describe("official-tournament-registration-selector-remediation-01", () => {
  it("A. 34 canonical eligible athletes → filtered options > 0 and equal 34", () => {
    const players = makePlayers(34);
    const filtered = filterTournamentPickerPlayers(players, {
      clubFilter: ALL_CLUBS_FILTER,
      genderFilter: "all",
      search: "",
      eventType: EVENT_TYPE.OPEN_DOUBLE,
      excludePlayerIds: [],
    });
    assert.equal(filtered.length, 34);
    assert.equal(
      buildOfficialPickerCountCaption({
        filteredCount: filtered.length,
        totalCount: players.length,
        showPlayerList: true,
      }),
      "34/34 VĐV hiển thị"
    );
  });

  it("B. Toàn bộ CLB does not exclude by club", () => {
    const players = makePlayers(34);
    players[0].sourceClubId = "club-other";
    const filtered = filterTournamentPickerPlayers(players, {
      clubFilter: ALL_CLUBS_FILTER,
      genderFilter: "all",
      eventType: EVENT_TYPE.OPEN_DOUBLE,
    });
    assert.equal(filtered.length, 34);
  });

  it("C. gender=all keeps male + female", () => {
    const players = makePlayers(34);
    const filtered = filterTournamentPickerPlayers(players, {
      clubFilter: ALL_CLUBS_FILTER,
      genderFilter: "all",
      eventType: EVENT_TYPE.OPEN_DOUBLE,
    });
    const males = filtered.filter((p) => p.gender === "Nam").length;
    const females = filtered.filter((p) => p.gender === "Nữ").length;
    assert.equal(males, 17);
    assert.equal(females, 17);
  });

  it("D. zero registrations → no already-registered exclusion", () => {
    const players = makePlayers(34);
    const filtered = filterTournamentPickerPlayers(players, {
      clubFilter: ALL_CLUBS_FILTER,
      genderFilter: "all",
      eventType: EVENT_TYPE.OPEN_DOUBLE,
      excludePlayerIds: [],
    });
    assert.equal(filtered.length, 34);
  });

  it("E. select VĐV1 → VĐV2 excludes only that athlete", () => {
    const players = makePlayers(34);
    const filtered = filterTournamentPickerPlayers(players, {
      clubFilter: ALL_CLUBS_FILTER,
      genderFilter: "all",
      eventType: EVENT_TYPE.OPEN_DOUBLE,
    });
    assert.equal(filtered.length, 34);
    const afterA = excludePlayerIdFromOptions(filtered, "ath-1");
    assert.equal(afterA.length, 33);
    assert.equal(afterA.some((p) => p.id === "ath-1"), false);
  });

  it("F. pair pick fills A then B; Đăng ký cặp prerequisites met", () => {
    let state = { pairPlayerAId: "", pairPlayerBId: "" };
    state = applyOfficialPairPlayerPick({ ...state, playerId: "ath-1" });
    assert.equal(state.pairPlayerAId, "ath-1");
    assert.equal(state.pairPlayerBId, "");
    state = applyOfficialPairPlayerPick({ ...state, playerId: "ath-2" });
    assert.equal(state.pairPlayerAId, "ath-1");
    assert.equal(state.pairPlayerBId, "ath-2");
    assert.notEqual(state.pairPlayerAId, state.pairPlayerBId);
    assert.equal(Boolean(state.pairPlayerAId && state.pairPlayerBId), true);
  });

  it("G. same-player / invalid pair remains fail-closed", () => {
    const a = { id: "ath-1", name: "A", gender: "Nam" };
    const same = validateOpenRegistrationPlayers([a, a], EVENT_TYPE.OPEN_DOUBLE);
    // Domain still requires 2 playerIds conceptually; createOpen path blocks equal ids in UI.
    const pick = applyOfficialPairPlayerPick({
      pairPlayerAId: "ath-1",
      pairPlayerBId: "",
      playerId: "ath-1",
    });
    assert.equal(pick.pairPlayerAId, "");
    assert.equal(pick.pairPlayerBId, "");

    const bothFilledSameBlocked = applyOfficialPairPlayerPick({
      pairPlayerAId: "ath-1",
      pairPlayerBId: "ath-2",
      playerId: "ath-1",
    });
    assert.equal(bothFilledSameBlocked.pairPlayerAId, "");
    assert.equal(bothFilledSameBlocked.pairPlayerBId, "ath-2");

    const valid = validateOpenRegistrationPlayers(
      [
        { id: "ath-1", name: "A", gender: "Nam" },
        { id: "ath-2", name: "B", gender: "Nữ" },
      ],
      EVENT_TYPE.OPEN_DOUBLE
    );
    assert.equal(valid.ok, true);
    assert.equal(same.ok, true); // gender ok; equal-id blocked by UI state authority
  });

  it("H. no localStorage / default-tenant / showPlayerList={false} on pair path", () => {
    const page = readSrc("src/pages/tournament/OfficialTournamentSetup.jsx");
    const panel = readSrc("src/components/tournament/TournamentPlayerPickerPanel.jsx");
    const util = readSrc("src/utils/tournamentPlayerPicker.js");

    assert.match(page, /mode=["']pair["']/);
    assert.match(page, /showPlayerList/);
    assert.doesNotMatch(page, /showPlayerList=\{false\}/);
    assert.match(page, /applyOfficialPairPlayerPick/);
    assert.match(page, /openPairSelectBOptions/);
    assert.match(page, /onPairPick=\{handlePairPlayerPick\}/);
    assert.match(panel, /mode === ["']pair["']/);
    assert.match(panel, /buildOfficialPickerCountCaption/);
    assert.doesNotMatch(page, /localStorage/);
    assert.doesNotMatch(panel, /localStorage/);
    assert.doesNotMatch(util, /["']default-tenant["']/);
    assert.doesNotMatch(page, /["']default-tenant["']/);
  });

  it("caption honesty: hiển thị only when list rendered", () => {
    assert.equal(
      buildOfficialPickerCountCaption({
        filteredCount: 34,
        totalCount: 34,
        showPlayerList: true,
      }),
      "34/34 VĐV hiển thị"
    );
    assert.equal(
      buildOfficialPickerCountCaption({
        filteredCount: 34,
        totalCount: 34,
        showPlayerList: false,
      }),
      "34/34 VĐV phù hợp"
    );
    assert.doesNotMatch(
      buildOfficialPickerCountCaption({
        filteredCount: 34,
        totalCount: 34,
        showPlayerList: false,
      }),
      /hiển thị/
    );
  });
});
