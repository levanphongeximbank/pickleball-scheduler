import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { Box, Button, Container, Stack, Typography } from "@mui/material";

import { PUBLIC_COLORS, publicSectionSx } from "../../components/public/publicPortalStyles.js";
import { PublicUnavailableState } from "../../components/public/states/index.js";
import { usePublicDocumentTitle } from "../../components/public/usePublicDocumentTitle.js";
import { PUBLIC_PORTAL_MISSING_ID_USER_MESSAGE } from "../../features/public-portal/runtime/constants.js";

/**
 * Honest public not-found for unknown /clubs/:id or /courts/:id identifiers.
 * Does not invent catalog records or redirect silently into authenticated shells.
 */
export default function PublicCatalogNotFoundPage({ kind = "club" }) {
  const params = useParams();
  const navigate = useNavigate();
  const isCourt = kind === "court";
  const listPath = isCourt ? "/courts" : "/clubs";
  const title = isCourt ? "Không tìm thấy sân công khai" : "Không tìm thấy CLB công khai";
  const idLabel = String(params.publicId || "").trim();

  usePublicDocumentTitle(title);

  return (
    <Box sx={{ ...publicSectionSx, pt: { xs: 4, md: 6 } }}>
      <Container maxWidth="md">
        <PublicUnavailableState
          title={title}
          message={PUBLIC_PORTAL_MISSING_ID_USER_MESSAGE}
          actionLabel={isCourt ? "Về danh sách sân" : "Về danh sách CLB"}
          onAction={() => navigate(listPath)}
        />
        <Stack spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
          {idLabel ? (
            <Typography variant="caption" color={PUBLIC_COLORS.textMuted}>
              Mã công khai: {idLabel}
            </Typography>
          ) : null}
          <Button
            component={RouterLink}
            to="/home"
            variant="text"
            sx={{ textTransform: "none", minHeight: 44 }}
          >
            Về trang chủ công khai
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
