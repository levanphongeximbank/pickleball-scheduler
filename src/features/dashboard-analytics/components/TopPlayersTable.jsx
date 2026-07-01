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

export default function TopPlayersTable({ rows = [] }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <EmojiEventsIcon color="warning" />
          <Typography variant="h6" fontWeight="bold">
            Top Players
          </Typography>
        </Stack>

        {!rows.length ? (
          <DashboardEmptyState
            title="Chưa có dữ liệu người chơi"
            description="Tổ chức giải hoặc phiên xếp sân để xếp hạng."
          />
        ) : (
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Hạng</TableCell>
                  <TableCell>Người chơi</TableCell>
                  <TableCell>CLB</TableCell>
                  <TableCell align="right">Trình độ</TableCell>
                  <TableCell align="right">Trận</TableCell>
                  <TableCell align="right">Thắng</TableCell>
                  <TableCell align="right">Tỷ lệ</TableCell>
                  <TableCell align="right">Điểm</TableCell>
                  <TableCell align="center">Xu hướng</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((player) => {
                  const badge = rankBadge(player.rank);
                  return (
                    <TableRow
                      key={player.id}
                      hover
                      sx={{ bgcolor: player.rank <= 3 ? "action.hover" : undefined }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                          <Typography fontWeight="bold">#{player.rank}</Typography>
                          {badge && <Chip size="small" label={badge.label} color={badge.color} />}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                            {initials(player.name)}
                          </Avatar>
                          <Typography variant="body2" fontWeight={player.rank <= 3 ? "bold" : "medium"}>
                            {player.name}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{player.club}</TableCell>
                      <TableCell align="right">{player.level}</TableCell>
                      <TableCell align="right">{player.matches}</TableCell>
                      <TableCell align="right">{player.wins}</TableCell>
                      <TableCell align="right">{player.winRate}%</TableCell>
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
