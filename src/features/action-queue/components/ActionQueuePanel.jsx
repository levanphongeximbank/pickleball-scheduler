import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Box,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";

import { buildActionQueue } from "../services/actionQueueService.js";

const PRIORITY_COLOR = {
  high: "error",
  medium: "warning",
  low: "default",
};

export default function ActionQueuePanel({ clubId }) {
  const items = useMemo(() => buildActionQueue({ clubId }), [clubId]);

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "100%" }}>
      <Typography fontWeight={700} sx={{ mb: 1 }}>
        Việc cần xử lý
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Không có việc chờ — hệ thống ổn định.
        </Typography>
      ) : (
        <List dense disablePadding>
          {items.slice(0, 8).map((item) => (
            <ListItemButton
              key={item.id}
              component={RouterLink}
              to={item.path}
              sx={{ borderRadius: 1, mb: 0.5 }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {item.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={item.priority === "high" ? "Gấp" : "Chờ"}
                      color={PRIORITY_COLOR[item.priority] || "default"}
                      sx={{ height: 20, fontSize: 10 }}
                    />
                  </Box>
                }
                secondary={item.subtitle}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );
}
