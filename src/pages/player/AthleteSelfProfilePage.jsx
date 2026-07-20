import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { ROLE_LABELS } from "../../auth/roles.js";
import { resolveSelfProfileRoleLabel } from "../../features/identity/utils/selfProfileVariant.js";
import {
  fetchSelfProfile,
  updateSelfProfile,
} from "../../features/identity/services/selfProfileService.js";
import { changePassword } from "../../features/identity/services/passwordService.js";
import AvatarPicker from "../../features/identity/components/AvatarPicker.jsx";
import AthleteRatingSummary from "../../features/pick-vn-rating/components/AthleteRatingSummary.jsx";
import PickVnRatingBadge from "../../features/pick-vn-rating/components/PickVnRatingBadge.jsx";
import { getPickVnRatingByAuthUserId } from "../../features/pick-vn-rating/services/pickVnRatingService.js";
import { RATING_STATUS } from "../../features/pick-vn-rating/constants/ratingStatus.js";
import { getMyClubSummary } from "../../features/club/services/clubMembershipRequestService.js";
import { CLUB_STATUS_LABELS } from "../../features/club/constants/clubStatus.js";
import {
  PROFILE_GENDER_OPTIONS,
  toProfileGenderFormValue,
} from "../../features/identity/utils/profileGender.js";
import { useAuthenticatedSelfPlayerProfile } from "../../features/player/hooks/useAuthenticatedSelfPlayerProfile.js";
import SelfPlayerProfileFoundationEdit from "../../features/player/components/SelfPlayerProfileFoundationEdit.jsx";
import { SELF_PLAYER_PROFILE_READ_STATUS } from "../../features/player/services/getAuthenticatedSelfPlayerProfile.js";
import { formatVerificationStatusDisplay } from "../../features/player/selectors/selfProfileDisplay.js";
import {
  buildSelfFoundationFormState,
  buildSelfFoundationUpdatePatch,
  stripVerificationFromSelfPatch,
} from "../../features/player/utils/selfFoundationForm.js";

export default function AthleteSelfProfilePage() {
  const { user, refresh } = useAuth();
  const { currentTenantId } = useTenant();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [foundationForm, setFoundationForm] = useState(null);
  const [foundationSeeded, setFoundationSeeded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [ratingTick, setRatingTick] = useState(0);

  const playerProfileRead = useAuthenticatedSelfPlayerProfile({
    authUserId: user?.id || null,
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setProfileReady(false);
      const result = await fetchSelfProfile();
      if (cancelled || !result.ok) {
        return;
      }
      setDisplayName(result.user.displayName || "");
      setPhone(result.user.phone || "");
      setGender(toProfileGenderFormValue(result.user.gender));
      setAvatarUrl(result.user.avatarUrl || "");
      setProfileReady(true);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Seed foundation form from canonical Player profile (single source — avoid Identity dual state).
  useEffect(() => {
    if (foundationSeeded) return;
    if (playerProfileRead.status === SELF_PLAYER_PROFILE_READ_STATUS.LOADING) return;
    if (
      playerProfileRead.status === SELF_PLAYER_PROFILE_READ_STATUS.UNAUTHORIZED ||
      playerProfileRead.status === SELF_PLAYER_PROFILE_READ_STATUS.PROFILE_NOT_FOUND ||
      playerProfileRead.status === SELF_PLAYER_PROFILE_READ_STATUS.READ_ERROR ||
      playerProfileRead.status === SELF_PLAYER_PROFILE_READ_STATUS.UNRESOLVED
    ) {
      return;
    }
    // LOADED or EMPTY — allow edit with defaults when profile row has no foundation data yet.
    setFoundationForm(buildSelfFoundationFormState(playerProfileRead.profile));
    setFoundationSeeded(true);
  }, [playerProfileRead.status, playerProfileRead.profile, foundationSeeded]);

  const ratingRecord = useMemo(() => {
    void ratingTick;
    return user?.id ? getPickVnRatingByAuthUserId(user.id) : null;
  }, [ratingTick, user?.id]);

  const clubSummary = useMemo(() => {
    if (!user?.clubId) {
      return null;
    }
    return getMyClubSummary(user.clubId, currentTenantId);
  }, [currentTenantId, user]);

  const handleSaveProfile = async () => {
    if (!profileReady) {
      setMessage({ type: "error", text: "Đang tải hồ sơ — thử lại sau giây lát." });
      return;
    }

    if (!foundationForm) {
      setMessage({ type: "error", text: "Đang tải hồ sơ vận động viên — thử lại sau giây lát." });
      return;
    }

    const foundation = buildSelfFoundationUpdatePatch(foundationForm);
    if (!foundation.ok) {
      setMessage({ type: "error", text: foundation.error });
      return;
    }

    setLoading(true);
    setMessage(null);

    const profileResult = await updateSelfProfile(
      stripVerificationFromSelfPatch({
        displayName,
        phone,
        avatarUrl,
        gender,
        ...foundation.patch,
      })
    );

    setLoading(false);

    if (!profileResult.ok) {
      setMessage({ type: "error", text: profileResult.error });
      return;
    }

    setGender(toProfileGenderFormValue(profileResult.user?.gender ?? gender));
    refresh();
    setRatingTick((value) => value + 1);

    // Reload Player profile then re-seed form from persisted values.
    setFoundationSeeded(false);
    await playerProfileRead.reload();
    setMessage({ type: "success", text: "Đã cập nhật hồ sơ." });
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp." });
      return;
    }

    setLoading(true);
    setMessage(null);
    const result = await changePassword({ currentPassword, newPassword });
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage({ type: "success", text: result.message });
  };

  if (!user) {
    return <Alert severity="warning">Vui lòng đăng nhập để xem hồ sơ.</Alert>;
  }

  const hasRating =
    ratingRecord &&
    ratingRecord.ratingStatus !== RATING_STATUS.UNRATED &&
    ratingRecord.currentRating != null;

  const roleLabel =
    resolveSelfProfileRoleLabel(user) || ROLE_LABELS[user.role] || "Vận động viên";

  const foundationReady =
    foundationSeeded &&
    foundationForm &&
    (playerProfileRead.status === SELF_PLAYER_PROFILE_READ_STATUS.LOADED ||
      playerProfileRead.status === SELF_PLAYER_PROFILE_READ_STATUS.EMPTY);

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Hồ sơ của tôi
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, position: { md: "sticky" }, top: 88 }}>
            <Stack spacing={2} alignItems="center">
              <AvatarPicker
                user={user}
                avatarUrl={avatarUrl}
                onAvatarUrlChange={setAvatarUrl}
                onAvatarUpdated={() => {
                  refresh();
                  setMessage({ type: "success", text: "Đã cập nhật hình đại diện." });
                }}
                disabled={loading}
              />
              <Box sx={{ textAlign: "center", width: "100%" }}>
                <Typography variant="h6" fontWeight={700}>
                  {displayName || user.displayName || "Vận động viên"}
                </Typography>
                <Chip
                  size="small"
                  color="primary"
                  label={roleLabel}
                  sx={{ mt: 0.5 }}
                />
                {clubSummary?.name && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {clubSummary.name}
                  </Typography>
                )}
              </Box>
              {hasRating && (
                <PickVnRatingBadge
                  rating={ratingRecord.currentRating}
                  status={ratingRecord.ratingStatus}
                  confidence={ratingRecord.ratingConfidence}
                  size="medium"
                />
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Thông tin cá nhân
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Họ tên"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Số điện thoại"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    fullWidth
                  />
                  <FormControl>
                    <FormLabel>Giới tính</FormLabel>
                    <RadioGroup
                      row
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      {PROFILE_GENDER_OPTIONS.map((option) => (
                        <FormControlLabel
                          key={option.value}
                          value={option.value}
                          control={<Radio size="small" />}
                          label={option.label}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <TextField label="Email" value={user.email || ""} disabled fullWidth />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <SelfPlayerProfileFoundationEdit
                  status={
                    foundationReady
                      ? SELF_PLAYER_PROFILE_READ_STATUS.LOADED
                      : playerProfileRead.status
                  }
                  message={playerProfileRead.message}
                  form={foundationForm}
                  onChange={setFoundationForm}
                  verificationLabel={formatVerificationStatusDisplay(
                    playerProfileRead.profile?.verificationStatus
                  )}
                  disabled={loading || !foundationReady}
                  onRetry={() => {
                    setFoundationSeeded(false);
                    playerProfileRead.reload();
                  }}
                />
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleSaveProfile}
                    disabled={loading || !profileReady || !foundationReady}
                  >
                    Lưu hồ sơ
                  </Button>
                </Box>
              </CardContent>
            </Card>

            <AthleteRatingSummary authUserId={user.id} />

            <Card>
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={1}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <GroupsIcon color="action" />
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        CLB của tôi
                      </Typography>
                      {clubSummary ? (
                        <Typography variant="body2" color="text.secondary">
                          {clubSummary.name} · {clubSummary.memberCount} thành viên ·{" "}
                          {CLUB_STATUS_LABELS[clubSummary.status] || clubSummary.status}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Chưa gia nhập CLB
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  <Button
                    component={RouterLink}
                    to="/my-club"
                    endIcon={<ChevronRightIcon />}
                    size="small"
                  >
                    Xem CLB
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Bảo mật
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Mật khẩu hiện tại"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    fullWidth
                    autoComplete="current-password"
                  />
                  <TextField
                    label="Mật khẩu mới"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    fullWidth
                    autoComplete="new-password"
                  />
                  <TextField
                    label="Xác nhận mật khẩu mới"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    fullWidth
                    autoComplete="new-password"
                  />
                  <Button
                    variant="outlined"
                    onClick={handleChangePassword}
                    disabled={loading || !currentPassword || !newPassword}
                  >
                    Đổi mật khẩu
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
