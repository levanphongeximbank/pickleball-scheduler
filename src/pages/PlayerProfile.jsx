import { useEffect, useMemo, useState } from "react";
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
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useClub } from "../context/ClubContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { canViewPlayerSkillLevel } from "../auth/rbac.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { ROLES, normalizeRole } from "../auth/roles.js";
import { guardRecordTenant } from "../features/tenant/index.js";
import {
  getPlayerPendingSkillLevelRequest,
  submitSkillLevelChangeRequest,
} from "../domain/skillLevelChangeService.js";
import { getPlayerCurrentRating } from "../models/player.js";
import { loadPlayerHistoryProfileResolved } from "../tournament/engines/playerHistoryEngine.js";
import VprProfilePanel from "../features/vpr-ranking/components/VprProfilePanel.jsx";
import PickVnRatingPanel from "../features/pick-vn-rating/components/PickVnRatingPanel.jsx";
import {
  formatPickVnRating,
  PICK_VN_MAX,
  PICK_VN_MIN,
  snapPickVnRating,
} from "../features/pick-vn-rating/constants/pickVnRatingScale.js";
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
  const [profileTab, setProfileTab] = useState("pick_vn");

  const isSelfProfile =
    Boolean(user?.playerId) && String(user.playerId) === String(playerId);
  const isPlayerRole = normalizeRole(user?.role) === ROLES.PLAYER;

  const profile = useMemo(() => {
    void revision;
    return loadPlayerHistoryProfileResolved(
      {
        primaryClubId: isPlayerRole || isSelfProfile ? user?.clubId : null,
        secondaryClubId: activeClubId,
        playerId,
        authUserId: isPlayerRole || isSelfProfile ? user?.id : null,
      },
      { recentLimit: 12 }
    );
  }, [activeClubId, isPlayerRole, isSelfProfile, playerId, revision, user?.clubId, user?.id]);

  const profileClubId = profile.ok ? profile.clubId : activeClubId;
  const resolvedPlayerId = profile.ok ? profile.resolvedPlayerId || playerId : playerId;
  const profileClub =
    activeClub?.id === profileClubId
      ? activeClub
      : profile.ok
        ? { id: profileClubId, name: profile.player?.clubName || "CLB" }
        : activeClub;

  useEffect(() => {
    if (!profile.ok || !(isSelfProfile || isPlayerRole)) {
      return;
    }

    const canonicalId = profile.resolvedPlayerId || playerId;
    if (canonicalId && String(canonicalId) !== String(playerId)) {
      navigate(`/players/profile/${canonicalId}`, { replace: true });
    }
  }, [isPlayerRole, isSelfProfile, navigate, playerId, profile]);

  const pendingRequest = useMemo(() => {
    void revision;
    void requestTick;
    if (!profileClubId || !resolvedPlayerId) {
      return null;
    }
    return getPlayerPendingSkillLevelRequest(profileClubId, resolvedPlayerId);
  }, [profileClubId, resolvedPlayerId, revision, requestTick]);

  const canViewSkill = useMemo(() => {
    if (!profile.ok) {
      return false;
    }
    return canViewPlayerSkillLevel(
      user,
      { clubId: profileClubId, playerId: resolvedPlayerId },
      { rbacEnabled }
    );
  }, [profile.ok, profileClubId, rbacEnabled, resolvedPlayerId, user]);

  const canRequestChange =
    (isSelfProfile || (isPlayerRole && profile.ok)) &&
    can(PERMISSIONS.SKILL_LEVEL_REQUEST_CHANGE, {
      clubId: profileClubId,
      playerId: resolvedPlayerId,
    });

  const profileBackPath = isPlayerRole ? "/tournament" : "/players";
  const profileBackLabel = isPlayerRole ? "Quay lai" : "Quay lai Nguoi choi";

  const tenantDenied = useMemo(() => {
    if (!rbacEnabled || !isAuthenticated || !currentTenantId || !profile.ok) {
      return null;
    }

    return guardRecordTenant(profile.player, currentTenantId);
  }, [currentTenantId, isAuthenticated, profile, rbacEnabled]);

  const handleSubmitChangeRequest = () => {
    const result = submitSkillLevelChangeRequest(
      profileClubId,
      resolvedPlayerId,
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
      text: "Đã gửi yêu cầu thay đổi trình độ. Admin sẽ duyệt.",
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
        <Button component={RouterLink} to={profileBackPath} sx={{ mt: 2 }}>
          {profileBackLabel}
        </Button>
      </Box>
    );
  }

  if (!profile.ok) {
    return (
      <Box>
        <Alert severity="error">{profile.error}</Alert>
        <Button component={RouterLink} to={profileBackPath} sx={{ mt: 2 }}>
          {profileBackLabel}
        </Button>
      </Box>
    );
  }

  const { player, stats, recentMatches, topPartners, topOpponents } = profile;
  const skillLevel = getPlayerCurrentRating(player);

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(profileBackPath)} sx={{ mb: 2 }}>
        {profileBackLabel}
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
              {profileClub?.name || "CLB"} • {player.gender || "?"}
              {canViewSkill && (
                <>
                  {" "}
                  • Điểm trình độ{" "}
                  <strong>{formatPickVnRating(skillLevel)}</strong>
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
                value={snapPickVnRating(requestedLevel)}
                min={PICK_VN_MIN}
                max={PICK_VN_MAX}
                step={0.5}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => formatPickVnRating(value)}
                onChange={(_, value) => setRequestedLevel(snapPickVnRating(value))}
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

      {canViewSkill && (
        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Tabs
            value={profileTab}
            onChange={(_, value) => setProfileTab(value)}
            sx={{ px: 1, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab value="pick_vn" label="Trình độ Pick_VN" />
            <Tab value="vpr" label="VPR Ranking" />
          </Tabs>
          <Box sx={{ p: 0 }}>
            {profileTab === "pick_vn" ? (
              <PickVnRatingPanel
                player={player}
                clubId={profileClubId}
                authUserId={player.authUserId || (isSelfProfile ? user?.id : null)}
              />
            ) : (
              <Box sx={{ p: 2 }}>
                <VprProfilePanel
                  clubId={profileClubId}
                  playerId={resolvedPlayerId}
                  playerName={player.name || ""}
                />
              </Box>
            )}
          </Box>
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
