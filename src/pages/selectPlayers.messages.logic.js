export function getRequiredCourtsMessage({
  selectedPlayersCount,
  maxPlayers,
  requiredCourts,
}) {
  if (selectedPlayersCount <= 0 || selectedPlayersCount > maxPlayers) {
    return null;
  }

  return `Cần tối thiểu ${requiredCourts} sân cho ${selectedPlayersCount} người.`;
}

export function getOverCapacityMessage({
  selectedPlayersCount,
  maxPlayers,
  waitingPotential,
}) {
  if (selectedPlayersCount <= maxPlayers) {
    return null;
  }

  return `Số người vượt quá sức chứa tối đa. Chỉ có thể xếp tối đa ${maxPlayers} người, còn ${waitingPotential} người sẽ chờ.`;
}

export function getCapacityStatusMessage({
  activeCourtsCount,
  maxPlayers,
  selectedPlayersCount,
  waitingPotential,
  playersPerCourt = 4,
}) {
  const base = `Sức chứa hiện tại: ${activeCourtsCount} sân × ${playersPerCourt} = ${maxPlayers} người.`;

  if (waitingPotential > 0) {
    return {
      text: `${base} Nếu giữ ${selectedPlayersCount} người thì sẽ có ${waitingPotential} người chờ.`,
      color: "error.main",
    };
  }

  return {
    text: `${base} Đủ sân cho tất cả người chơi hiện tại.`,
    color: "text.secondary",
  };
}

export function getSelectedCourtsWarningMessage({
  hasEnoughSelectedCourts,
  selectedPlayersCount,
  maxPlayers,
  selectedCourtCount,
  requiredCourts,
}) {
  if (hasEnoughSelectedCourts || selectedPlayersCount <= 0) {
    return null;
  }

  if (selectedPlayersCount > maxPlayers) {
    return `Số người vượt quá sức chứa tối đa ${maxPlayers}. Chọn thêm sân để giảm người chờ hoặc điều chỉnh số người chơi.`;
  }

  return `Hiện đang chọn ${selectedCourtCount} sân, nhưng cần ít nhất ${requiredCourts} sân để phục vụ ${selectedPlayersCount} người. Vui lòng chọn thêm sân hoặc bấm "Chọn đủ ${requiredCourts} sân".`;
}

export function getStartReadinessMessage({
  selectedPlayersCount,
  selectedCourtCount,
  maxPlayers,
  requiredCourts,
  minPlayers = 4,
}) {
  if (selectedPlayersCount < minPlayers) {
    return `Chọn ít nhất ${minPlayers} người để bắt đầu xếp sân.`;
  }

  if (selectedCourtCount === 0) {
    return "Chọn tối thiểu 1 sân để bắt đầu xếp.";
  }

  if (selectedPlayersCount <= maxPlayers && selectedCourtCount < requiredCourts) {
    return `Cần chọn thêm ${requiredCourts - selectedCourtCount} sân để phục vụ ${selectedPlayersCount} người.`;
  }

  return "Sẵn sàng xếp sân.";
}
