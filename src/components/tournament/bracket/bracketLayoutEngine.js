export const BRACKET_LAYOUT = {
  CARD_WIDTH: 252,
  CARD_HEIGHT: 132,
  COLUMN_GAP: 64,
  ROUND_HEADER: 36,
  LEAF_STEP: 28,
};

function parseWinnerSeed(seed) {
  const text = String(seed || "");
  const match = text.match(/^W\((.+)\)$/);
  return match?.[1] || null;
}

function getMatchCenterY(roundIndex, matchIndex) {
  const span = 2 ** roundIndex * (BRACKET_LAYOUT.CARD_HEIGHT + BRACKET_LAYOUT.LEAF_STEP);
  return BRACKET_LAYOUT.ROUND_HEADER + matchIndex * span * 2 + span / 2;
}

export function buildBracketTreeLayout(rounds = []) {
  if (!rounds.length) {
    return {
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
      championSlot: null,
    };
  }

  const firstCount = rounds[0].matches.length;
  const span0 = BRACKET_LAYOUT.CARD_HEIGHT + BRACKET_LAYOUT.LEAF_STEP;
  const totalHeight =
    BRACKET_LAYOUT.ROUND_HEADER +
    firstCount * span0 * 2 -
    span0 +
    BRACKET_LAYOUT.CARD_HEIGHT;

  const nodes = [];

  rounds.forEach((round, roundIndex) => {
    const columnX = roundIndex * (BRACKET_LAYOUT.CARD_WIDTH + BRACKET_LAYOUT.COLUMN_GAP);

    round.matches.forEach((match, matchIndex) => {
      const centerY = getMatchCenterY(roundIndex, matchIndex);
      const top = centerY - BRACKET_LAYOUT.CARD_HEIGHT / 2;

      nodes.push({
        id: match.id,
        match,
        roundIndex,
        matchIndex,
        roundKey: round.key,
        x: columnX,
        y: top,
        width: BRACKET_LAYOUT.CARD_WIDTH,
        height: BRACKET_LAYOUT.CARD_HEIGHT,
        centerX: columnX + BRACKET_LAYOUT.CARD_WIDTH / 2,
        centerY,
        rightX: columnX + BRACKET_LAYOUT.CARD_WIDTH,
        leftX: columnX,
      });
    });
  });

  const edges = [];

  for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex += 1) {
    const nextRound = rounds[roundIndex + 1];

    nextRound.matches.forEach((childMatch) => {
      const childNode = nodes.find((node) => node.id === childMatch.id);
      if (!childNode) {
        return;
      }

      const feederIds = [
        parseWinnerSeed(childMatch.homeSeed),
        parseWinnerSeed(childMatch.awaySeed),
      ].filter(Boolean);

      feederIds.forEach((feederId) => {
        const parentNode = nodes.find((node) => node.id === feederId);
        if (!parentNode) {
          return;
        }

        const midX = parentNode.rightX + BRACKET_LAYOUT.COLUMN_GAP / 2;
        const active = Boolean(parentNode.match.completed && parentNode.match.winner);

        edges.push({
          id: `${feederId}->${childMatch.id}`,
          fromId: feederId,
          toId: childMatch.id,
          path: `M ${parentNode.rightX} ${parentNode.centerY} H ${midX} V ${childNode.centerY} H ${childNode.leftX}`,
          active,
          dashed: Boolean(childMatch.isThirdPlace),
        });
      });
    });
  }

  const finalNode = nodes.find(
    (node) => node.roundIndex === rounds.length - 1 && node.matchIndex === 0
  );

  const championX =
    rounds.length * (BRACKET_LAYOUT.CARD_WIDTH + BRACKET_LAYOUT.COLUMN_GAP) + 12;

  const championSlot = {
    x: championX,
    y: finalNode ? finalNode.y : BRACKET_LAYOUT.ROUND_HEADER,
    width: BRACKET_LAYOUT.CARD_WIDTH,
    height: BRACKET_LAYOUT.CARD_HEIGHT + 24,
    centerY: finalNode?.centerY || totalHeight / 2,
  };

  if (finalNode) {
    const midX = finalNode.rightX + BRACKET_LAYOUT.COLUMN_GAP / 2;
    edges.push({
      id: `${finalNode.id}->champion`,
      fromId: finalNode.id,
      toId: "champion",
      path: `M ${finalNode.rightX} ${finalNode.centerY} H ${midX} V ${championSlot.centerY} H ${championSlot.x}`,
      active: Boolean(finalNode.match.completed && finalNode.match.winner),
      dashed: false,
    });
  }

  return {
    nodes,
    edges,
    width: championSlot.x + BRACKET_LAYOUT.CARD_WIDTH + 48,
    height: Math.max(totalHeight + 24, championSlot.y + championSlot.height + 24),
    championSlot,
    finalNodeId: finalNode?.id || null,
  };
}

export function getColumnScrollLeft(roundIndex) {
  return roundIndex * (BRACKET_LAYOUT.CARD_WIDTH + BRACKET_LAYOUT.COLUMN_GAP);
}
