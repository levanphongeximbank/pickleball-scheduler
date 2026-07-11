import { Chip } from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import StarIcon from "@mui/icons-material/Star";
import GroupsIcon from "@mui/icons-material/Groups";

const CONFIG = {
  president: { label: "Chủ tịch", color: "warning", Icon: StarIcon },
  vice: { label: "Phó chủ tịch", color: "primary", Icon: GroupsIcon },
  owner: { label: "Chủ sở hữu", color: "secondary", Icon: WorkspacePremiumIcon },
  member: { label: "Thành viên", color: "default", Icon: GroupsIcon },
};

export default function GovernanceRoleChip({ role = "member", label, size = "small", sx = {} }) {
  const cfg = CONFIG[role] || CONFIG.member;
  const text = label || cfg.label;
  const Icon = cfg.Icon;

  return (
    <Chip
      size={size}
      icon={<Icon fontSize="small" aria-hidden />}
      label={text}
      color={cfg.color}
      variant={role === "member" ? "outlined" : "filled"}
      sx={sx}
      aria-label={text}
    />
  );
}
