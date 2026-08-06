import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Autocomplete,
  Box,
  Chip,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";
import {
  buildCanonicalSearchIndex,
  filterCanonicalSearchResults,
} from "../services/buildCanonicalSearchIndex.js";
import { filterCanonicalMenu } from "../services/filterCanonicalMenu.js";

/**
 * Figure 1 global search — canonical registry only (RBAC + permission filtered).
 */
export default function CanonicalGlobalSearch({ maxWidth = 520, size = "small" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const auth = useAuth();
  const { palette, isMobile } = useCanonicalShell();
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);

  const viewport = isMobile ? "mobile" : "desktop";
  const menuTree = useMemo(
    () => filterCanonicalMenu(auth, { viewport }),
    [auth, viewport]
  );

  const allOptions = useMemo(
    () =>
      buildCanonicalSearchIndex(auth, {
        viewport,
        tree: menuTree,
        pathname: location.pathname,
        params,
      }),
    [auth, viewport, menuTree, location.pathname, params]
  );

  const options = useMemo(
    () => filterCanonicalSearchResults(allOptions, inputValue),
    [allOptions, inputValue]
  );

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
      isOptionEqualToValue={(a, b) => a.key === b.key}
      filterOptions={(x) => x}
      groupBy={(option) => option.group || ""}
      noOptionsText="Không có kết quả"
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.key}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {option.label}
              {option.badge?.label ? (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ ml: 1, color: "text.secondary", fontWeight: 600 }}
                >
                  {option.badge.label}
                </Typography>
              ) : null}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {option.path}
            </Typography>
          </Box>
        </Box>
      )}
      renderInput={(paramsInput) => {
        const autocompleteInputProps = paramsInput.InputProps ?? {};
        return (
          <TextField
            {...paramsInput}
            inputRef={inputRef}
            placeholder="Tìm kiếm..."
            inputProps={{
              ...paramsInput.inputProps,
              "aria-label": "Tìm kiếm điều hướng canonical",
              "data-testid": "canonical-global-search-input",
            }}
            InputProps={{
              ...autocompleteInputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: palette.textSecondary, fontSize: 18 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <>
                  {autocompleteInputProps.endAdornment}
                  {!isMobile ? (
                    <InputAdornment position="end">
                      <Chip
                        label="Ctrl K"
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: 11,
                          fontWeight: 700,
                          bgcolor: palette.workspaceSurface,
                          color: palette.textSecondary,
                        }}
                      />
                    </InputAdornment>
                  ) : null}
                </>
              ),
            }}
            sx={{
              width: "100%",
              maxWidth,
              "& .MuiOutlinedInput-root": {
                bgcolor: palette.workspaceSurface,
                borderRadius: 2,
                "& fieldset": { borderColor: palette.topbarBorder },
              },
            }}
          />
        );
      }}
      sx={{ width: "100%", maxWidth }}
      data-testid="canonical-global-search"
    />
  );
}
