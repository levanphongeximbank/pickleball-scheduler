export function shouldShowDirectorBlockingLoad({
  tournament,
  tournamentLoading,
  accessPending,
  isDaily,
  dailyState,
  dailyLoading,
} = {}) {
  const hasUsableSnapshot = Boolean(tournament) || Boolean(isDaily && dailyState);
  if (hasUsableSnapshot) {
    return false;
  }
  return Boolean(
    tournamentLoading || accessPending || (isDaily && dailyLoading)
  );
}
