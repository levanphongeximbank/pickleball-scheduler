import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import ConstructionIcon from "@mui/icons-material/Construction";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { resolveComingSoonModule } from "../config/navigationConfig.js";

export default function ComingSoonPage() {
  const { moduleKey = "" } = useParams();
  const module = resolveComingSoonModule(moduleKey);

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", py: { xs: 2, md: 4 } }}>
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={2.5} alignItems="flex-start">
            <Chip
              icon={<ConstructionIcon />}
              label="Tính năng đang được phát triển"
              color="warning"
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />

            <Box>
              <Typography variant="h5" fontWeight={900} gutterBottom>
                {module.title}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {module.description}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Module này thuộc lộ trình V5.1/V5.2. Bạn có thể quay lại Dashboard và tiếp tục
                dùng các tính năng đã sẵn sàng.
              </Typography>
            </Box>

            <Button
              component={RouterLink}
              to="/dashboard"
              variant="contained"
              startIcon={<ArrowBackIcon />}
              sx={{ fontWeight: 800 }}
            >
              Quay lại Dashboard
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
