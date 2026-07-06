import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { touchButtonSx } from "./mobileUi.js";
import {
  tournamentCardContentSx,
  tournamentCardHoverSx,
  tournamentCardSx,
  tournamentModeAccent,
} from "./tournamentLayout.js";

export default function ModeCard({
  title,
  description,
  icon,
  color,
  mode,
  badge,
  onStart,
  disabled = false,
}) {
  const theme = useTheme();
  const accent = mode ? tournamentModeAccent(mode) : { color: color || "primary.main", bg: theme.shell?.accentLight || "#ECFDF5" };
  const accentColor = color || accent.color;
  const accentBg = mode ? accent.bg : `${accentColor}14`;

  return (
    <Card
      variant="outlined"
      elevation={0}
      sx={{
        ...tournamentCardSx,
        ...(!disabled ? tournamentCardHoverSx : {}),
        height: "100%",
        display: "flex",
        flexDirection: "column",
        "&:hover": disabled
          ? undefined
          : {
              ...tournamentCardHoverSx["&:hover"],
              borderColor: accentColor,
            },
      }}
    >
      <CardContent sx={{ ...tournamentCardContentSx, flexGrow: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: accentBg,
              color: accentColor,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography
                fontWeight={700}
                sx={{ lineHeight: 1.3, fontSize: { xs: "1.05rem", sm: "1.15rem" } }}
              >
                {title}
              </Typography>
              {badge ? <Chip size="small" label={badge} variant="outlined" /> : null}
            </Stack>
          </Box>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {description}
        </Typography>
      </CardContent>
      <CardActions sx={{ ...tournamentCardContentSx, pt: 0 }}>
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
