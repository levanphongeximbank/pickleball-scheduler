import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import {
  BatchBError,
  BatchBLoading,
  BatchBMissingTournament,
  BatchBWrongFamily,
  ExperienceBatchBFrame,
} from "../batchB/ExperienceBatchBFrame.jsx";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceOperatorCard from "../visual/ExperienceOperatorCard.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";
import { individualExceptionsPath, individualMatchesPath, individualOverviewPath } from "../routes.js";
import { BatchFNav } from "../batchF/BatchFNav.jsx";
import {
  EventCompletionRow,
  LifecycleStepper,
  ReadinessPanel,
} from "../batchF/ExperienceBatchFSurfaces.jsx";
import { deriveCompletionModel } from "../batchF/deriveCompletion.js";

const TITLE = "Hoàn tất giải đấu";
const SUBTITLE = "Hoàn tất cấp giải đấu — không phải kết quả nội dung, không phải xóa";
const TEST_ID = "tournament-complete-page";

const IMPACT = [
  "Không tạo trận thường mới",
  "Chỉnh sửa bốc thăm / lịch thông thường bị khóa",
  "Trạng thái kết quả chính thức được công bố",
  "Trạng thái trang giải đấu công khai = Đã hoàn tất",
  "Báo cáo trở nên sẵn sàng",
  "Sửa sau cần Điều chỉnh / Mở lại",
];

export default function IndividualCompleteTournamentPage() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải mức sẵn sàng…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveCompletionModel(tournament);

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={model.tournamentName}
      actions={
        <Stack direction="row" spacing={0.75}>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
            Tổng quan
          </Button>
          <span title={model.closeReady ? "Chưa hỗ trợ hoàn tất trên màn này." : "Chưa sẵn sàng hoàn tất."}>
            <Button variant="contained" size="small" disabled onClick={() => setConfirmOpen(true)}>
              Hoàn tất giải đấu
            </Button>
          </span>
        </Stack>
      }
    >
      <BatchFNav tournamentId={tournamentId} current="complete" />
      <LifecycleStepper current="Mức sẵn sàng hoàn tất" />
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 300px" },
          gridTemplateAreas: {
            xs: `"summary" "matrix" "blockers" "readiness" "impact"`,
            lg: `"summary summary" "matrix blockers" "matrix readiness" "impact impact"`,
          },
        }}
      >
        <Box sx={{ gridArea: "summary", minWidth: 0 }}>
          <ExperienceSectionTitle>Tổng quan giải đấu</ExperienceSectionTitle>
          <Typography sx={{ fontWeight: 800, fontSize: 22, mb: 1 }}>{model.tournamentName}</Typography>
          <Grid container spacing={1.25}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <CenterKpiCard label="Tổng trận" value={model.tournamentTotalMatches} data-testid="complete-total-matches" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <CenterKpiCard label="Đã kết thúc" value={model.tournamentTerminalMatches} tone="success" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <CenterKpiCard label="Còn lại" value={model.tournamentRemainingMatches} tone={model.tournamentRemainingMatches ? "warning" : "success"} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <CenterKpiCard label="Nội dung hoàn tất" value={`${model.completedEventCount}/${model.eventCount}`} />
            </Grid>
          </Grid>
          <Box sx={{ mt: 1.25 }}>
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 0.5 }}>
              Mức sẵn sàng hoàn tất — {model.closePct}%
            </Typography>
            <LinearProgress variant="determinate" value={model.closePct} sx={{ height: 8, borderRadius: 99 }} />
          </Box>
        </Box>
        <Box sx={{ gridArea: "matrix", minWidth: 0 }}>
          <ExperienceSectionTitle>Ma trận hoàn tất nội dung</ExperienceSectionTitle>
          {!model.eventRows.length ? (
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có nội dung trên hồ sơ.</Typography>
          ) : (
            model.eventRows.map((event) => <EventCompletionRow key={event.id} event={event} />)
          )}
        </Box>
        <Box sx={{ gridArea: "blockers", minWidth: 0 }}>
          <CenterRightRailCard title={`Chặn hoàn tất (${model.blockerCount})`}>
            {!model.blockers.length ? (
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.success }}>Không có chặn trên hồ sơ.</Typography>
            ) : (
              model.blockers.map((blocker) => (
                <Alert key={blocker.id} severity="warning" sx={{ mb: 0.75, py: 0.25 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{blocker.label}</Typography>
                  <Typography sx={{ fontSize: 12 }}>{blocker.detail}</Typography>
                  {blocker.to === "matches" ? (
                    <Button size="small" sx={{ mt: 0.5, p: 0, minWidth: 0 }} onClick={() => navigate(individualMatchesPath(tournamentId))}>
                      Xem trận
                    </Button>
                  ) : null}
                  {blocker.to === "exceptions" ? (
                    <Button size="small" sx={{ mt: 0.5, p: 0, minWidth: 0 }} onClick={() => navigate(individualExceptionsPath(tournamentId))}>
                      Xem ngoại lệ
                    </Button>
                  ) : null}
                </Alert>
              ))
            )}
          </CenterRightRailCard>
        </Box>
        <Box sx={{ gridArea: "readiness", minWidth: 0 }}>
          <ReadinessPanel
            title="Điều kiện hoàn tất giải đấu"
            statusLabel={model.closeReady ? "SẴN SÀNG" : "CHƯA SẴN SÀNG"}
            items={model.readinessItems}
          />
          {model.alreadyClosed ? (
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mt: 1 }}>
              Giải đã được đóng trên hồ sơ trước đó.
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ gridArea: "impact", minWidth: 0 }}>
          <ExperienceSectionTitle>Tác động khi hoàn tất</ExperienceSectionTitle>
          <ExperienceOperatorCard>
            {IMPACT.map((line) => (
              <Typography key={line} sx={{ fontSize: 12.5, py: 0.25 }}>
                • {line}
              </Typography>
            ))}
          </ExperienceOperatorCard>
        </Box>
      </Box>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Hoàn tất giải đấu</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13 }}>
            Thao tác này chưa được hỗ trợ trên màn này. Hoàn tất giải đấu yêu cầu quyền ghi riêng trên hồ sơ.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>
    </ExperienceBatchBFrame>
  );
}
