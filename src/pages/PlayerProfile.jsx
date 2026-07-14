import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import { ROLES, isPlatformWideRole, normalizeRole } from "../auth/roles.js";
import { guardRecordTenant } from "../features/tenant/index.js";
import {
  getPlayerPendingSkillLevelRequest,
  submitSkillLevelChangeRequest,
} from "../domain/skillLevelChangeService.js";
import { getPlayerCurrentRating } from "../models/player.js";
import { resolveV2AthleteProfile } from "../features/club/services/resolveV2AthleteProfileService.js";
import { adminLinkAccountOnlyAthleteToClub } from "../features/club/services/clubMembershipRequestService.js";
import { fetchProfileByUserId } from "../auth/profileService.js";
import VprProfilePanel from "../features/vpr-ranking/components/VprProfilePanel.jsx";
import PickVnRatingPanel from "../features/pick-vn-rating/components/PickVnRatingPanel.jsx";
import {
  formatPickVnRating,
  PICK_VN_MAX,
  PICK_VN_MIN,
  snapPickVnRating,
} from "../features/pick-vn-rating/constants/pickVnRatingScale.js";
import { getLevelColor, getLevelLabel, isPlayerUnrated } from "../utils/playerHelpers.js";
import { RATING_STATUS_LABELS } from "../features/pick-vn-rating/constants/ratingStatus.js";
import { isClubStorageV2Enabled } from "../features/club/config/clubRegistryFlags.js";

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
  const { clubs, activeClubId, activeClub, revision, refreshClubs } = useClub();
  const { currentTenantId } = useTenant();
  const { rbacEnabled, isAuthenticated, user, can } = useAuth();

  const [requestedLevel, setRequestedLevel] = useState(3.5);
  const [changeReason, setChangeReason] = useState("");
  const [formMessage, setFormMessage] = useState(null);
  const [requestTick, setRequestTick] = useState(0);
  const [profileTab, setProfileTab] = useState("pick_vn");
  const [profile, setProfile] = useState({ ok: false, loading: true, error: null });
  const [linkMessage, setLinkMessage] = useState(null);
  const [linking, setLinking] = useState(false);
  const [linkClubId, setLinkClubId] = useState(activeClubId || "");

  const platformWideRole = isPlatformWideRole(user?.role);
  const linkableClubs = clubs.filter((club) => !club.isDefault);
  const linkTargetClubId = platformWideRole ? linkClubId : activeClubId;
  const linkTargetClub =
    linkableClubs.find((club) => club.id === linkTargetClubId) ||
    clubs.find((club) => club.id === linkTargetClubId && !club.isDefault) ||
    null;

  useEffect(() => {
    // Only default link target for true account-only flows (no active membership).
    if (activeClubId && !profile.ok) {
      setLinkClubId((prev) => prev || activeClubId);
    }
  }, [activeClubId, profile.ok]);

  const isSelfProfile =
    Boolean(user?.playerId) && String(user.playerId) === String(playerId);
  const isPlayerRole = normalizeRole(user?.role) === ROLES.PLAYER;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setProfile({ ok: false, loading: true, error: null });

      const resolved = await resolveV2AthleteProfile({
        routePlayerId: playerId,
        preferredClubId: isPlayerRole || isSelfProfile ? user?.clubId : null,
        secondaryClubId: activeClubId,
        fallbackAuthUserId: isPlayerRole || isSelfProfile ? user?.id : null,
      });

      if (!cancelled) {
        setProfile({ ...resolved, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeClubId, isPlayerRole, isSelfProfile, playerId, revision, user?.clubId, user?.id]);

  const activeMemberships = profile.ok ? profile.activeMemberships || [] : [];
  const primaryMembership = activeMemberships[0] || null;
  const profileClubId = profile.ok
    ? profile.clubId || primaryMembership?.club_id || null
    : null;
  const resolvedPlayerId = profile.ok ? profile.resolvedPlayerId || playerId : playerId;
  const isAccountOnlyProfile = Boolean(profile.ok && profile.isAccountOnly);
  const profileClub =
    clubs.find((club) => club.id === profileClubId) ||
    (activeClub?.id === profileClubId
      ? activeClub
      : profile.ok && profileClubId
        ? { id: profileClubId, name: profile.player?.clubName || primaryMembership?.club_name || "CLB" }
        : null);

  useEffect(() => {
    if (!isAccountOnlyProfile) {
      return;
    }
    const nonDefault = clubs.find((club) => club.id && !club.isDefault);
    if (nonDefault?.id) {
      setLinkClubId((prev) => {
        const current = clubs.find((club) => club.id === prev);
        if (current && !current.isDefault) {
          return prev;
        }
        return nonDefault.id;
      });
    }
  }, [clubs, isAccountOnlyProfile]);

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

  const canLinkToClub =
    isAccountOnlyProfile &&
    Boolean(linkTargetClubId) &&
    can(PERMISSIONS.PLAYER_UPDATE, {
      clubId: linkTargetClubId,
      venueId: linkTargetClub?.venueId || null,
    });

  const handleLinkToClub = async () => {
    if (!profile.authUserId || !linkTargetClubId) {
      return;
    }

    setLinking(true);
    setLinkMessage(null);

    const profileResult = await fetchProfileByUserId(profile.authUserId);
    const result = await adminLinkAccountOnlyAthleteToClub({
      clubId: linkTargetClubId,
      user: profileResult.ok ? profileResult.user : { id: profile.authUserId },
      tenantId: linkTargetClub?.venueId || currentTenantId,
    });

    setLinking(false);

    if (!result.ok) {
      setLinkMessage({ type: "error", text: result.error || "Không gắn được VĐV vào CLB." });
      return;
    }

    refreshClubs();
    const linkedClubName = linkTargetClub?.name || "CLB";
    setLinkMessage({ type: "success", text: `Đã gắn VĐV vào ${linkedClubName}.` });
    navigate(`/players/profile/${result.playerId}`, { replace: true });
  };

  if (profile.loading) {
    return (
      <Box>
        <Typography color="text.secondary">Đang tải hồ sơ VĐV...</Typography>
      </Box>
    );
  }

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
  const unrated = isPlayerUnrated(player);
  const skillLevel = unrated ? null : getPlayerCurrentRating(player);

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
              {isAccountOnlyProfile
                ? "Chỉ có tài khoản"
                : profileClub?.name || primaryMembership?.club_name || "CLB"}{" "}
              • {player.gender || "Chưa rõ"}
              {canViewSkill && !unrated && skillLevel != null && (
                <>
                  {" "}
                  • Điểm trình độ{" "}
                  <strong>{formatPickVnRating(skillLevel)}</strong>
                </>
              )}
              {canViewSkill && unrated && (
                <>
                  {" "}
                  • <strong>{RATING_STATUS_LABELS.unrated}</strong>
                </>
              )}
            </Typography>
            {player.email ? (
              <Typography variant="body2" color="text.secondary">
                {player.email}
              </Typography>
            ) : null}
            {activeMemberships.length > 1 && (
              <Typography variant="body2" color="text.secondary">
                Thành viên các CLB:{" "}
                {activeMemberships
                  .map((row) => row.club_name || row.club_id)
                  .filter(Boolean)
                  .join(", ")}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {isAccountOnlyProfile && (
              <Chip
                size="small"
                color="warning"
                label="Chỉ có tài khoản"
              />
            )}
            {!isAccountOnlyProfile &&
              activeMemberships.map((row) => (
                <Chip
                  key={row.membership_id || row.club_id}
                  size="small"
                  color="success"
                  variant="outlined"
                  label={`Thành viên ${row.club_name || row.club_id}`}
                />
              ))}
            {player.unitName && <Chip label={player.unitName} size="small" variant="outlined" />}
          </Stack>
        </Stack>
      </Paper>

      {canLinkToClub && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" fontWeight="bold">
              Gắn VĐV vào CLB
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tạo hồ sơ VĐV tại{" "}
              <strong>{linkTargetClub?.name || "CLB đã chọn"}</strong> và liên kết tài khoản này.
            </Typography>
            {platformWideRole && clubs.length > 0 && (
              <FormControl fullWidth size="small">
                <InputLabel id="link-club-label">Chọn CLB</InputLabel>
                <Select
                  labelId="link-club-label"
                  value={linkClubId || ""}
                  label="Chọn CLB"
                  onChange={(event) => setLinkClubId(event.target.value)}
                >
                  {linkableClubs.map((club) => (
                      <MenuItem key={club.id} value={club.id}>
                        {club.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}
            {linkMessage && (
              <Alert severity={linkMessage.type === "error" ? "error" : "success"}>
                {linkMessage.text}
              </Alert>
            )}
            <Button variant="contained" onClick={handleLinkToClub} disabled={linking || !linkTargetClubId}>
              {linking
                ? "Đang gắn..."
                : platformWideRole
                  ? "Gắn vào CLB đã chọn"
                  : "Gắn vào CLB hiện tại"}
            </Button>
          </Stack>
        </Paper>
      )}

      {!isAccountOnlyProfile && activeMemberships.length > 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Đang là thành viên của{" "}
          {activeMemberships.map((row) => row.club_name || row.club_id).join(", ")}.
          {profile.recentMatches?.length === 0
            ? " Lịch sử trận sẽ hiển thị sau khi tham gia giải."
            : ""}
        </Alert>
      )}

      {isAccountOnlyProfile && (
        <Alert severity="info" sx={{ mb: 2 }}>
          VĐV này chưa có trong danh sách CLB. Lịch sử trận đấu sẽ hiển thị sau khi gắn CLB và tham gia giải.
        </Alert>
      )}

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
                authUserId={player.authUserId || profile.authUserId || (isSelfProfile ? user?.id : null)}
                athleteId={player.athleteId || profile.athlete?.id || null}
                membershipClubId={profileClubId}
                requireMembershipClub={Boolean(profileClubId) && isClubStorageV2Enabled()}
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
