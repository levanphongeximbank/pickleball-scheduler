import {
  Alert,
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";

const SEVERITY_MAP = {
  success: "success",
  warning: "warning",
  info: "info",
};

export default function OperationalInsightsPanel({ insights = [] }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <LightbulbOutlinedIcon color="warning" />
          <Typography variant="h6" fontWeight="bold">
            Gợi ý vận hành
          </Typography>
        </Stack>

        {!insights.length ? (
          <Typography color="text.secondary">
            Chưa có insight — thêm dữ liệu vận hành để nhận gợi ý tự động.
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {insights.map((insight, index) => (
              <Alert
                key={`${insight.type}-${index}`}
                severity={SEVERITY_MAP[insight.severity] || "info"}
                sx={{ alignItems: "flex-start" }}
              >
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    {insight.text}
                  </Typography>
                  {insight.action && (
                    <Typography variant="caption" color="text.secondary">
                      {insight.action}
                    </Typography>
                  )}
                </Box>
              </Alert>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
