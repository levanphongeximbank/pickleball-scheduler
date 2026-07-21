/**
 * Phase 1I-C / 1I-D — Single Public Directory player card (strict Directory DTO only).
 * Navigates to /athletes/:playerId when a valid playerId is present.
 */
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import { Link as RouterLink } from "react-router-dom";

import {
  formatDirectoryGenderLabel,
  formatDirectoryHandednessLabel,
} from "../utils/publicDirectoryListMessages.js";
import { buildPublicDirectoryPlayerPath } from "../utils/publicDirectoryRoutes.js";

/**
 * @param {object} props
 * @param {object} props.player — strict Directory DTO
 */
export default function PublicDirectoryPlayerCard({ player }) {
  if (!player || typeof player !== "object") return null;

  const displayName = String(player.displayName || "").trim() || "Vận động viên";
  const activityRegion =
    player.activityRegion == null || player.activityRegion === ""
      ? null
      : String(player.activityRegion);
  const genderLabel = formatDirectoryGenderLabel(player.gender);
  const handednessLabel = formatDirectoryHandednessLabel(player.handedness);
  const initial = displayName.charAt(0).toUpperCase();
  const detailPath = buildPublicDirectoryPlayerPath(player.playerId);

  const metaParts = [activityRegion, genderLabel, handednessLabel].filter(Boolean);

  const body = (
    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Avatar
          src={player.avatarUrl || undefined}
          alt={`Ảnh đại diện của ${displayName}`}
          sx={{ width: 48, height: 48, flexShrink: 0 }}
        >
          {initial}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography
              variant="subtitle1"
              fontWeight={600}
              noWrap
              title={displayName}
            >
              {displayName}
            </Typography>
            {player.isVerified === true ? (
              <Tooltip title="Đã xác minh">
                <VerifiedOutlinedIcon
                  color="primary"
                  fontSize="small"
                  aria-label="Đã xác minh"
                  data-testid="directory-verified-badge"
                />
              </Tooltip>
            ) : null}
          </Stack>
          {metaParts.length > 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, wordBreak: "break-word" }}
            >
              {metaParts.join(" · ")}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </CardContent>
  );

  return (
    <Card
      variant="outlined"
      sx={{ height: "100%", bgcolor: "background.paper" }}
      data-testid="directory-player-card"
    >
      {detailPath ? (
        <CardActionArea
          component={RouterLink}
          to={detailPath}
          aria-label={`Xem hồ sơ công khai của ${displayName}`}
          sx={{
            height: "100%",
            alignItems: "stretch",
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: 2,
            },
          }}
        >
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  );
}
