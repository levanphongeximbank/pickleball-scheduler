import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import PlaceIcon from "@mui/icons-material/Place";

import { CLUB_MEMBERSHIP_REQUEST_STATUSES } from "../constants/clubMembershipRequestStatuses.js";
import ClubAvatar from "./ClubAvatar.jsx";
import MembershipRequestBadge from "./MembershipRequestBadge.jsx";
import { resolveClubCardCta } from "./clubCardCtaLogic.js";
import { clubCardSx } from "./clubUiTokens.js";

/**
 * Discover grid card — variants: your-club | joinable | pending | rejected
 * CTA rules unchanged from Phase 42L (no wrong-state buttons).
 */
export default function ClubCard({
  clubName,
  memberCount = 0,
  presidentLabel,
  clusterLabel,
  variant = "joinable",
  requestStatus = null,
  reviewNote = null,
  disabled = false,
  onJoin,
  onCancel,
}) {
  const isRejected = variant === "rejected" || requestStatus === CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED;
  const isPending = variant === "pending" || requestStatus === CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING;
  const isYourClub = variant === "your-club";
  const cta = resolveClubCardCta({ variant, requestStatus, disabled });

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    if (isYourClub || isPending || isRejected || disabled) {
      return;
    }
    event.preventDefault();
    onJoin?.();
  };

  return (
    <Card
      sx={{
        ...clubCardSx,
        opacity: isRejected ? 0.72 : 1,
        outline: "none",
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`CLB ${clubName}`}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <ClubAvatar name={clubName} size={48} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Typography variant="h6" fontWeight={700} component="h2">
                  {clubName}
                </Typography>
                {isYourClub ? (
                  <Chip size="small" label="CLB của bạn" color="success" aria-label="CLB của bạn" />
                ) : (
                  requestStatus && <MembershipRequestBadge status={requestStatus} />
                )}
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {memberCount} thành viên
                {presidentLabel ? ` · Chủ tịch: ${presidentLabel}` : ""}
              </Typography>

              {clusterLabel && (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                  <PlaceIcon fontSize="inherit" color="action" aria-hidden />
                  <Typography variant="body2" color="text.secondary">
                    {clusterLabel}
                  </Typography>
                </Stack>
              )}
            </Box>
          </Stack>

          {isRejected && reviewNote && (
            <Typography variant="caption" color="error">
              Lý do: {reviewNote}
            </Typography>
          )}

          {!isYourClub && !disabled && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {cta.showJoin && (
                <Button variant="contained" size="small" onClick={onJoin}>
                  Xin tham gia
                </Button>
              )}
              {cta.showCancel && (
                <Button variant="outlined" size="small" color="inherit" onClick={onCancel}>
                  Hủy yêu cầu
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
