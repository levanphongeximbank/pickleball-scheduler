import { useRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";

import TeamFormatVenueSetupPanel from "../../../../components/tournament/team/TeamFormatVenueSetupPanel.jsx";
import { TEAM_TAB_QUERY } from "../../../../config/tournamentRoutes.js";
import { teamTournamentLegacyPath } from "./teamExperienceRoutes.js";
import { createTeamExperienceCommandDelegate } from "./TeamTournamentExperienceAdapter.js";
import { TEAM_EXPERIENCE_COMMANDS } from "./projectTeamExperienceSurfaces.js";
import { TeamExperiencePageFrame } from "./TeamExperiencePageFrame.jsx";
import { useTeamExperienceSetup } from "./useTeamExperienceSetup.js";
import { primaryActionSx, outlinedActionSx } from "../visual/tournamentExperienceTokens.js";

export default function TeamSettingsPage() {
  const setup = useTeamExperienceSetup();
  const formatDirtyRef = useRef(false);
  const projection = setup.settingsProjection;

  async function saveFormatVenueConfig(config) {
    if (!setup.access.canManage) {
      setup.setError("Bạn không có quyền lưu cài đặt giải.");
      return { ok: false };
    }
    if (typeof setup.persistFormatVenueSetup !== "function") {
      setup.setError("Thiếu lệnh lưu Format & Venue.");
      return { ok: false };
    }
    const delegate = createTeamExperienceCommandDelegate({
      [TEAM_EXPERIENCE_COMMANDS.SAVE_FORMAT_VENUE]: (payload) =>
        setup.persistFormatVenueSetup(payload),
    });
    const result = await delegate.execute(TEAM_EXPERIENCE_COMMANDS.SAVE_FORMAT_VENUE, config);
    if (!result?.ok) {
      setup.setError(result?.error || "Không lưu được cài đặt.");
      return result;
    }
    setup.setError("");
    setup.setMessage("Đã lưu cài đặt Format & Venue.");
    formatDirtyRef.current = false;
    await setup.reload({ silent: true, reason: "settings-save-readback" });
    return result;
  }

  return (
    <TeamExperiencePageFrame
      tournamentId={setup.tournamentId}
      title="Cài đặt giải đồng đội"
      subtitle="Format · Venue · nhóm · quy tắc"
      activeKey="settings"
      loading={setup.loading}
      loadError={setup.loadError}
      message={setup.message}
      error={setup.error}
      primaryAction={
        <Button
          component={RouterLink}
          to={teamTournamentLegacyPath(setup.tournamentId, TEAM_TAB_QUERY.disciplines)}
          size="small"
          sx={outlinedActionSx}
        >
          Nội dung (thiết lập)
        </Button>
      }
    >
      {projection ? (
        <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1.5, flexWrap: "wrap" }}>
          <Chip size="small" label={`Định dạng: ${projection.format.formatPreset || "—"}`} />
          <Chip size="small" label={`Nhóm: ${projection.format.groupCount ?? "—"}`} />
          <Chip
            size="small"
            label={`Vào knockout/bảng: ${projection.format.qualifiersPerGroup ?? "—"}`}
          />
          <Chip size="small" label={`${projection.disciplineCount} nội dung`} />
          <Chip
            size="small"
            label={`${projection.format.selectedCourtIds.length} sân đã chọn`}
          />
        </Stack>
      ) : null}

      {!setup.access.canManage ? (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Bạn đang xem ở chế độ chỉ đọc. Lưu cài đặt dành cho BTC.
        </Alert>
      ) : null}

      {setup.access.canManage && setup.tournament ? (
        <TeamFormatVenueSetupPanel
          teamData={setup.teamData}
          tournament={setup.tournament}
          clubId={setup.effectiveClubId}
          tenantId={setup.tenantId}
          canManage={setup.access.canManage}
          teamCountHint={setup.teamData?.teams?.length || 0}
          onSave={saveFormatVenueConfig}
          onError={setup.setError}
          onMessage={setup.setMessage}
          onFormatDirtyDiagnostic={(dirty) => {
            formatDirtyRef.current = dirty === true;
          }}
        />
      ) : null}

      {projection?.disciplines?.length ? (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Nội dung thi đấu ({projection.disciplines.length}) cấu hình qua đường dẫn riêng —{" "}
          <Button
            component={RouterLink}
            to={teamTournamentLegacyPath(setup.tournamentId, TEAM_TAB_QUERY.disciplines)}
            size="small"
            sx={primaryActionSx}
          >
            Mở nội dung
          </Button>
        </Alert>
      ) : (
        <Typography sx={{ mt: 1.5, fontSize: 13, color: "text.secondary" }}>
          Chưa có nội dung trên hồ sơ — cấu hình tại tab Nội dung (thiết lập).
        </Typography>
      )}
    </TeamExperiencePageFrame>
  );
}
