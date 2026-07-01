import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

export default function ClubDeactivateDialog({ open, club, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Vô hiệu hóa CLB</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Bạn có chắc muốn vô hiệu hóa <strong>{club?.name}</strong>? CLB sẽ không hiển thị
          trong danh sách hoạt động nhưng dữ liệu vẫn được giữ.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Hủy</Button>
        <Button color="warning" variant="contained" onClick={onConfirm}>
          Vô hiệu hóa
        </Button>
      </DialogActions>
    </Dialog>
  );
}
