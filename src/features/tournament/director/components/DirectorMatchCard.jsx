import { Grid } from "@mui/material";

import MatchListPanel from "../../../../components/tournament/MatchListPanel.jsx";

function changeCourtAction(isDaily, readOnly, onChangeCourt, match) {
  if (!isDaily || readOnly || !onChangeCourt) return undefined;
  return [
    {
      label: "Đổi sân",
      onClick: () => onChangeCourt(match),
    },
  ];
}

export default function DirectorMatchBoard({
  isDaily = false,
  readOnly = false,
  waitingMatches,
  assignedMatches = [],
  onCourtMatches,
  completedMatches,
  buildRefereeCardProps,
  onAssignCourt,
  onStartMatch,
  onCancelMatch,
  onChangeCourt,
  onOpenScore,
  onCorrectScore,
  onOpenRefereeDialog,
  onOpenAuditHistory,
  hasSupabaseConfig = false,
}) {
  const columnSize = isDaily ? { xs: 12, md: 3 } : { xs: 12, md: 4 };
  const live = isDaily && !readOnly;

  return (
    <Grid container spacing={2}>
      <Grid size={columnSize}>
        <MatchListPanel
          title="Trận chờ"
          matches={waitingMatches}
          emptyText="Không có trận chờ."
          getCardProps={(match) =>
            buildRefereeCardProps(match, {
              actionLabel: live ? "Xếp sân" : undefined,
              onAction: live ? onAssignCourt : undefined,
              secondaryActionLabel: live ? "Hủy trận" : undefined,
              onSecondaryAction: live ? onCancelMatch : undefined,
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
                actionLabel: live ? "Bắt đầu trận" : undefined,
                onAction: live ? onStartMatch : undefined,
                secondaryActionLabel: live ? "Hủy trận" : undefined,
                onSecondaryAction: live ? onCancelMatch : undefined,
                tertiaryActionLabel:
                  live && hasSupabaseConfig
                    ? match.referee?.token
                      ? "Link trọng tài"
                      : "Gán trọng tài"
                    : undefined,
                onTertiaryAction:
                  live && hasSupabaseConfig ? onOpenRefereeDialog : undefined,
                extraActions: changeCourtAction(isDaily, readOnly, onChangeCourt, match),
                showRefereeStatus: live && hasSupabaseConfig,
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
              actionLabel: live ? "Nhập điểm" : undefined,
              onAction: live ? onOpenScore : undefined,
              secondaryActionLabel: live
                ? hasSupabaseConfig
                  ? match.referee?.token
                    ? "Link trọng tài"
                    : "Gán trọng tài"
                  : isDaily
                    ? "Hủy trận"
                    : undefined
                : undefined,
              onSecondaryAction: live
                ? hasSupabaseConfig
                  ? onOpenRefereeDialog
                  : isDaily
                    ? onCancelMatch
                    : undefined
                : undefined,
              tertiaryActionLabel: "Lịch sử trận",
              onTertiaryAction: onOpenAuditHistory,
              extraActions: changeCourtAction(isDaily, readOnly, onChangeCourt, match),
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
