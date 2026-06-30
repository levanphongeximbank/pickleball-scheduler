import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

export default function PlayerStatsPanel({
  playerStats,
  playerNameById,
  recentSessions,
  topPartners,
  topOpponents,
}) {
  return (
    <>
      <Grid size={{ xs: 12, md: 7 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              🏓 Thống kê người chơi
            </Typography>
            {playerStats.length === 0 ? (
              <Typography color="text.secondary">Chưa có dữ liệu lịch sử.</Typography>
            ) : (
              playerStats.map((player) => {
                const topPartner = [...player.partners].sort((a, b) => b[1] - a[1])[0];
                const topOpponent = [...player.opponents].sort((a, b) => b[1] - a[1])[0];

                return (
                  <Box key={player.id} sx={{ py: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
                      <Typography fontWeight="bold">{player.name}</Typography>
                      <Chip label={`${player.games} trận`} color="primary" size="small" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Đồng đội nhiều nhất: {topPartner ? `${playerNameById[topPartner[0]] || topPartner[0]} (${topPartner[1]})` : "-"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Đối thủ nhiều nhất: {topOpponent ? `${playerNameById[topOpponent[0]] || topOpponent[0]} (${topOpponent[1]})` : "-"}
                    </Typography>
                    <Divider sx={{ mt: 1 }} />
                  </Box>
                );
              })
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 5 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              🗂️ Phiên gần nhất
            </Typography>

            {recentSessions.length === 0 ? (
              <Typography color="text.secondary">Chưa có session nào.</Typography>
            ) : (
              recentSessions.map((session) => (
                <Box key={session.id} sx={{ py: 0.8 }}>
                  <Typography fontWeight="bold">
                    {new Date(session.date).toLocaleString("vi-VN")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {session.meta?.roundName || "Round tự do"} {session.meta?.shiftLabel ? `• ${session.meta.shiftLabel}` : ""}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sân: {session.courts?.length || 0} • Chờ: {session.waiting?.length || 0} • AI: {session.aiScore?.total || 0}
                  </Typography>
                  <Divider sx={{ mt: 1 }} />
                </Box>
              ))
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              🔁 Top đồng đội & đối thủ
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography fontWeight="bold" sx={{ mb: 1 }}>
                  Đồng đội thường gặp
                </Typography>
                {topPartners.length === 0 ? (
                  <Typography color="text.secondary">Chưa có dữ liệu đồng đội.</Typography>
                ) : (
                  topPartners.map((item) => (
                    <Box key={`${item.playerName}-${item.partnerId}`} sx={{ display: "flex", justifyContent: "space-between", py: 0.4 }}>
                      <Typography>{item.playerName} → {item.partnerName}</Typography>
                      <Typography color="primary.main" fontWeight="bold">{item.count}</Typography>
                    </Box>
                  ))
                )}
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Typography fontWeight="bold" sx={{ mb: 1 }}>
                  Đối thủ thường gặp
                </Typography>
                {topOpponents.length === 0 ? (
                  <Typography color="text.secondary">Chưa có dữ liệu đối thủ.</Typography>
                ) : (
                  topOpponents.map((item) => (
                    <Box key={`${item.playerName}-${item.opponentId}`} sx={{ display: "flex", justifyContent: "space-between", py: 0.4 }}>
                      <Typography>{item.playerName} vs {item.opponentName}</Typography>
                      <Typography color="error.main" fontWeight="bold">{item.count}</Typography>
                    </Box>
                  ))
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </>
  );
}
