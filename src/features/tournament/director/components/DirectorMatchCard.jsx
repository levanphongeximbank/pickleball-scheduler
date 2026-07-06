import { Grid } from "@mui/material";

import MatchListPanel from "../../../../components/tournament/MatchListPanel.jsx";

export default function DirectorMatchBoard({
  waitingMatches,
  onCourtMatches,
  completedMatches,
  buildRefereeCardProps,
  onAssignCourt,
  onOpenScore,
  onOpenRefereeDialog,
  onOpenAuditHistory,
  hasSupabaseConfig = false,
}) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <MatchListPanel
          title="Trận chờ"
          matches={waitingMatches}
          emptyText="Không có trận chờ."
          getCardProps={(match) =>
            buildRefereeCardProps(match, {
              actionLabel: "Xếp sân",
              onAction: onAssignCourt,
              showRefereeStatus: false,
            })
          }
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <MatchListPanel
          title="Đang đánh"
          matches={onCourtMatches}
          emptyText="Không có trận trên sân."
          chipColor="success"
          getCardProps={(match) =>
            buildRefereeCardProps(match, {
              actionLabel: "Nhập điểm",
              onAction: onOpenScore,
              secondaryActionLabel: hasSupabaseConfig
                ? match.referee?.token
                  ? "Link trọng tài"
                  : "Gán trọng tài"
                : undefined,
              onSecondaryAction: hasSupabaseConfig ? onOpenRefereeDialog : undefined,
              tertiaryActionLabel: "Lịch sử trận",
              onTertiaryAction: onOpenAuditHistory,
            })
          }
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <MatchListPanel
          title="Đã xong"
          matches={completedMatches.slice(0, 8)}
          emptyText="Chưa có trận hoàn tất."
          getCardProps={(match) =>
            buildRefereeCardProps(match, {
              tertiaryActionLabel: "Lịch sử trận",
              onTertiaryAction: onOpenAuditHistory,
              showRefereeStatus: false,
            })
          }
        />
      </Grid>
    </Grid>
  );
}
