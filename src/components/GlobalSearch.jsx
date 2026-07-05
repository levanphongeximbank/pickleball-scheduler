import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  Box,
  Chip,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { MENU_GROUPS, buildSearchableNavItems } from "../config/navigationConfig.js";
import { filterMenuGroups, resolveRouteAccessScope } from "../auth/menuAccess.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useClub } from "../context/ClubContext.jsx";
import { SHELL_COLORS } from "./shell/shellTokens.js";

export default function GlobalSearch({ size = "small", maxWidth = 420, variant = "dark" }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const { activeClubId, activeClub } = useClub();
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);
  const isLight = variant === "light";

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
    const visibleKeys = new Set(visibleGroups.flatMap((g) => g.items.map((i) => i.key)));
    return buildSearchableNavItems(visibleGroups).filter((item) => visibleKeys.has(item.key));
  }, [auth, scope]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      renderInput={(params) => {
        const autocompleteInputProps = params.InputProps ?? {};

        return (
        <TextField
          {...params}
          inputRef={inputRef}
          placeholder="Tìm kiếm..."
          InputProps={{
            ...autocompleteInputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon
                  sx={{
                    color: isLight ? SHELL_COLORS.textSecondary : "rgba(255,255,255,0.7)",
                    fontSize: 18,
                  }}
                />
              </InputAdornment>
            ),
            endAdornment: (
              <>
                {autocompleteInputProps.endAdornment}
                {!isLight ? null : (
                  <InputAdornment position="end">
                    <Chip
                      label="Ctrl K"
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: 11,
                        fontWeight: 700,
                        bgcolor: SHELL_COLORS.mintBg,
                        color: SHELL_COLORS.textSecondary,
                      }}
                    />
                  </InputAdornment>
                )}
              </>
            ),
          }}
          sx={{
            width: "100%",
            maxWidth,
            "& .MuiOutlinedInput-root": isLight
              ? {
                  bgcolor: SHELL_COLORS.pageBg,
                  borderRadius: 2,
                  "& fieldset": { borderColor: SHELL_COLORS.border },
                  "&:hover fieldset": { borderColor: "#D1D5DB" },
                  "&.Mui-focused fieldset": { borderColor: SHELL_COLORS.primaryGreen },
                }
              : {
                  bgcolor: "rgba(255,255,255,0.12)",
                  color: "common.white",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.25)" },
                  "&:hover fieldset": { borderColor: "rgba(255,255,255,0.4)" },
                  "&.Mui-focused fieldset": { borderColor: "rgba(255,255,255,0.55)" },
                },
            "& .MuiInputBase-input::placeholder": {
              color: isLight ? SHELL_COLORS.textSecondary : "rgba(255,255,255,0.65)",
              opacity: 1,
            },
          }}
        />
        );
      }}
      sx={{
        display: { xs: "block", lg: "block" },
        width: "100%",
        maxWidth,
        minWidth: { xs: 120, sm: 180, lg: 280 },
      }}
      noOptionsText="Không tìm thấy"
      clearOnBlur
      blurOnSelect
    />
  );
}
