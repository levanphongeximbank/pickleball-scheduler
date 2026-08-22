import { useMemo } from "react";
import { Alert, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import BracketView from "../BracketView.jsx";
import { buildOfficialAllGroupStandings } from "../../../features/individual-tournament/engines/officialStandingsEngine.js";
import { resolveBracketProgress } from "../../../tournament/engines/index.js";
import OfficialTournamentCloseOps from "./OfficialTournamentCloseOps.jsx";
import { resolveOfficialMatchScoringRules } from "../../../features/individual-tournament/engines/officialScoringRulesResolver.js";

/**
 * Knockout round operations workspace (reusable per derived round).
 */
export function OfficialTournamentKnockoutRoundScreen({
  tournament,
  event,
  roundName,
  canManage = true,
  onSubmitKnockoutScore,
  onToggleRoundLock,
  draftScope,
  tournamentId,
}) {
  const progress = useMemo(() => (event ? resolveBracketProgress(event) : null), [event]);
  const rule = resolveOfficialMatchScoringRules(tournament, { roundName });

  if (!event?.bracket) {
    return <Alert severity="info">Chưa có bracket knockout.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip color="primary" label={roundName || "Knockout"} />
        <Chip label={rule.summaryLabel} />
      </Stack>
      <BracketView
        progress={progress}
        unlockedRounds={event?.bracket?.unlockedRounds || {}}
        onSubmitScore={canManage ? onSubmitKnockoutScore : undefined}
        onToggleRoundLock={canManage ? onToggleRoundLock : undefined}
        draftScope={draftScope}
      />
      <Button
        component={RouterLink}
        to={`/tournament/official/${tournamentId}/bracket`}
        variant="outlined"
        size="small"
      >
        Mở sơ đồ đầy đủ
      </Button>
    </Stack>
  );
}

/**
 * Results / standings / close summary.
 */
export default function OfficialTournamentResultsScreen({
  tournament,
  event,
  tournamentId,
  canManage = true,
  onPersistClose,
  onMessage,
  onError,
  onGenerateBracket,
  onSubmitKnockoutScore,
  onToggleRoundLock,
  draftScope,
  groupStandings: groupStandingsProp,
}) {
  const standings = useMemo(
    () =>
      groupStandingsProp ||
      (event ? buildOfficialAllGroupStandings(event) : []),
    [groupStandingsProp, event]
  );
  const progress = useMemo(() => (event ? resolveBracketProgress(event) : null), [event]);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" fontWeight={700}>
        Bảng xếp hạng vòng bảng
      </Typography>
      {!standings?.length ? (
        <Alert severity="info">Chưa có kết quả vòng bảng.</Alert>
      ) : (
        <Grid container spacing={1.5}>
          {(Array.isArray(standings) ? standings : []).map((groupStanding) => (
            <Grid
              key={groupStanding.group || groupStanding.groupId || groupStanding.label}
              size={{ xs: 12, md: 6 }}
            >
              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography fontWeight={700} sx={{ mb: 0.75 }}>
                  Bảng {groupStanding.group || groupStanding.label}
                </Typography>
                <Stack spacing={0.5}>
                  {(groupStanding.standing || groupStanding.standings || groupStanding.rows || [])
                    .slice(0, 8)
                    .map((team, index) => (
                      <Typography key={team.id || team.entryId || index} variant="body2">
                        {index + 1}. {team.name || team.entryName} — {team.matchPoints ?? team.points ?? 0} điểm
                      </Typography>
                    ))}
                </Stack>
                {groupStanding.qualificationTieUnresolved ? (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Hòa chỉ số thể thao tại ranh giới suất — QUALIFICATION_TIE_UNRESOLVED.
                  </Alert>
                ) : null}
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Typography variant="subtitle1" fontWeight={700}>
        Knockout / Chung kết
      </Typography>
      {!event?.bracket?.rounds?.length ? (
        <Button variant="contained" disabled={!canManage} onClick={onGenerateBracket}>
          Tạo bracket từ BXH
        </Button>
      ) : (
        <>
          <BracketView
            progress={progress}
            unlockedRounds={event?.bracket?.unlockedRounds || {}}
            onSubmitScore={canManage ? onSubmitKnockoutScore : undefined}
            onToggleRoundLock={canManage ? onToggleRoundLock : undefined}
            draftScope={draftScope}
          />
          {tournamentId ? (
            <Button
              component={RouterLink}
              to={`/tournament/official/${tournamentId}/bracket`}
              variant="outlined"
              size="small"
            >
              Mở sơ đồ đầy đủ
            </Button>
          ) : null}
        </>
      )}

      <OfficialTournamentCloseOps
        tournament={tournament}
        eventId={event?.id || ""}
        canManage={canManage}
        onPersistTournament={onPersistClose}
        onMessage={onMessage}
        onError={onError}
      />
    </Stack>
  );
}
