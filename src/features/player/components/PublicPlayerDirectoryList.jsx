/**
 * Phase 1I-C — Authenticated Public Player Directory list UI.
 * Calls the directory facade only through the list controller (no direct RPC).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";

import {
  createPublicDirectoryListController,
  DIRECTORY_LIST_DEBOUNCE_MS,
  DIRECTORY_LIST_UI_STATUS,
  resolveDirectorySearchInput,
} from "../utils/publicDirectoryListController.js";
import PublicDirectoryPlayerCard from "./PublicDirectoryPlayerCard.jsx";

function LoadingSkeletons() {
  return (
    <Grid container spacing={2} role="status" aria-busy="true" aria-label="Đang tải danh bạ">
      {Array.from({ length: 6 }).map((_, index) => (
        <Grid item xs={12} sm={6} md={4} key={`sk-${index}`}>
          <Skeleton variant="rounded" height={88} />
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * @param {object} [props]
 * @param {ReturnType<typeof createPublicDirectoryListController>} [props.controller]
 * @param {object} [props.searchOptions] — DI for facade (tests)
 * @param {number} [props.debounceMs]
 */
export default function PublicPlayerDirectoryList({
  controller: injectedController = null,
  searchOptions = undefined,
  debounceMs = DIRECTORY_LIST_DEBOUNCE_MS,
} = {}) {
  const controller = useMemo(
    () => injectedController || createPublicDirectoryListController(),
    [injectedController]
  );

  const [snap, setSnap] = useState(() => controller.getState());
  const [regionInput, setRegionInput] = useState("");
  const debounceRef = useRef(null);
  const regionDebounceRef = useRef(null);
  const didInitialLoad = useRef(false);

  useEffect(() => {
    return controller.subscribe(setSnap);
  }, [controller]);

  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    void controller.loadInitial(searchOptions);
  }, [controller, searchOptions]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    };
  }, []);

  const handleSearchChange = (event) => {
    const value = event.target.value;
    controller.setSearchInputLocal(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const resolved = resolveDirectorySearchInput(value);
    if (resolved.mode === "idle") {
      // One-character: do not call facade; keep current results.
      return;
    }

    debounceRef.current = setTimeout(() => {
      void controller.applySearchInput(value, searchOptions);
    }, debounceMs);
  };

  const handleClearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void controller.clearSearch(searchOptions);
  };

  const handleRegionChange = (event) => {
    const value = event.target.value;
    setRegionInput(value);
    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    regionDebounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      void controller.setActivityRegion(trimmed ? trimmed : null, searchOptions);
    }, debounceMs);
  };

  const handleClearRegion = () => {
    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    setRegionInput("");
    void controller.setActivityRegion(null, searchOptions);
  };

  const showInitialLoading =
    snap.uiStatus === DIRECTORY_LIST_UI_STATUS.INITIAL_LOADING &&
    snap.items.length === 0;
  const showResults =
    snap.items.length > 0 ||
    snap.uiStatus === DIRECTORY_LIST_UI_STATUS.READY ||
    snap.uiStatus === DIRECTORY_LIST_UI_STATUS.LOADING_MORE;

  return (
    <Box data-testid="public-player-directory-list">
      <Stack spacing={0.5} sx={{ mb: 2.5 }}>
        <Typography variant="h5" component="h1" fontWeight={700}>
          Danh bạ vận động viên
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Tìm vận động viên đã xác minh theo tên hiển thị và khu vực hoạt động.
        </Typography>
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2.5 }}
        useFlexGap
      >
        <TextField
          fullWidth
          size="small"
          label="Tìm theo tên hiển thị"
          value={snap.searchInput}
          onChange={handleSearchChange}
          inputProps={{
            "aria-label": "Tìm theo tên hiển thị",
            autoComplete: "off",
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" aria-hidden />
              </InputAdornment>
            ),
            endAdornment: snap.searchInput ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Xóa tìm kiếm"
                  onClick={handleClearSearch}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <TextField
          fullWidth
          size="small"
          label="Khu vực hoạt động"
          value={regionInput}
          onChange={handleRegionChange}
          placeholder="Ví dụ: Hà Nội"
          inputProps={{
            "aria-label": "Lọc theo khu vực hoạt động",
            autoComplete: "off",
          }}
          InputProps={{
            endAdornment: regionInput ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Xóa bộ lọc khu vực"
                  onClick={handleClearRegion}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ maxWidth: { sm: 280 } }}
        />
      </Stack>

      {snap.uiStatus === DIRECTORY_LIST_UI_STATUS.UNAUTHENTICATED ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {snap.error?.message ||
            "Vui lòng đăng nhập để xem danh bạ vận động viên."}
        </Alert>
      ) : null}

      {snap.uiStatus === DIRECTORY_LIST_UI_STATUS.ERROR && snap.error ? (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            snap.error.recoverable ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => void controller.retry(searchOptions)}
                aria-label="Thử lại tải danh bạ vận động viên"
              >
                Thử lại
              </Button>
            ) : undefined
          }
        >
          {snap.error.message}
        </Alert>
      ) : null}

      {showInitialLoading ? <LoadingSkeletons /> : null}

      {snap.uiStatus === DIRECTORY_LIST_UI_STATUS.EMPTY_BROWSE ? (
        <Alert severity="info" role="status">
          Hiện chưa có vận động viên công khai đã xác minh.
        </Alert>
      ) : null}

      {snap.uiStatus === DIRECTORY_LIST_UI_STATUS.EMPTY_SEARCH ? (
        <Alert severity="info" role="status">
          Không tìm thấy vận động viên phù hợp với tìm kiếm hoặc bộ lọc hiện tại.
        </Alert>
      ) : null}

      {showResults && snap.items.length > 0 ? (
        <>
          <Grid container spacing={2}>
            {snap.items.map((player) => (
              <Grid item xs={12} sm={6} md={4} key={player.playerId}>
                <PublicDirectoryPlayerCard player={player} />
              </Grid>
            ))}
          </Grid>

          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={1.5}
            sx={{ mt: 3 }}
          >
            {snap.uiStatus === DIRECTORY_LIST_UI_STATUS.LOADING_MORE ? (
              <Stack direction="row" spacing={1} alignItems="center" role="status">
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Đang tải thêm…
                </Typography>
              </Stack>
            ) : null}
            {snap.nextCursor &&
            snap.uiStatus !== DIRECTORY_LIST_UI_STATUS.LOADING_MORE ? (
              <Button
                variant="outlined"
                onClick={() => void controller.loadMore(searchOptions)}
                aria-label="Tải thêm vận động viên"
              >
                Tải thêm
              </Button>
            ) : null}
          </Stack>
        </>
      ) : null}
    </Box>
  );
}
