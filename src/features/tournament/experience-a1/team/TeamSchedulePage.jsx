import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import BuildScheduleDialog from "../../../../components/tournament/team/BuildScheduleDialog.jsx";
import { TEAM_TAB_QUERY } from "../../../../config/tournamentRoutes.js";
import {
  COMPETITION_CLASS,
  prepareLivePrivatePairingOptions,
} from "../../../private-pairing-rules/index.js";
import {
  assertGroupsReadyForSchedule,
} from "../../../team-tournament/engines/teamRoundRobinScheduleEngine.js";
import { buildRoundRobinMatchups } from "../../../team-tournament/engines/teamTournamentEngine.js";
import { createTeamExperienceCommandDelegate } from "./TeamTournamentExperienceAdapter.js";
import { TEAM_EXPERIENCE_COMMANDS } from "./projectTeamExperienceSurfaces.js";
import { teamTournamentLegacyPath } from "./teamExperienceRoutes.js";
import { TeamExperiencePageFrame } from "./TeamExperiencePageFrame.jsx";
import { useTeamExperienceSetup } from "./useTeamExperienceSetup.js";
import {
  TOURNAMENT_COLOR,
  TOURNAMENT_RADIUS,
  outlinedActionSx,
  primaryActionSx,
} from "../visual/tournamentExperienceTokens.js";

function formatWhen(value) {
  if (!value) return "Chưa xếp giờ";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Date(parsed).toLocaleString("vi-VN");
}

export default function TeamSchedulePage() {
  const setup = useTeamExperienceSetup();
  const projection = setup.scheduleProjection;
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleBuildScheduleConfirm(options) {
    if (!setup.access.canManage) return;
    const td = setup.teamData;
    if ((td.teams || []).length < 2) {
      setup.setError("Cần ít nhất 2 đội.");
      return;
    }
    if ((td.disciplines || []).length === 0) {
      setup.setError("Cần ít nhất 1 nội dung thi đấu.");
      return;
    }
    const groupReady = assertGroupsReadyForSchedule(td);
    if (!groupReady.ok) {
      setup.setError(groupReady.error);
      setScheduleDialogOpen(false);
      return;
    }

    setBusy(true);
    try {
      const prepared = await prepareLivePrivatePairingOptions({
        tournament: setup.tournament || null,
        clubId: setup.effectiveClubId || null,
        clubFromQuery: setup.clubFromQuery,
        activeClubId: setup.activeClubId,
        tournamentId: setup.tournamentId || null,
        tenantId: setup.tenantId || null,
        eventId: setup.tournamentId ? `event-${setup.tournamentId}` : null,
        competitionClass: COMPETITION_CLASS.INTERNAL,
      });
      if (!prepared.ok) {
        setup.setError(prepared.error?.message || "Không tạo được lịch theo quy tắc riêng.");
        return;
      }

      const scheduleOptions = {
        ...options,
        ...prepared.pairingOptions,
        privatePairingRules: prepared.pairingOptions?.privatePairingRules || [],
        competitionClass: COMPETITION_CLASS.INTERNAL,
        clubId: setup.effectiveClubId || null,
        tournamentId: setup.tournamentId || null,
        selectedCourtIds: td?.settings?.selectedCourtIds || options.selectedCourtIds || [],
      };

      const next = buildRoundRobinMatchups(td, scheduleOptions);
      if (next?.ok === false || next?.privatePairingError) {
        setup.setError(
          next.privatePairingError?.message ||
            next.error ||
            "Không tạo được lịch / trận đối đầu."
        );
        return;
      }

      const beforeGroupCount = (td.groups || []).length;
      const afterGroupCount = (next.groups || []).length;
      if (beforeGroupCount === 0 && afterGroupCount > 0) {
        setup.setError("Tạo lịch không được tự chia bảng. Hãy chia bảng tường minh trước.");
        return;
      }

      const delegate = createTeamExperienceCommandDelegate({
        [TEAM_EXPERIENCE_COMMANDS.PERSIST_SETUP_TEAM_DATA]: (payload) =>
          setup.persistSetupTeamData(payload.next, payload.options),
      });
      const result = await delegate.execute(TEAM_EXPERIENCE_COMMANDS.PERSIST_SETUP_TEAM_DATA, {
        next,
        options: {
          confirmDestructive: (td.matchups || []).length > 0,
          rulesVersion: prepared.rulesVersion || prepared.pairingOptions?.rulesVersion || "",
          reason: "experience-schedule-build",
        },
      });
      if (!result?.ok) {
        setup.setError(result?.error || "Không lưu được lịch.");
        return;
      }
      setup.setError("");
      setup.setMessage("Đã tạo / cập nhật lịch đối đầu.");
      setScheduleDialogOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeamExperiencePageFrame
      tournamentId={setup.tournamentId}
      title="Lịch đối đầu"
      subtitle="Team-vs-Team matchup · không tái tạo khi F5"
      activeKey="schedule"
      loading={setup.loading}
      loadError={setup.loadError}
      message={setup.message}
      error={setup.error}
      primaryAction={
        <Stack direction="row" spacing={0.75}>
          {setup.access.canManage ? (
            <Button
              size="small"
              variant="contained"
              sx={primaryActionSx}
              disabled={busy}
              onClick={() => setScheduleDialogOpen(true)}
            >
              Tạo lịch vòng tròn
            </Button>
          ) : null}
          <Button
            component={RouterLink}
            to={teamTournamentLegacyPath(setup.tournamentId, TEAM_TAB_QUERY.matchups)}
            size="small"
            sx={outlinedActionSx}
          >
            Vận hành chi tiết
          </Button>
        </Stack>
      }
    >
      {projection ? (
        <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1.5, flexWrap: "wrap" }}>
          <Chip size="small" label={`${projection.matchupCount} trận đồng đội`} />
          {projection.publishStatus ? (
            <Chip size="small" label={`Publish: ${projection.publishStatus}`} />
          ) : null}
        </Stack>
      ) : null}

      <Alert severity="info" sx={{ mb: 1.5 }}>
        Màn này đọc matchup hiện có — không tạo lại lịch khi tải trang / F5. Lineup, Dreambreaker,
        trọng tài giữ ở luồng vận hành chi tiết.
      </Alert>

      {!projection?.matchups?.length ? (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: `1px dashed ${TOURNAMENT_COLOR.divider}`,
            borderRadius: `${TOURNAMENT_RADIUS.card}px`,
          }}
        >
          <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
            Chưa có trận đối đầu trên hồ sơ giải.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {projection.matchups.map((row) => (
            <Paper
              key={row.id}
              elevation={0}
              data-matchup-id={row.id}
              sx={{
                p: 1.25,
                border: `1px solid ${TOURNAMENT_COLOR.divider}`,
                borderRadius: `${TOURNAMENT_RADIUS.card}px`,
                minWidth: 0,
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
              >
                <div style={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                    {row.teamAName} vs {row.teamBName}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                    {[row.stage, row.groupLabel, row.roundNumber != null ? `Vòng ${row.roundNumber}` : null]
                      .filter(Boolean)
                      .join(" · ") || "Trận đồng đội"}
                    {" · "}
                    {row.subMatchCount} submatch
                  </Typography>
                </div>
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <Chip size="small" label={row.status} />
                  <Chip size="small" variant="outlined" label={formatWhen(row.scheduledAt)} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={row.courtLabel || row.courtId || "Chưa gán sân"}
                  />
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <BuildScheduleDialog
        open={scheduleDialogOpen}
        onClose={() => !busy && setScheduleDialogOpen(false)}
        onConfirm={handleBuildScheduleConfirm}
        teamData={setup.teamData}
        hasExistingResults={(setup.teamData?.matchups || []).some((m) =>
          (m.subMatches || []).some((sm) => sm?.result || sm?.score)
        )}
      />
    </TeamExperiencePageFrame>
  );
}
