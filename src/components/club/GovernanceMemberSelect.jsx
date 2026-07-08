import { FormControl, InputLabel, ListItemText, MenuItem, Select } from "@mui/material";

export default function GovernanceMemberSelect({
  label,
  value,
  onChange,
  candidates = [],
  allowEmpty = false,
  emptyLabel = "Chưa chọn",
  disabled = false,
  required = false,
  helperCandidatesEmpty = "Chưa có thành viên có tài khoản liên kết.",
}) {
  return (
    <FormControl fullWidth required={required} disabled={disabled}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        label={label}
        displayEmpty={allowEmpty}
      >
        {allowEmpty && (
          <MenuItem value="">
            <em>{emptyLabel}</em>
          </MenuItem>
        )}
        {candidates.length === 0 && (
          <MenuItem disabled>{helperCandidatesEmpty}</MenuItem>
        )}
        {candidates.map((candidate) => (
          <MenuItem key={candidate.userId} value={candidate.userId}>
            <ListItemText
              primary={candidate.displayName}
              secondary={candidate.userId}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
