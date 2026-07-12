import { Alert } from "@mui/material";

export default function V5ShadowNotice() {
  return (
    <Alert severity="info" data-testid="v5-shadow-notice" sx={{ mb: 2 }}>
      Đây là kết quả thử nghiệm Rating V5 ở chế độ shadow.
      Kết quả này chưa thay thế rating V2 hiện tại.
    </Alert>
  );
}
