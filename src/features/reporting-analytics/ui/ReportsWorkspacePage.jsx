import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import {
  REPORTING_PRESENTATION_SOURCE_STATE,
  getReportingPresentationSourceStateLabel,
} from "../index.js";
import { getTechnicalReasonUserMessage } from "../../canonical-shell/config/canonicalVietnameseLabels.js";
import { useReportsWorkspace } from "./useReportsWorkspace.js";

function StateBlock({ title, sourceState, error, emptyLabel, children }) {
  const state = sourceState?.state || REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE;
  const label =
    sourceState?.label || getReportingPresentationSourceStateLabel(state);
  const reasonMessage = sourceState?.reason
    ? getTechnicalReasonUserMessage(sourceState.reason)
    : null;

  return (
    <Box
      sx={{ mb: 3 }}
      role="region"
      aria-label={title}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap">
        <Typography variant="h6" fontWeight="bold">
          {title}
        </Typography>
        <Chip size="small" label={label} variant="outlined" />
        {reasonMessage && (
          <Typography variant="caption" color="text.secondary" component="span">
            {reasonMessage}
          </Typography>
        )}
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} role="alert">
          {error}
        </Alert>
      )}
      {state === REPORTING_PRESENTATION_SOURCE_STATE.EMPTY && (
        <Typography variant="body2" color="text.secondary" role="status">
          {emptyLabel}
        </Typography>
      )}
      {state === REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE && (
        <Typography variant="body2" color="text.secondary" role="status">
          Tính năng báo cáo chưa có runtime được cấu hình an toàn. Không dùng dữ liệu giả
          hoặc bộ nhớ trình duyệt để giả lập lưu trữ bền vững.
        </Typography>
      )}
      {children}
    </Box>
  );
}

export default function ReportsWorkspacePage() {
  const { user } = useAuth();
  const { activeClub, activeClubId } = useClub();

  const tenantId =
    activeClub?.tenantId ||
    activeClub?.venueId ||
    user?.tenantId ||
    user?.venueId ||
    null;
  const ownerId = user?.id || null;
  const scope = {
    tenantId,
    clubId: activeClubId || null,
    venueId: activeClub?.venueId || user?.venueId || null,
  };

  const actor = {
    userId: ownerId,
    role: user?.role,
    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
  };

  const workspace = useReportsWorkspace({
    actor,
    ownerId,
    tenantId,
    scope,
    facade: null, // Composition root must inject; otherwise UNAVAILABLE.
  });

  const { visibility, loading, runtime } = workspace;

  return (
    <Box sx={{ maxWidth: 960 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
        Báo cáo vận hành
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Không gian báo cáo trung thực — không gắn trạng thái trực tiếp khi runtime chưa triển khai.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          label={
            runtime.available
              ? "Runtime sẵn sàng"
              : `Runtime chưa sẵn sàng${
                  runtime.reason ? `: ${getTechnicalReasonUserMessage(runtime.reason)}` : ""
                }`
          }
          color={runtime.available ? "success" : "default"}
          variant="outlined"
          role="status"
          aria-label={
            runtime.available
              ? "Runtime báo cáo khả dụng"
              : "Runtime báo cáo chưa khả dụng"
          }
        />
        <Chip
          size="small"
          label={
            visibility.canExecuteReport
              ? "Có quyền chạy báo cáo"
              : "Thiếu quyền chạy báo cáo"
          }
          variant="outlined"
        />
        <Chip
          size="small"
          label={
            visibility.canSaveReport
              ? "Có quyền lưu báo cáo"
              : "Thiếu quyền lưu báo cáo"
          }
          variant="outlined"
        />
        <Chip
          size="small"
          label={
            visibility.canExportReport
              ? "Có quyền xuất báo cáo"
              : "Thiếu quyền xuất báo cáo"
          }
          variant="outlined"
        />
      </Stack>

      {loading && (
        <Typography role="status" aria-busy="true" sx={{ mb: 2 }}>
          Đang tải không gian báo cáo…
        </Typography>
      )}

      {workspace.actionError && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {workspace.actionError}
        </Alert>
      )}

      <StateBlock
        title="Định nghĩa báo cáo"
        sourceState={workspace.definitions.sourceState}
        error={workspace.definitions.error}
        emptyLabel="Chưa có định nghĩa báo cáo nào."
      >
        <List dense>
          {(workspace.definitions.items || []).map((item) => (
            <ListItem key={item.reportDefinitionId || item.id} divider>
              <ListItemText
                primary={item.title || item.name || item.reportDefinitionId}
                secondary={[
                  item.scope?.kind ? `Phạm vi: ${item.scope.kind}` : null,
                  item.source?.kind ? `Nguồn: ${item.source.kind}` : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              />
            </ListItem>
          ))}
        </List>
      </StateBlock>

      <Divider sx={{ my: 2 }} />

      <StateBlock
        title="Báo cáo đã lưu"
        sourceState={workspace.savedReports.sourceState}
        error={workspace.savedReports.error}
        emptyLabel="Chưa có báo cáo đã lưu."
      >
        <List dense>
          {(workspace.savedReports.items || []).map((item) => (
            <ListItem key={item.savedReportId || item.id} divider>
              <ListItemText
                primary={item.name || item.title || item.savedReportId}
                secondary={
                  item.expectedVersion != null
                    ? `Phiên bản ${item.expectedVersion}`
                    : item.version != null
                      ? `Phiên bản ${item.version}`
                      : null
                }
              />
            </ListItem>
          ))}
        </List>
        {!visibility.canSaveReport && (
          <Typography variant="body2" color="text.secondary" role="status">
            Nút lưu bị ẩn vì thiếu quyền — kiểm tra quyền vẫn là biên giới cuối.
          </Typography>
        )}
      </StateBlock>

      <StateBlock
        title="Bộ lọc đã lưu"
        sourceState={workspace.savedFilters.sourceState}
        error={workspace.savedFilters.error}
        emptyLabel="Chưa có bộ lọc đã lưu."
      >
        <List dense>
          {(workspace.savedFilters.items || []).map((item) => (
            <ListItem key={item.savedFilterId || item.id} divider>
              <ListItemText
                primary={item.name || item.savedFilterId}
                secondary={item.reportDefinitionId || null}
              />
            </ListItem>
          ))}
        </List>
      </StateBlock>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 3 }} role="region" aria-label="Chạy và xuất báo cáo">
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
          Chạy & xuất báo cáo
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
          {visibility.canExecuteReport ? (
            <Button
              variant="outlined"
              size="small"
              aria-label="Chạy báo cáo"
              disabled={!runtime.available}
              onClick={() =>
                workspace.runExecution({
                  reportDefinitionId: workspace.definitions.items?.[0]?.reportDefinitionId,
                  actor,
                  scope,
                })
              }
            >
              Chạy báo cáo
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary" role="status">
              Không hiện nút chạy báo cáo — thiếu quyền.
            </Typography>
          )}
          {visibility.canExportReport ? (
            <Button
              variant="outlined"
              size="small"
              aria-label="Xuất báo cáo"
              disabled={!runtime.available}
              onClick={() =>
                workspace.runExport({
                  reportDefinitionId: workspace.definitions.items?.[0]?.reportDefinitionId,
                  actor,
                  scope,
                  format: "csv",
                })
              }
            >
              Xuất báo cáo
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary" role="status">
              Không hiện nút xuất báo cáo — thiếu quyền.
            </Typography>
          )}
          <Button
            variant="text"
            size="small"
            aria-label="Làm mới không gian báo cáo"
            onClick={() => workspace.refresh()}
          >
            Làm mới
          </Button>
        </Stack>

        {workspace.execution?.lifecycle && (
          <Alert
            severity={workspace.execution.lifecycle.showSuccess ? "success" : "info"}
            sx={{ mb: 1 }}
            role="status"
            aria-live="polite"
          >
            Kết quả chạy: {workspace.execution.lifecycle.label}
            {workspace.execution.lifecycle.errorMessage
              ? ` — ${workspace.execution.lifecycle.errorMessage}`
              : ""}
          </Alert>
        )}

        {workspace.exportJob?.lifecycle && (
          <Alert
            severity={workspace.exportJob.lifecycle.showSuccess ? "success" : "info"}
            role="status"
            aria-live="polite"
          >
            Xuất: {workspace.exportJob.lifecycle.label}
            {workspace.exportJob.lifecycle.showSuccess &&
              workspace.exportJob.lifecycle.outputHref && (
                <>
                  {" — "}
                  <a href={workspace.exportJob.lifecycle.outputHref}>
                    Tải kết quả xuất
                  </a>
                </>
              )}
            {!workspace.exportJob.lifecycle.showSuccess &&
              workspace.exportJob.lifecycle.errorMessage &&
              ` — ${workspace.exportJob.lifecycle.errorMessage}`}
          </Alert>
        )}
      </Box>
    </Box>
  );
}
