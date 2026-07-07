import { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";

import { useAuth } from "../../../context/AuthContext.jsx";
import {
  getClubStats,
  getClubRatings,
  getClubMembers,
  getTenantPlayers,
  getRecentClubActivity,
  canViewFullClubMembers,
} from "../../../features/club/index.js";
import { CLUB_MEMBER_STATUSES } from "../../../features/club/constants/clubMemberRoles.js";
import ClubGovernancePanel from "../ClubGovernancePanel.jsx";

function GovernanceSection({ club, tenantId, onRefresh }) {
  return <ClubGovernancePanel club={club} tenantId={tenantId} onRefresh={onRefresh} />;
}

export default function ClubOverviewTab({ club, tenantId, onRefresh }) {
  const { user } = useAuth();
  const fullAccess = canViewFullClubMembers(user, club);

  const stats = useMemo(
    () => getClubStats(club.id, tenantId),
    [club.id, tenantId]
  );

  const topPlayers = useMemo(() => {
    if (!fullAccess) return [];
    const ratings = getClubRatings(club.id, tenantId);
    const players = getTenantPlayers(tenantId);
    const byId = new Map(players.map((p) => [p.id, p]));

    return [...ratings]
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 5)
      .map((r) => ({
        ...r,
        name: byId.get(r.playerId)?.name || r.playerId,
      }));
  }, [club.id, tenantId, fullAccess]);

  const recentActivity = useMemo(() => {
    if (!fullAccess) return [];
    return getRecentClubActivity(club.id, tenantId, 8);
  }, [club.id, tenantId, fullAccess]);

  const levelDistribution = useMemo(() => {
    if (!fullAccess) return [];
    const members = getClubMembers(club.id, tenantId).filter(
      (m) => m.status === CLUB_MEMBER_STATUSES.ACTIVE
    );
    const players = getTenantPlayers(tenantId);
    const byId = new Map(players.map((p) => [p.id, p]));
    const buckets = {};

    for (const m of members) {
      const level = byId.get(m.playerId)?.level;
      const key = level != null ? String(level) : "Chưa có";
      buckets[key] = (buckets[key] || 0) + 1;
    }

    return Object.entries(buckets).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [club.id, tenantId, fullAccess]);

  if (!stats) {
    return <Typography color="text.secondary">Không có dữ liệu thống kê.</Typography>;
  }

  const cards = fullAccess
    ? [
        { label: "Tổng thành viên", value: stats.memberCount },
        { label: "Thành viên active", value: stats.activeMemberCount },
        { label: "ELO trung bình", value: stats.avgElo || "—" },
        { label: "ELO cao nhất", value: stats.maxElo || "—" },
        { label: "ELO thấp nhất", value: stats.minElo || "—" },
        { label: "Số trận đã chơi", value: stats.totalMatchesPlayed },
        { label: "Giải nội bộ", value: stats.tournamentCount },
        { label: "Ngày tạo", value: new Date(club.createdAt).toLocaleDateString("vi-VN") },
      ]
    : [
        { label: "Số thành viên", value: stats.memberCount },
        { label: "Giải nội bộ", value: stats.tournamentCount },
        { label: "Ngày tạo", value: new Date(club.createdAt).toLocaleDateString("vi-VN") },
      ];

  return (
    <Box>
      <GovernanceSection club={club} tenantId={tenantId} onRefresh={onRefresh} />

      {!fullAccess && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Bạn chỉ xem thông tin tóm tắt CLB. Chi tiết thành viên và ELO chỉ dành cho Chủ tịch /
          Chủ sở hữu CLB.
        </Typography>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((card) => (
          <Grid key={card.label} size={{ xs: 6, sm: 4, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary">
                  {card.label}
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {card.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {fullAccess && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Top 5 ELO cao nhất
              </Typography>
              {topPlayers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Chưa có dữ liệu ELO.
                </Typography>
              ) : (
                <List dense>
                  {topPlayers.map((p, index) => (
                    <ListItem key={p.playerId}>
                      <ListItemText
                        primary={`${index + 1}. ${p.name}`}
                        secondary={`ELO: ${p.elo}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Phân bổ trình độ
              </Typography>
              {levelDistribution.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Chưa có thành viên.
                </Typography>
              ) : (
                <List dense>
                  {levelDistribution.map(([level, count]) => (
                    <ListItem key={level}>
                      <ListItemText primary={`Level ${level}`} secondary={`${count} thành viên`} />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Hoạt động gần đây
              </Typography>
              {recentActivity.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Chưa có hoạt động.
                </Typography>
              ) : (
                <List dense>
                  {recentActivity.map((item) => (
                    <ListItem key={`${item.kind}-${item.id}`}>
                      <ListItemText
                        primary={item.label}
                        secondary={new Date(item.at).toLocaleString("vi-VN")}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
