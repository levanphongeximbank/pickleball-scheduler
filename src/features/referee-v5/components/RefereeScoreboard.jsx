export default function RefereeScoreboard({ visualState }) {
  const teamAName = visualState.players.find((p) => p.teamSide === "teamA")?.teamName || "Đội A";
  const teamBName = visualState.players.find((p) => p.teamSide === "teamB")?.teamName || "Đội B";
  const servingTeamKey = visualState.servingTeamSide || "teamA";

  return (
    <section className="rv5-scoreboard" aria-label="Tỷ số" data-testid="referee-scoreboard">
      <div
        className={`rv5-scoreboard-team ${servingTeamKey === "teamA" ? "is-serving" : ""}`}
        aria-label={`${teamAName} ${visualState.scoreA} điểm`}
      >
        <div className="rv5-scoreboard-label">{teamAName}</div>
        <div className="rv5-scoreboard-score" data-testid="score-team-a">
          {visualState.scoreA}
        </div>
      </div>
      <div
        className={`rv5-scoreboard-team ${servingTeamKey === "teamB" ? "is-serving" : ""}`}
        aria-label={`${teamBName} ${visualState.scoreB} điểm`}
      >
        <div className="rv5-scoreboard-label">{teamBName}</div>
        <div className="rv5-scoreboard-score" data-testid="score-team-b">
          {visualState.scoreB}
        </div>
      </div>
      {visualState.isDoubles ? (
        <div className="rv5-scoreboard-sideout" data-testid="side-out-line">
          {visualState.sideOutLine} · Đội giao: {visualState.servingTeamName}
        </div>
      ) : (
        <div className="rv5-scoreboard-sideout" data-testid="side-out-line">
          Đội giao: {visualState.servingTeamName}
        </div>
      )}
    </section>
  );
}
