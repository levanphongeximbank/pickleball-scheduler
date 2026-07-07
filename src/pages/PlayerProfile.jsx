import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useClub } from "../context/ClubContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { canViewPlayerSkillLevel } from "../auth/rbac.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { guardRecordTenant } from "../features/tenant/index.js";
import {
  getPlayerPendingSkillLevelRequest,
  submitSkillLevelChangeRequest,
} from "../domain/skillLevelChangeService.js";
import { getPlayerSkillLevel } from "../models/player.js";
import { loadPlayerHistoryProfileForClub } from "../tournament/engines/playerHistoryEngine.js";
import { getLevelColor, getLevelLabel } from "../utils/playerHelpers.js";

function StatCard({ label, value, helper }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight="bold">
        {value}
      </Typography>
      {helper && (
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      )}
    </Paper>
  );
}

function RelationshipList({ title, items }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chua co du lieu.
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          {items.map((item) => (
            <Stack
              key={item.playerId}
              direction="row"
              justifyContent="space-between"
              spacing={1}
            >
              <Typography variant="body2">{item.name}</Typography>
              <Chip size="small" label={`${item.count} lan`} />
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export default function PlayerProfile() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { activeClubId, activeClub, revision } = useClub();
  const { currentTenantId } = useTenant();
  const { rbacEnabled, isAuthenticated, user, can } = useAuth();

  const [requestedLevel, setRequestedLevel] = useState(3.5);
  const [changeReason, setChangeReason] = useState("");
  const [formMessage, setFormMessage] = useState(null);
  const [requestTick, setRequestTick] = useState(0);

  const profile = useMemo(() => {
    void revision;
    return loadPlayerHistoryProfileForClub(activeClubId, playerId, { recentLimit: 12 });
  }, [activeClubId, playerId, revision]);

  const pendingRequest = useMemo(() => {
    void revision;
    void requestTick;
    if (!activeClubId || !playerId) {
      return null;
    }
    return getPlayerPendingSkillLevelRequest(activeClubId, playerId);
  }, [activeClubId, playerId, revision, requestTick]);

  const canViewSkill = useMemo(() => {
    if (!profile.ok) {
      return false;
    }
    return canViewPlayerSkillLevel(
      user,
      { clubId: activeClubId, playerId },
      { rbacEnabled }
    );
  }, [activeClubId, playerId, profile.ok, rbacEnabled, user]);

  const isSelfProfile =
    Boolean(user?.playerId) && String(user.playerId) === String(playerId);

  const canRequestChange =
    isSelfProfile &&
    can(PERMISSIONS.SKILL_LEVEL_REQUEST_CHANGE, {
      clubId: activeClubId,
      playerId,
    });

  const tenantDenied = useMemo(() => {
    if (!rbacEnabled || !isAuthenticated || !currentTenantId || !profile.ok) {
      return null;
    }

    return guardRecordTenant(profile.player, currentTenantId);
  }, [currentTenantId, isAuthenticated, profile, rbacEnabled]);

  const handleSubmitChangeRequest = () => {
    const result = submitSkillLevelChangeRequest(
      activeClubId,
      playerId,
      requestedLevel,
      {
        reason: changeReason,
        requestedBy: user?.email || user?.id || null,
      }
    );

    if (!result.ok) {
      setFormMessage({ type: "error", text: result.error });
      return;
    }

    setFormMessage({
      type: "success",
      text: "Đã gửi yêu cầu thay đổi trình độ. Kỹ thuật viên hệ thống sẽ duyệt.",
    });
    setChangeReason("");
    setRequestTick((value) => value + 1);
  };

  if (tenantDenied && !tenantDenied.ok) {
    return (
      <Box>
        <Alert severity="error">
          {tenantDenied.error || "Không có quyền xem hồ sơ người chơi này."}
        </Alert>
        <Button component={RouterLink} to="/players" sx={{ mt: 2 }}>
          Quay lai danh sach
        </Button>
      </Box>
    );
  }

  if (!profile.ok) {
    return (
      <Box>
        <Alert severity="error">{profile.error}</Alert>
        <Button component={RouterLink} to="/players" sx={{ mt: 2 }}>
          Quay lai danh sach
        </Button>
      </Box>
    );
  }

  const { player, stats, recentMatches, topPartners, topOpponents } = profile;
  const skillLevel = getPlayerSkillLevel(player);

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/players")} sx={{ mb: 2 }}>
        Quay lai Nguoi choi
      </Button>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Box>
            <Typography variant="h5" fontWeight="bold">
              {player.name}
            </Typography>
            <Typography color="text.secondary">
              {activeClub?.name || "CLB"} • {player.gender || "?"}
              {canViewSkill && (
                <>
                  {" "}
                  • Điểm trình độ{" "}
                  <strong>{Number(skillLevel).toFixed(1)}</strong>
                </>
              )}
            </Typography>
            {player.clubName && (
              <Typography variant="body2" color="text.secondary">
                CLB dai dien: {player.clubName}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {player.playerType && <Chip label={player.playerType} size="small" />}
            {player.unitName && <Chip label={player.unitName} size="small" variant="outlined" />}
          </Stack>
        </Stack>
      </Paper>

      {canRequestChange && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
            Yêu cầu thay đổi trình độ
          </Typography>
          {pendingRequest ? (
            <Alert severity="info">
              Đang chờ duyệt: {Number(pendingRequest.currentLevel).toFixed(1)} →{" "}
              {Number(pendingRequest.requestedLevel).toFixed(1)} — {pendingRequest.reason}
            </Alert>
          ) : (
            <Stack spacing={2}>
              {formMessage && (
                <Alert severity={formMessage.type === "error" ? "error" : "success"}>
                  {formMessage.text}
                </Alert>
              )}
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Điểm hiện tại: {Number(skillLevel).toFixed(1)}
                </Typography>
                <Chip
                  label={`${Number(requestedLevel).toFixed(1)} · ${getLevelLabel(requestedLevel)}`}
                  sx={{
                    bgcolor: `${getLevelColor(requestedLevel)}18`,
                    color: getLevelColor(requestedLevel),
                    fontWeight: 800,
                  }}
                />
              </Stack>
              <Slider
                value={requestedLevel}
                min={1.5}
                max={6}
                step={0.1}
                valueLabelDisplay="auto"
                onChange={(_, value) => setRequestedLevel(value)}
              />
              <TextField
                label="Lý do thay đổi"
                fullWidth
                multiline
                minRows={2}
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
              />
              <Button variant="contained" onClick={handleSubmitChangeRequest}>
                Gửi yêu cầu duyệt
              </Button>
            </Stack>
          )}
        </Paper>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="So tran" value={stats.matchesPlayed} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Thang / Thua / Hoa" value={`${stats.wins}/${stats.losses}/${stats.draws}`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Ty le thang" value={`${stats.winRate}%`} helper="Tinh tren tran co thang/thua" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Hieu so diem"
            value={stats.pointDiff}
            helper={`${stats.pointsFor} - ${stats.pointsAgainst}`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <RelationshipList title="Dong doi thuong gap" items={topPartners} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <RelationshipList title="Doi thu thuong gap" items={topOpponents} />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
          Tran gan day
        </Typography>
        {recentMatches.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chua co lich su tran tu Daily Play hoac giai V3.3.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {recentMatches.map((match) => (
              <Paper key={match.id} variant="outlined" sx={{ p: 1.25 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {match.tournamentName} • {match.eventName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {match.stageLabel} • {match.scoreA}-{match.scoreB}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    color={match.outcome?.won ? "success" : match.outcome?.lost ? "error" : "default"}
                    label={match.resultLabel}
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
