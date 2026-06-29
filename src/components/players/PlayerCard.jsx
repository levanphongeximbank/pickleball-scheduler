import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import FemaleIcon from "@mui/icons-material/Female";
import HistoryIcon from "@mui/icons-material/History";
import LocalPhoneIcon from "@mui/icons-material/LocalPhone";
import MaleIcon from "@mui/icons-material/Male";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PersonIcon from "@mui/icons-material/Person";
import SportsScoreIcon from "@mui/icons-material/SportsScore";
import BlockIcon from "@mui/icons-material/Block";
import DeleteIcon from "@mui/icons-material/Delete";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

import PlayerInsight from "./PlayerInsight.jsx";
import {
  generatePlayerInsight,
  getLevelColor,
  getLevelLabel,
  getLevelProgress,
  getPlayerQuickStats,
  getPlayerStatusMeta,
} from "../../utils/playerHelpers.js";

function QuickStatPlaceholder({ label }) {
  return (
    <Box
      sx={{
        flex: 1,
        textAlign: "center",
        px: 0.5,
        py: 0.75,
        borderRadius: 1,
        bgcolor: "rgba(15, 23, 42, 0.03)",
      }}
    >
      <Typography variant="caption" color="text.disabled" display="block">
        {label}
      </Typography>
      <Typography variant="body2" color="text.disabled" fontWeight={600}>
        —
      </Typography>
    </Box>
  );
}

export default function PlayerCard({
  player,
  clubId,
  players = [],
  checkedInIds = new Set(),
  onEdit,
  onDelete,
  onLock,
}) {
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState(null);

  const levelColor = getLevelColor(player.level);
  const levelLabel = getLevelLabel(player.level);
  const progress = getLevelProgress(player.level);

  const statusMeta = useMemo(() => {
    const base = getPlayerStatusMeta(player);
    if (checkedInIds.has(String(player.id))) {
      return { key: "checked_in", label: "Đã check-in", color: "#7c3aed" };
    }
    return base;
  }, [player, checkedInIds]);

  const quickStats = useMemo(
    () => getPlayerQuickStats(player, clubId, new Map(players.map((p) => [String(p.id), p.name]))),
    [player, clubId, players]
  );

  const insight = useMemo(
    () => generatePlayerInsight(player, { clubId, players, checkedInIds }),
    [player, clubId, players, checkedInIds]
  );

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        border: "1px solid rgba(15, 23, 42, 0.08)",
        bgcolor: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(6px)",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "0 16px 36px rgba(15, 23, 42, 0.1)",
        },
      }}
    >
      <CardContent sx={{ p: 2, flex: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Avatar
            sx={{
              width: 52,
              height: 52,
              bgcolor: player.gender === "Nữ" ? "#fce7f3" : "#dbeafe",
              color: player.gender === "Nữ" ? "#be185d" : "#1d4ed8",
              fontWeight: 900,
              fontSize: 20,
            }}
          >
            {player.name?.charAt(0)?.toUpperCase() || "P"}
          </Avatar>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={900} noWrap title={player.name}>
              {player.name}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {player.gender === "Nữ" ? (
                <FemaleIcon sx={{ fontSize: 16, color: "#db2777" }} />
              ) : (
                <MaleIcon sx={{ fontSize: 16, color: "#2563eb" }} />
              )}
              <Typography variant="caption" color="text.secondary">
                {player.gender || "Chưa rõ"}
              </Typography>
              <Chip
                size="small"
                label={statusMeta.label}
                sx={{
                  ml: 0.5,
                  height: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  bgcolor: `${statusMeta.color}18`,
                  color: statusMeta.color,
                }}
              />
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Trình độ
          </Typography>
          <Chip
            size="small"
            label={`${Number(player.level).toFixed(1)} · ${levelLabel}`}
            sx={{
              bgcolor: `${levelColor}18`,
              color: levelColor,
              fontWeight: 800,
              fontSize: 11,
            }}
          />
        </Stack>

        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            mt: 0.75,
            height: 6,
            borderRadius: 999,
            bgcolor: "rgba(15, 23, 42, 0.06)",
            "& .MuiLinearProgress-bar": {
              borderRadius: 999,
              bgcolor: levelColor,
            },
          }}
        />

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1.25 }}>
          <LocalPhoneIcon sx={{ fontSize: 15, color: "text.disabled" }} />
          <Typography variant="body2" color={player.phone ? "text.primary" : "text.secondary"} noWrap>
            {player.phone || "Chưa có SĐT"}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.75} sx={{ mt: 1.5 }}>
          {quickStats?.hasData ? (
            <>
              <Box sx={{ flex: 1, textAlign: "center", px: 0.5, py: 0.75, borderRadius: 1, bgcolor: "rgba(15,23,42,0.03)" }}>
                <Typography variant="caption" color="text.secondary" display="block">Trận</Typography>
                <Typography variant="body2" fontWeight={800}>{quickStats.matches}</Typography>
              </Box>
              <Box sx={{ flex: 1, textAlign: "center", px: 0.5, py: 0.75, borderRadius: 1, bgcolor: "rgba(15,23,42,0.03)" }}>
                <Typography variant="caption" color="text.secondary" display="block">Win%</Typography>
                <Typography variant="body2" fontWeight={800}>
                  {quickStats.winRate != null ? `${quickStats.winRate}%` : "—"}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, textAlign: "center", px: 0.5, py: 0.75, borderRadius: 1, bgcolor: "rgba(15,23,42,0.03)" }}>
                <Typography variant="caption" color="text.secondary" display="block">Form</Typography>
                <Typography variant="body2" fontWeight={800}>{quickStats.recentForm || "—"}</Typography>
              </Box>
            </>
          ) : (
            <>
              <QuickStatPlaceholder label="Trận" />
              <QuickStatPlaceholder label="Win%" />
              <QuickStatPlaceholder label="Form" />
            </>
          )}
        </Stack>

        {quickStats?.topPartner && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Partner thường chơi: <strong>{quickStats.topPartner}</strong>
          </Typography>
        )}

        <PlayerInsight text={insight} />
      </CardContent>

      <Divider />

      <CardActions sx={{ px: 1.5, py: 1, justifyContent: "space-between" }}>
        <Stack direction="row" spacing={0.5}>
          <Button
            size="small"
            startIcon={<PersonIcon sx={{ fontSize: 16 }} />}
            onClick={() => navigate(`/players/profile/${player.id}`)}
            sx={{ fontWeight: 700, fontSize: 12, minWidth: 0, px: 1 }}
          >
            Hồ sơ
          </Button>
          <Button
            size="small"
            startIcon={<HistoryIcon sx={{ fontSize: 16 }} />}
            onClick={() => navigate(`/players/profile/${player.id}`)}
            sx={{ fontWeight: 700, fontSize: 12, minWidth: 0, px: 1, display: { xs: "none", sm: "inline-flex" } }}
          >
            Lịch sử
          </Button>
          {onEdit && (
            <Button
              size="small"
              startIcon={<EditIcon sx={{ fontSize: 16 }} />}
              onClick={() => onEdit(player)}
              sx={{ fontWeight: 700, fontSize: 12, minWidth: 0, px: 1 }}
            >
              Sửa
            </Button>
          )}
        </Stack>

        {(onDelete || onLock) && (
        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        )}

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          {onDelete && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onDelete(player);
            }}
            sx={{ color: "error.main" }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Xóa
          </MenuItem>
          )}
          {onLock && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onLock(player);
            }}
          >
            <BlockIcon fontSize="small" sx={{ mr: 1 }} />
            Khóa người chơi
          </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              navigate("/tournament");
            }}
          >
            <EmojiEventsIcon fontSize="small" sx={{ mr: 1 }} />
            Đăng ký vào giải
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              navigate("/select-players");
            }}
          >
            <SportsScoreIcon fontSize="small" sx={{ mr: 1 }} />
            Xếp sân nhanh
          </MenuItem>
        </Menu>
      </CardActions>
    </Card>
  );
}
