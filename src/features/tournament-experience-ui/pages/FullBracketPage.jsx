import { useState } from "react";
import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import {
  BracketColumn,
  BracketMatchNode,
  CompetitionContextHeader,
  StageSelector,
} from "../components/competitionSurfaces.jsx";
import { TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "../design/tournamentDesignTokens.js";
import { displayBracketRoundLabel } from "../copy/uiDisplayLabels.js";
import { FIXTURE_CHAMPION_NODE, FIXTURE_KO_MATCHES, FIXTURE_KO_ROUNDS } from "../fixtures/opsFixture.js";
import { getFixtureTournament } from "../fixtures/prototypeFixture.js";

export default function FullBracketPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const tournament = getFixtureTournament();
  const [round, setRound] = useState("QF");
  const mobileMatches = FIXTURE_KO_MATCHES[round] || [];
  const nextRound = FIXTURE_KO_ROUNDS[FIXTURE_KO_ROUNDS.indexOf(round) + 1] || "Champion";
  const nextMatches = nextRound === "Champion" ? [FIXTURE_CHAMPION_NODE] : (FIXTURE_KO_MATCHES[nextRound] || []);

  return (
    <TournamentExperienceShell title="Sơ đồ nhánh đấu" subtitle="Thắng X → vào Y. Trang không tràn ngang." showEventContext>
      <CompetitionContextHeader tournament={tournament.name} event="Đôi nam 3.5" stage="Vòng loại trực tiếp • Sơ đồ nhánh đấu" />
      {isMobile ? (
        <>
          <StageSelector
            value={round}
            onChange={setRound}
            items={FIXTURE_KO_ROUNDS.map((id) => ({ id, label: displayBracketRoundLabel(id) }))}
          />
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>
            Điều hướng theo vòng. Thắng {displayBracketRoundLabel(round)} → {displayBracketRoundLabel(nextRound)}.
          </Typography>
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              overflowX: "auto",
              maxWidth: "100%",
              pb: 1,
              scrollSnapType: "x mandatory",
            }}
          >
            <Box sx={{ minWidth: "86%", scrollSnapAlign: "start" }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>{displayBracketRoundLabel(round)}</Typography>
              <Stack spacing={1}>
                {mobileMatches.map((match) => (
                  <BracketMatchNode key={match.id} match={match} />
                ))}
              </Stack>
            </Box>
            <Box sx={{ minWidth: "70%", scrollSnapAlign: "start" }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>{displayBracketRoundLabel(nextRound)}</Typography>
              <Stack spacing={1}>
                {nextMatches.map((match) => (
                  <BracketMatchNode key={match.id} match={match} champion={nextRound === "Champion"} />
                ))}
              </Stack>
            </Box>
          </Box>
        </>
      ) : (
        <Box
          sx={{
            overflowX: "auto",
            maxWidth: "100%",
            pb: 1,
            border: `1px solid ${TOURNAMENT_COLOR.divider}`,
            borderRadius: `${TOURNAMENT_RADIUS.card}px`,
            bgcolor: TOURNAMENT_COLOR.pageBg,
          }}
        >
          <Box sx={{ display: "flex", gap: 0.5, p: 1.5, minWidth: 1180, alignItems: "stretch" }}>
            {FIXTURE_KO_ROUNDS.map((id, index) => (
              <BracketColumn
                key={id}
                title={id}
                matches={FIXTURE_KO_MATCHES[id] || []}
                showConnectors={index < FIXTURE_KO_ROUNDS.length - 1}
              />
            ))}
            <BracketColumn title="Champion" matches={[FIXTURE_CHAMPION_NODE]} showConnectors={false} />
          </Box>
        </Box>
      )}
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 1 }}>
        Đang thi đấu = đỏ • Hoàn tất = xanh • Sắp tới = trung tính • Ô vô địch tách biệt.
      </Typography>
    </TournamentExperienceShell>
  );
}
