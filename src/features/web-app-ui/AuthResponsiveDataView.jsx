/**
 * AuthResponsiveDataView — authenticated responsive data pattern (Wave 2 Batch 2D).
 *
 * Adapted from mobile ResponsiveDataView ideas without importing that feature module.
 * Domain supplies columns, rows, and optional mobile renderer.
 * Does NOT adopt DataGrid.
 *
 * @ownership AUTHENTICATED_SHARED
 */

import { Box, Card, CardContent, Stack, Typography, useTheme } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";

import AuthEmptyState from "./AuthEmptyState.jsx";
import AuthErrorState from "./AuthErrorState.jsx";
import AuthLoadingState from "./AuthLoadingState.jsx";

/**
 * @typedef {{ field: string, headerName: string, render?: (row: object) => import('react').ReactNode }} AuthDataColumn
 */

/**
 * @param {object} props
 * @param {AuthDataColumn[]} [props.columns]
 * @param {object[]} [props.rows]
 * @param {(row: object) => string|number} [props.getRowId]
 * @param {(row: object) => import('react').ReactNode} [props.renderMobileRow]
 * @param {boolean} [props.loading]
 * @param {boolean} [props.error]
 * @param {string} [props.errorMessage]
 * @param {() => void} [props.onRetry]
 * @param {string} [props.emptyTitle]
 * @param {string} [props.emptyDescription]
 * @param {import('react').ReactNode} [props.rowActions]
 * @param {(row: object) => import('react').ReactNode} [props.renderRowActions]
 * @param {'md'|'sm'} [props.mobileBreakpoint]
 */
export default function AuthResponsiveDataView({
  columns = [],
  rows = [],
  getRowId = (row) => row.id,
  renderMobileRow,
  loading = false,
  error = false,
  errorMessage = "Không tải được danh sách.",
  onRetry,
  emptyTitle = "Không có dữ liệu",
  emptyDescription,
  renderRowActions,
  mobileBreakpoint = "md",
  sx = {},
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down(mobileBreakpoint));

  if (loading) {
    return <AuthLoadingState label="Dang tai du lieu…" />;
  }

  if (error) {
    return <AuthErrorState message={errorMessage} onRetry={onRetry} />;
  }

  if (!rows.length) {
    return (
      <AuthEmptyState
        title={emptyTitle}
        description={emptyDescription || "Chua co ban ghi nao de hien thi."}
      />
    );
  }

  if (isMobile) {
    return (
      <Stack spacing={1.5} data-testid="auth-responsive-data-mobile" sx={sx}>
        {rows.map((row) => (
          <Card key={getRowId(row)} variant="outlined" sx={{ borderRadius: 2, borderColor: "divider" }}>
            <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
              {renderMobileRow ? (
                renderMobileRow(row)
              ) : (
                <Stack spacing={0.75}>
                  {columns.map((col, index) => (
                    <Box
                      key={col.field}
                      sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 72 }}>
                        {col.headerName}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={index === 0 ? 700 : 500}
                        sx={{ textAlign: "right", flex: 1, wordBreak: "break-word" }}
                      >
                        {col.render ? col.render(row) : row[col.field]}
                      </Typography>
                    </Box>
                  ))}
                  {renderRowActions ? <Box sx={{ pt: 0.5 }}>{renderRowActions(row)}</Box> : null}
                </Stack>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }

  return (
    <Box sx={{ overflowX: "auto", width: "100%", ...sx }} data-testid="auth-responsive-data-desktop">
      <Box
        component="table"
        aria-label="Bảng dữ liệu"
        sx={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}
      >
        <Box component="thead">
          <Box component="tr">
            {columns.map((col) => (
              <Box
                component="th"
                key={col.field}
                scope="col"
                sx={{
                  textAlign: "left",
                  py: 1,
                  px: 1.5,
                  borderBottom: "2px solid",
                  borderColor: "divider",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "text.secondary",
                }}
              >
                {col.headerName}
              </Box>
            ))}
            {renderRowActions ? (
              <Box component="th" scope="col" sx={{ py: 1, px: 1.5, borderBottom: "2px solid", borderColor: "divider" }}>
                <Typography component="span" variant="caption" fontWeight={700} color="text.secondary">
                  Thao tác
                </Typography>
              </Box>
            ) : null}
          </Box>
        </Box>
        <Box component="tbody">
          {rows.map((row) => (
            <Box
              component="tr"
              key={getRowId(row)}
              sx={{ "&:hover": { bgcolor: "action.hover" } }}
            >
              {columns.map((col) => (
                <Box
                  component="td"
                  key={col.field}
                  sx={{ py: 1.25, px: 1.5, borderBottom: "1px solid", borderColor: "divider", verticalAlign: "top" }}
                >
                  {col.render ? col.render(row) : row[col.field]}
                </Box>
              ))}
              {renderRowActions ? (
                <Box component="td" sx={{ py: 1.25, px: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                  {renderRowActions(row)}
                </Box>
              ) : null}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
