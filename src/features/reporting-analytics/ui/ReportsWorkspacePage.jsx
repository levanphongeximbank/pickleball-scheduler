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
  REPORTING_PERMISSIONS,
  REPORTING_PRESENTATION_SOURCE_STATE,
  getReportingPresentationSourceStateLabel,
} from "../index.js";
import { useReportsWorkspace } from "./useReportsWorkspace.js";

function StateBlock({ title, sourceState, error, emptyLabel, children }) {
  const state = sourceState?.state || REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE;
  const label =
    sourceState?.label || getReportingPresentationSourceStateLabel(state);

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
        {sourceState?.reason && (
          <Typography variant="caption" color="text.secondary" component="span">
            {sourceState.reason}
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
          Tính năng Reporting chưa có runtime được inject an toàn. Không dùng mock hoặc
          bộ nhớ trình duyệt để giả lập lưu trữ bền vững.
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
        Không gian Reporting trung thực — không gắn LIVE khi runtime chưa triển khai.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          label={
            runtime.available
              ? "Runtime AVAILABLE"
              : `Runtime UNAVAILABLE${runtime.reason ? `: ${runtime.reason}` : ""}`
          }
          color={runtime.available ? "success" : "default"}
          variant="outlined"
          role="status"
          aria-label={
            runtime.available
              ? "Reporting runtime khả dụng"
              : "Reporting runtime chưa khả dụng"
          }
        />
        <Chip
          size="small"
          label={
            visibility.canExecuteReport
              ? "Có quyền execute"
              : `Thiếu ${REPORTING_PERMISSIONS.REPORT_EXECUTE}`
          }
          variant="outlined"
        />
        <Chip
          size="small"
          label={
            visibility.canSaveReport
              ? "Có quyền save report"
              : `Thiếu ${REPORTING_PERMISSIONS.REPORT_SAVE}`
          }
          variant="outlined"
        />
        <Chip
          size="small"
          label={
            visibility.canExportReport
              ? "Có quyền export"
              : `Thiếu ${REPORTING_PERMISSIONS.REPORT_EXPORT}`
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
        emptyLabel="Chưa có report definition nào."
      >
        <List dense>
          {(workspace.definitions.items || []).map((item) => (
            <ListItem key={item.reportDefinitionId || item.id} divider>
              <ListItemText
                primary={item.title || item.name || item.reportDefinitionId}
                secondary={[
                  item.scope?.kind ? `Scope: ${item.scope.kind}` : null,
                  item.source?.kind ? `Source: ${item.source.kind}` : null,
                  item.requiredPermission || item.permission || null,
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
        emptyLabel="Chưa có saved report."
      >
        <List dense>
          {(workspace.savedReports.items || []).map((item) => (
            <ListItem key={item.savedReportId || item.id} divider>
              <ListItemText
                primary={item.name || item.title || item.savedReportId}
                secondary={
                  item.expectedVersion != null
                    ? `version ${item.expectedVersion}`
                    : item.version != null
                      ? `version ${item.version}`
                      : null
                }
              />
            </ListItem>
          ))}
        </List>
        {!visibility.canSaveReport && (
          <Typography variant="body2" color="text.secondary" role="status">
            Nút lưu bị ẩn vì thiếu quyền trình bày — authorization dịch vụ vẫn là biên giới cuối.
          </Typography>
        )}
      </StateBlock>

      <StateBlock
        title="Bộ lọc đã lưu"
        sourceState={workspace.savedFilters.sourceState}
        error={workspace.savedFilters.error}
        emptyLabel="Chưa có saved filter."
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

      <Box sx={{ mb: 3 }} role="region" aria-label="Execution và export">
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
          Execution & Export
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
              Không hiện nút execute — thiếu {REPORTING_PERMISSIONS.REPORT_EXECUTE}.
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
              Không hiện nút export — thiếu {REPORTING_PERMISSIONS.REPORT_EXPORT}.
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
            Execution: {workspace.execution.lifecycle.label}
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
            Export: {workspace.exportJob.lifecycle.label}
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
