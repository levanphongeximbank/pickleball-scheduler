import { Card, CardContent, Stack, Typography } from "@mui/material";

export default function CourtManagementFuturePanel({ title, description }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Module ─æang chuß║⌐n bß╗ï ΓÇö sß║╜ t├¡ch hß╗úp sau khi nß╗ün booking ß╗òn ─æß╗ïnh.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
