import { Grid, Skeleton, Stack } from "@mui/material";

export default function ClubDiscoverSkeleton({ count = 3 }) {
  return (
    <Grid container spacing={2} aria-busy="true" aria-label="Đang tải danh sách CLB">
      {Array.from({ length: count }).map((_, index) => (
        <Grid item xs={12} md={6} key={index}>
          <Stack direction="row" spacing={2} sx={{ p: 2, borderRadius: 2, border: 1, borderColor: "divider" }}>
            <Skeleton variant="circular" width={48} height={48} />
            <Stack spacing={1} sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={28} />
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="rounded" width={120} height={32} />
            </Stack>
          </Stack>
        </Grid>
      ))}
    </Grid>
  );
}
