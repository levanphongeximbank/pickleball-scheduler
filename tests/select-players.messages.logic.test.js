import test from "node:test";
import assert from "node:assert/strict";

import {
  getCapacityStatusMessage,
  getOverCapacityMessage,
  getRequiredCourtsMessage,
  getSelectedCourtsWarningMessage,
  getStartReadinessMessage,
} from "../src/pages/selectPlayers.messages.logic.js";

test("getRequiredCourtsMessage returns message only when players are within capacity", () => {
  assert.equal(
    getRequiredCourtsMessage({
      selectedPlayersCount: 8,
      maxPlayers: 12,
      requiredCourts: 2,
    }),
    "Cần tối thiểu 2 sân cho 8 người.",
  );

  assert.equal(
    getRequiredCourtsMessage({
      selectedPlayersCount: 0,
      maxPlayers: 12,
      requiredCourts: 0,
    }),
    null,
  );

  assert.equal(
    getRequiredCourtsMessage({
      selectedPlayersCount: 13,
      maxPlayers: 12,
      requiredCourts: 4,
    }),
    null,
  );
});

test("getOverCapacityMessage returns warning when selected players exceed capacity", () => {
  assert.match(
    getOverCapacityMessage({
      selectedPlayersCount: 18,
      maxPlayers: 16,
      waitingPotential: 2,
    }),
    /còn 2 người sẽ chờ/,
  );

  assert.equal(
    getOverCapacityMessage({
      selectedPlayersCount: 16,
      maxPlayers: 16,
      waitingPotential: 0,
    }),
    null,
  );
});

test("getCapacityStatusMessage returns text and color for waiting and non-waiting states", () => {
  const withWaiting = getCapacityStatusMessage({
    activeCourtsCount: 3,
    maxPlayers: 12,
    selectedPlayersCount: 14,
    waitingPotential: 2,
  });
  assert.equal(withWaiting.color, "error.main");
  assert.match(withWaiting.text, /14 người/);

  const noWaiting = getCapacityStatusMessage({
    activeCourtsCount: 3,
    maxPlayers: 12,
    selectedPlayersCount: 8,
    waitingPotential: 0,
  });
  assert.equal(noWaiting.color, "text.secondary");
  assert.match(noWaiting.text, /Đủ sân/);
});

test("getSelectedCourtsWarningMessage handles both over-capacity and missing-court cases", () => {
  assert.match(
    getSelectedCourtsWarningMessage({
      hasEnoughSelectedCourts: false,
      selectedPlayersCount: 18,
      maxPlayers: 16,
      selectedCourtCount: 3,
      requiredCourts: 4,
    }),
    /vượt quá sức chứa tối đa 16/,
  );

  assert.match(
    getSelectedCourtsWarningMessage({
      hasEnoughSelectedCourts: false,
      selectedPlayersCount: 10,
      maxPlayers: 16,
      selectedCourtCount: 2,
      requiredCourts: 3,
    }),
    /cần ít nhất 3 sân/,
  );

  assert.equal(
    getSelectedCourtsWarningMessage({
      hasEnoughSelectedCourts: true,
      selectedPlayersCount: 10,
      maxPlayers: 16,
      selectedCourtCount: 3,
      requiredCourts: 3,
    }),
    null,
  );
});

test("getStartReadinessMessage returns correct step-by-step guidance", () => {
  assert.equal(
    getStartReadinessMessage({
      selectedPlayersCount: 2,
      selectedCourtCount: 1,
      maxPlayers: 16,
      requiredCourts: 1,
    }),
    "Chọn ít nhất 4 người để bắt đầu xếp sân.",
  );

  assert.equal(
    getStartReadinessMessage({
      selectedPlayersCount: 8,
      selectedCourtCount: 0,
      maxPlayers: 16,
      requiredCourts: 2,
    }),
    "Chọn tối thiểu 1 sân để bắt đầu xếp.",
  );

  assert.equal(
    getStartReadinessMessage({
      selectedPlayersCount: 8,
      selectedCourtCount: 1,
      maxPlayers: 16,
      requiredCourts: 2,
    }),
    "Cần chọn thêm 1 sân để phục vụ 8 người.",
  );

  assert.equal(
    getStartReadinessMessage({
      selectedPlayersCount: 8,
      selectedCourtCount: 2,
      maxPlayers: 16,
      requiredCourts: 2,
    }),
    "Sẵn sàng xếp sân.",
  );
});
