export function collectIds(items = []) {
  return items.map((item) => item.id);
}

export function toggleSelectionByChecked(currentIds = [], id, checked) {
  if (checked) {
    if (currentIds.includes(id)) {
      return currentIds;
    }

    return [...currentIds, id];
  }

  return currentIds.filter((item) => item !== id);
}

export function buildAutoCourtSelection({
  selectedPlayersCount,
  maxPlayers,
  activeCourts = [],
  requiredCourts,
}) {
  if (selectedPlayersCount > maxPlayers) {
    return collectIds(activeCourts);
  }

  return collectIds(activeCourts.slice(0, requiredCourts));
}
