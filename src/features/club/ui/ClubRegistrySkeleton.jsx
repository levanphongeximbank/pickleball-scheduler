import { Box, Skeleton, Stack } from "@mui/material";

export default function ClubRegistrySkeleton() {
  return (
    <Box aria-busy="true" aria-label="Đang tải sổ đăng ký CLB">
      <Skeleton variant="text" width="40%" height={40} />
      <Skeleton variant="rounded" height={72} sx={{ mt: 2 }} />
      <Skeleton variant="rounded" height={320} sx={{ mt: 2 }} />
    </Box>
  );
}
