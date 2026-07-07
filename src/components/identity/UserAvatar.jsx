import { useEffect, useState } from "react";
import { Avatar } from "@mui/material";

import { SHELL_COLORS } from "../shell/shellTokens.js";
import { getUserInitials } from "./userAvatarUtils.js";

export { getUserInitials } from "./userAvatarUtils.js";

export default function UserAvatar({ user, size = 32, sx = {} }) {
  const avatarUrl = String(user?.avatarUrl || "").trim();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  const showImage = avatarUrl && !imageFailed;

  return (
    <Avatar
      src={showImage ? avatarUrl : undefined}
      alt={user?.displayName || "Avatar"}
      imgProps={{
        onError: () => setImageFailed(true),
      }}
      sx={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.4)),
        fontWeight: 800,
        bgcolor: SHELL_COLORS.primaryGreen,
        ...sx,
      }}
    >
      {getUserInitials(user)}
    </Avatar>
  );
}
