import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

import { useIsMobile } from "../hooks/useIsMobile.js";

/**
 * Responsive data view — table on desktop, cards on mobile.
 */
export default function ResponsiveDataView({
  columns = [],
  rows = [],
  getRowKey = (row) => row.id,
  renderCard,
  emptyMessage = "Không có dữ liệu.",
}) {
  const isMobile = useIsMobile();

  if (!rows.length) {
    return (
      <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
        {emptyMessage}
      </Typography>
    );
  }

  if (isMobile) {
    return (
      <Stack spacing={1.5}>
        {rows.map((row) => (
          <Card key={getRowKey(row)} variant="outlined" sx={{ borderRadius: 2, borderColor: "divider" }}>
            <CardContent sx={{ py: 1.1, "&:last-child": { pb: 1.1 } }}>
              {renderCard ? (
                renderCard(row)
              ) : (
                <Stack spacing={0.6}>
                  {columns.map((col, index) => (
                    <Box key={col.field} sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.2, minWidth: 72 }}>
                        {col.headerName}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={index === 0 ? 800 : 700}
                        sx={{ lineHeight: 1.35, textAlign: "right", flex: 1 }}
                      >
                        {col.render ? col.render(row) : row[col.field]}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
        <Box component="thead">
          <Box component="tr">
            {columns.map((col) => (
              <Box
                component="th"
                key={col.field}
                sx={{
                  textAlign: "left",
                  py: 1,
                  px: 1.5,
                  borderBottom: "2px solid",
                  borderColor: "divider",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {col.headerName}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {rows.map((row) => (
            <Box component="tr" key={getRowKey(row)} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
              {columns.map((col) => (
                <Box
                  component="td"
                  key={col.field}
                  sx={{ py: 1.25, px: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
                >
                  {col.render ? col.render(row) : row[col.field]}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
