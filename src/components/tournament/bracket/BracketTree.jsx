import { useMemo } from "react";
import { Box, Typography } from "@mui/material";

import BracketConnector from "./BracketConnector.jsx";
import BracketMatchCard from "./BracketMatchCard.jsx";
import BracketMobileTimeline from "./BracketMobileTimeline.jsx";
import ChampionCard from "./ChampionCard.jsx";
import ThirdPlaceCard from "./ThirdPlaceCard.jsx";
import { BRACKET_LAYOUT, buildBracketTreeLayout } from "./bracketLayoutEngine.js";

export default function BracketTree({
  viewModel,
  isRoundVisible,
  isMatchVisible,
  activeRoundKey = "",
  onRoundRef,
  connectorReveal = 1,
  onViewSummary,
  treeScrollRef,
}) {
  const { rounds = [], champion, thirdPlace, thirdPlaceTeam } = viewModel || {};

  const layout = useMemo(() => buildBracketTreeLayout(rounds), [rounds]);

  if (!rounds.length) {
    return (
      <Box className="tournament-bracket-tree tournament-bracket-tree--empty">
        Chưa có sơ đồ thi đấu. Tạo bracket từ BXH vòng bảng trước.
      </Box>
    );
  }

  const hasChampion = Boolean(champion?.name);
  const finalCompleted = rounds[rounds.length - 1]?.matches?.[0]?.completed;

  return (
    <Box className="tournament-bracket-tree">
      <Box
        className="tournament-bracket-tree__scroll tournament-bracket-tree__scroll--desktop"
        ref={treeScrollRef}
      >
        <Box
          className="tournament-bracket-tree__canvas"
          style={{ width: layout.width, height: layout.height }}
        >
          <BracketConnector
            edges={layout.edges}
            width={layout.width}
            height={layout.height}
            revealProgress={connectorReveal}
          />

          {rounds.map((round, roundIndex) => (
            <Box
              key={round.key}
              className={`tournament-bracket-tree__round-label${
                isRoundVisible(roundIndex) ? " tournament-bracket-tree__round-label--visible" : ""
              }${round.key === activeRoundKey ? " tournament-bracket-tree__round-label--active" : ""}`}
              style={{
                left: roundIndex * (BRACKET_LAYOUT.CARD_WIDTH + BRACKET_LAYOUT.COLUMN_GAP),
                width: BRACKET_LAYOUT.CARD_WIDTH,
              }}
              ref={(node) => onRoundRef?.(round.key, node)}
            >
              <Typography variant="subtitle2" fontWeight={800}>
                {round.displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {round.matches.length} trận
              </Typography>
            </Box>
          ))}

          {layout.nodes.map((node) => (
            <BracketMatchCard
              key={node.id}
              match={node.match}
              visible={isMatchVisible(node.roundIndex, node.matchIndex)}
              highlighted={node.roundKey === activeRoundKey}
              style={{
                position: "absolute",
                left: node.x,
                top: node.y,
                width: node.width,
                minHeight: node.height,
              }}
            />
          ))}

          {layout.championSlot ? (
            <ChampionCard
              champion={champion}
              revealed={isRoundVisible(rounds.length - 1) || connectorReveal >= 1}
              celebrate={hasChampion && finalCompleted}
              onViewSummary={onViewSummary}
              style={{
                position: "absolute",
                left: layout.championSlot.x,
                top: layout.championSlot.y,
                width: layout.championSlot.width,
              }}
            />
          ) : null}

          {thirdPlace || thirdPlaceTeam ? (
            <Box
              className="tournament-bracket-tree__third-place"
              style={{
                position: "absolute",
                left: layout.championSlot?.x || 0,
                top: (layout.championSlot?.y || 0) + layout.championSlot.height + 20,
                width: BRACKET_LAYOUT.CARD_WIDTH,
              }}
            >
              <ThirdPlaceCard match={thirdPlace} team={thirdPlaceTeam} />
            </Box>
          ) : null}
        </Box>
      </Box>

      <BracketMobileTimeline
        viewModel={viewModel}
        activeRoundKey={activeRoundKey}
        isMatchVisible={isMatchVisible}
        isRoundVisible={isRoundVisible}
        connectorReveal={connectorReveal}
        onViewSummary={onViewSummary}
      />
    </Box>
  );
}
