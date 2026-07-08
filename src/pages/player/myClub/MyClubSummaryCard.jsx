import { Link as RouterLink } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";

import { CLUB_STATUS_LABELS } from "../../../features/club/constants/clubStatus.js";

export default function MyClubSummaryCard({
  clubSummary,
  clubStats,
  governanceLabels,
  registeredCluster,
  user,
  manageHref = null,
}) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h6" fontWeight={700}>
              {clubSummary.name}
            </Typography>
            <Chip
              size="small"
              label={CLUB_STATUS_LABELS[clubSummary.status] || clubSummary.status}
              color={clubSummary.status === "active" ? "success" : "default"}
            />
          </Stack>

          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <GroupsIcon fontSize="small" color="action" />
              <Typography variant="body2">
                {clubStats?.activeMemberCount ?? clubSummary.memberCount} thành viên
              </Typography>
            </Stack>
            {governanceLabels?.presidentLabel && (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <PersonIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  Chủ tịch: {governanceLabels.presidentLabel}
                </Typography>
              </Stack>
            )}
            {governanceLabels?.ownerLabel && !governanceLabels.combinedOwnerPresident && (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <PersonIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  Chủ sở hữu: {governanceLabels.ownerLabel}
                </Typography>
              </Stack>
            )}
          </Stack>

          {registeredCluster && (
            <Typography variant="body2" color="text.secondary">
              Cụm sân: {registeredCluster.name}
            </Typography>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {user?.playerId && (
              <Button
                component={RouterLink}
                to={`/players/profile/${user.playerId}`}
                variant="outlined"
                startIcon={<PersonIcon />}
              >
                Hồ sơ thi đấu
              </Button>
            )}
            <Button
              component={RouterLink}
              to="/tournament"
              variant="contained"
              startIcon={<SportsTennisIcon />}
            >
              Giải đấu CLB
            </Button>
            {manageHref && (
              <Button component={RouterLink} to={manageHref} variant="outlined">
                Chi tiết CLB
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
