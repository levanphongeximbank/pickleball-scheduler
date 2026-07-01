import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Stack,
  Typography,
} from "@mui/material";
import PreviewIcon from "@mui/icons-material/Preview";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

export default function AiSuggestionCard({
  title,
  impact,
  reasons = [],
  warnings = [],
  explanation = "",
  actionPlan = "",
  previewContent = null,
  canApply = true,
  loading = false,
  onPreview,
  onApply,
  onDismiss,
  applyRequiresPreview = true,
}) {
  const [previewed, setPreviewed] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handlePreview = () => {
    setPreviewed(true);
    setShowPreview(true);
    onPreview?.();
  };

  const canClickApply = canApply && (!applyRequiresPreview || previewed);

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        {impact && <Chip size="small" label={impact} color="primary" variant="outlined" />}
      </Stack>

      <Stack spacing={0.5} sx={{ mt: 1, mb: 1.5 }}>
        {reasons.map((reason) => (
          <Typography key={reason} variant="body2" color="text.secondary">
            {reason}
          </Typography>
        ))}
      </Stack>

      {warnings.map((warning) => (
        <Alert key={warning} severity="warning" sx={{ mb: 1 }}>
          {warning}
        </Alert>
      ))}

      {explanation && (
        <Box sx={{ mb: 1.25, p: 1.25, borderRadius: 1, bgcolor: "grey.50", border: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.4 }}>
            Giải thích AI
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {explanation}
          </Typography>
        </Box>
      )}

      {actionPlan && (
        <Box sx={{ mb: 1.25, p: 1.1, borderRadius: 1, bgcolor: "success.50", border: "1px solid", borderColor: "success.100" }}>
          <Typography variant="subtitle2" fontWeight={700} color="success.dark" sx={{ mb: 0.4 }}>
            Hành động đề xuất
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {actionPlan}
          </Typography>
        </Box>
      )}

      <Collapse in={showPreview}>
        <Box sx={{ mb: 1.5, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
          {previewContent || (
            <Typography variant="body2" color="text.secondary">
              Xem trước đề xuất — bấm Apply để áp dụng vào giải.
            </Typography>
          )}
        </Box>
      </Collapse>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PreviewIcon />}
          onClick={handlePreview}
          disabled={loading}
        >
          Preview
        </Button>
        {canApply && (
          <Button
            size="small"
            variant="contained"
            startIcon={<CheckIcon />}
            onClick={onApply}
            disabled={loading || !canClickApply}
          >
            Apply
          </Button>
        )}
        {canApply && (
          <Button
            size="small"
            color="inherit"
            startIcon={<CloseIcon />}
            onClick={onDismiss}
            disabled={loading}
          >
            Dismiss
          </Button>
        )}
      </Stack>

      {applyRequiresPreview && !previewed && canApply && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Bấm Preview trước khi Apply.
        </Typography>
      )}
    </Box>
  );
}
