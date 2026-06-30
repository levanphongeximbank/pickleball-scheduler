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
  hasSupabaseConfig,
}) {
  return (
    <Grid size={{ xs: 12, lg: 8 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <MatchListPanel
            title="Tran cho"
            matches={waitingMatches}
            emptyText="Khong co tran cho."
            getCardProps={(match) =>
              buildRefereeCardProps(match, {
                actionLabel: "Xếp sân",
                onAction: onAssignCourt,
              })
            }
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MatchListPanel
            title="Dang danh"
            matches={onCourtMatches}
            emptyText="Khong co tran tren san."
            chipColor="success"
            getCardProps={(match) =>
              buildRefereeCardProps(match, {
                actionLabel: "Nhập điểm",
                onAction: onOpenScore,
                secondaryActionLabel: hasSupabaseConfig()
                  ? match.referee?.token
                    ? "Link trọng tài"
                    : "Gán trọng tài"
                  : undefined,
                onSecondaryAction: hasSupabaseConfig() ? onOpenRefereeDialog : undefined,
                tertiaryActionLabel: "Lịch sử trận",
                onTertiaryAction: onOpenAuditHistory,
              })
            }
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MatchListPanel
            title="Da xong"
            matches={completedMatches.slice(0, 8)}
            emptyText="Chua co tran hoan tat."
            getCardProps={(match) =>
              buildRefereeCardProps(match, {
                tertiaryActionLabel: "Lịch sử trận",
                onTertiaryAction: onOpenAuditHistory,
              })
            }
          />
        </Grid>
      </Grid>
    </Grid>
  );
}
