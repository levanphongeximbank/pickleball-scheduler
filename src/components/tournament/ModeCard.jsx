import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { touchButtonSx } from "./mobileUi.js";

export default function ModeCard({
  title,
  description,
  icon,
  color = "primary.main",
  badge,
  onStart,
  disabled = false,
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderColor: "divider",
        transition: "border-color 0.2s, box-shadow 0.2s",
        "&:hover": disabled
          ? undefined
          : {
              borderColor: color,
              boxShadow: 2,
            },
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Box
            sx={{
              width: { xs: 44, sm: 48 },
              height: { xs: 44, sm: 48 },
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: `${color}14`,
              color,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ lineHeight: 1.3, fontSize: { xs: "1.05rem", sm: "1.25rem" } }}
              >
                {title}
              </Typography>
              {badge && <Chip size="small" label={badge} color="default" />}
            </Stack>
          </Box>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {description}
        </Typography>
      </CardContent>
      <CardActions sx={{ p: { xs: 2, sm: 2.5 }, pt: 0 }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          endIcon={<ChevronRightIcon />}
          onClick={onStart}
          disabled={disabled}
          sx={touchButtonSx}
        >
          Bắt đầu
        </Button>
      </CardActions>
    </Card>
  );
}
