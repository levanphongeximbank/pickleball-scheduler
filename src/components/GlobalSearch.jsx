import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  Box,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { MENU_GROUPS, buildSearchableNavItems } from "../config/navigationConfig.js";
import { filterMenuGroups, resolveRouteAccessScope } from "../auth/menuAccess.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useClub } from "../context/ClubContext.jsx";

export default function GlobalSearch({ size = "small", maxWidth = 220 }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const { activeClubId, activeClub } = useClub();
  const [inputValue, setInputValue] = useState("");

  const scope = useMemo(
    () =>
      resolveRouteAccessScope({
        user: auth.user,
        activeClubId,
        activeClub,
      }),
    [activeClubId, activeClub, auth.user]
  );

  const options = useMemo(() => {
    const visibleGroups = filterMenuGroups(MENU_GROUPS, auth, scope);
    const visibleKeys = new Set(
      visibleGroups.flatMap((g) => g.items.map((i) => i.key))
    );
    return buildSearchableNavItems(visibleGroups).filter((item) =>
      visibleKeys.has(item.key)
    );
  }, [auth, scope]);

  return (
    <Autocomplete
      size={size}
      options={options}
      inputValue={inputValue}
      onInputChange={(_event, value) => setInputValue(value)}
      onChange={(_event, option) => {
        if (option?.path) {
          navigate(option.path);
          setInputValue("");
        }
      }}
      getOptionLabel={(option) => option.label || ""}
      groupBy={(option) => option.group || ""}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.key}>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {option.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {option.path}
            </Typography>
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Tìm menu..."
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "rgba(255,255,255,0.7)", fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            maxWidth,
            "& .MuiOutlinedInput-root": {
              bgcolor: "rgba(255,255,255,0.12)",
              color: "common.white",
              "& fieldset": { borderColor: "rgba(255,255,255,0.25)" },
              "&:hover fieldset": { borderColor: "rgba(255,255,255,0.4)" },
              "&.Mui-focused fieldset": { borderColor: "rgba(255,255,255,0.55)" },
            },
            "& .MuiInputBase-input::placeholder": {
              color: "rgba(255,255,255,0.65)",
              opacity: 1,
            },
          }}
        />
      )}
      sx={{ display: { xs: "none", lg: "block" }, minWidth: maxWidth }}
      noOptionsText="Không tìm thấy"
      clearOnBlur
      blurOnSelect
    />
  );
}
