import { Grid } from "@mui/material";

import MatchListPanel from "../../../../components/tournament/MatchListPanel.jsx";

export default function DirectorMatchBoard({
  isDaily = false,
  waitingMatches,
  assignedMatches = [],
  onCourtMatches,
  completedMatches,
  buildRefereeCardProps,
  onAssignCourt,
  onStartMatch,
  onCancelMatch,
  onOpenScore,
  onCorrectScore,
  onOpenRefereeDialog,
  onOpenAuditHistory,
  hasSupabaseConfig = false,
}) {
  const columnSize = isDaily ? { xs: 12, md: 3 } : { xs: 12, md: 4 };

  return (
    <Grid container spacing={2}>
      <Grid size={columnSize}>
        <MatchListPanel
          title="Trận chờ"
          matches={waitingMatches}
          emptyText="Không có trận chờ."
          getCardProps={(match) =>
            buildRefereeCardProps(match, {
              actionLabel: isDaily ? "Xếp sân" : "Xếp sân",
              onAction: onAssignCourt,
              secondaryActionLabel: isDaily ? "Hủy trận" : undefined,
              onSecondaryAction: isDaily ? onCancelMatch : undefined,
              showRefereeStatus: false,
            })
          }
        />
      </Grid>
      {isDaily ? (
        <Grid size={columnSize}>
          <MatchListPanel
            title="Đã xếp sân / Sẵn sàng"
            matches={assignedMatches}
            emptyText="Chưa có trận assigned."
            chipColor="info"
            getCardProps={(match) =>
              buildRefereeCardProps(match, {
                actionLabel: "Bắt đầu trận",
                onAction: onStartMatch,
                secondaryActionLabel: "Hủy trận",
                onSecondaryAction: onCancelMatch,
                tertiaryActionLabel: hasSupabaseConfig
                  ? match.referee?.token
                    ? "Link trọng tài"
                    : "Gán trọng tài"
                  : undefined,
                onTertiaryAction: hasSupabaseConfig ? onOpenRefereeDialog : undefined,
                showRefereeStatus: hasSupabaseConfig,
              })
            }
          />
        </Grid>
      ) : null}
      <Grid size={columnSize}>
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
                : isDaily
                  ? "Hủy trận"
                  : undefined,
              onSecondaryAction: hasSupabaseConfig
                ? onOpenRefereeDialog
                : isDaily
                  ? onCancelMatch
                  : undefined,
              tertiaryActionLabel: "Lịch sử trận",
              onTertiaryAction: onOpenAuditHistory,
            })
          }
        />
      </Grid>
      <Grid size={columnSize}>
        <MatchListPanel
          title="Đã xong"
          matches={completedMatches.slice(0, 8)}
          emptyText="Chưa có trận hoàn tất."
          getCardProps={(match) =>
            buildRefereeCardProps(match, {
              actionLabel: isDaily ? "Sửa điểm" : undefined,
              onAction: isDaily ? onCorrectScore : undefined,
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
