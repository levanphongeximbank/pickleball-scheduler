import { Link as RouterLink } from "react-router-dom";

import {
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import DashboardEmptyState from "./DashboardEmptyState.jsx";

function rankBadge(rank) {
  if (rank === 1) return { label: "🥇 Top 1", color: "warning" };
  if (rank === 2) return { label: "🥈 Top 2", color: "default" };
  if (rank === 3) return { label: "🥉 Top 3", color: "default" };
  return null;
}

function initials(name) {
  return String(name || "?")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function TopPlayersTable({ rows = [], title = "Top người chơi", compact = false }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2.5, height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <EmojiEventsIcon color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
        </Stack>

        {!rows.length ? (
          <DashboardEmptyState
            title="Chưa có dữ liệu người chơi"
            description="Tổ chức giải hoặc phiên xếp sân để xếp hạng."
          />
        ) : (
          <TableContainer sx={{ maxHeight: compact ? 320 : 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {!compact && <TableCell>Hạng</TableCell>}
                  <TableCell>Người chơi</TableCell>
                  {!compact && <TableCell>CLB</TableCell>}
                  <TableCell align="right">Trận</TableCell>
                  <TableCell align="right">Tỷ lệ</TableCell>
                  {!compact && (
                    <>
                      <TableCell align="right">Điểm</TableCell>
                      <TableCell align="center">Xu hướng</TableCell>
                      <TableCell />
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(0, compact ? 5 : rows.length).map((player) => {
                  const badge = !compact ? rankBadge(player.rank) : null;
                  return (
                    <TableRow
                      key={player.id}
                      hover
                      sx={{ bgcolor: player.rank <= 3 ? "action.hover" : undefined }}
                    >
                      {!compact && (
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                            <Typography fontWeight="bold">#{player.rank}</Typography>
                            {badge && <Chip size="small" label={badge.label} color={badge.color} />}
                          </Stack>
                        </TableCell>
                      )}
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                            {initials(player.name)}
                          </Avatar>
                          <Typography variant="body2" fontWeight={player.rank <= 3 ? 700 : 500}>
                            {player.name}
                          </Typography>
                        </Stack>
                      </TableCell>
                      {!compact && <TableCell>{player.club}</TableCell>}
                      <TableCell align="right">{player.matches}</TableCell>
                      <TableCell align="right">{player.winRate}%</TableCell>
                      {!compact && (
                        <>
                          <TableCell align="right">{player.points}</TableCell>
                          <TableCell align="center">
                            {player.trend > 0 ? (
                              <TrendingUpIcon fontSize="small" color="success" />
                            ) : player.trend < 0 ? (
                              <TrendingDownIcon fontSize="small" color="error" />
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              component={RouterLink}
                              to={`/players/profile/${player.id}`}
                              size="small"
                              variant="text"
                            >
                              Chi tiết
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
