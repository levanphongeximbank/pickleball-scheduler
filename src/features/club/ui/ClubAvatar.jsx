import { Avatar } from "@mui/material";

import { clubAvatarColor, clubInitials } from "../../../pages/player/myClub/myClubUiStyles.js";

export default function ClubAvatar({ name = "", size = 48, sx = {} }) {
  const initials = clubInitials(name);
  const bgcolor = clubAvatarColor(name);
  const dim = typeof size === "number" ? size : 48;

  return (
    <Avatar
      aria-label={`Logo ${name || "CLB"}`}
      sx={{
        width: dim,
        height: dim,
        bgcolor,
        fontWeight: 700,
        fontSize: dim >= 56 ? "1.25rem" : "1rem",
        ...sx,
      }}
    >
      {initials}
    </Avatar>
  );
}
