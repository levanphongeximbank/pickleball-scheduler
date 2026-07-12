import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from "@mui/material";

import { resolveQuestionDisplay } from "../constants/terminology.js";

export default function V5AssessmentQuestionCard({
  question,
  value,
  onChange,
  disabled = false,
}) {
  const display = resolveQuestionDisplay(question);
  if (!display) return null;

  return (
    <Paper sx={{ p: 3 }} data-testid="v5-question-card">
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          {display.displayPrompt}
        </Typography>
        <FormControl component="fieldset" disabled={disabled}>
          <FormLabel component="legend">Chọn mức mô tả phù hợp nhất</FormLabel>
          <RadioGroup
            value={value ?? ""}
            onChange={(event) => onChange(Number(event.target.value))}
          >
            {display.displayAnchors.map((anchorText, index) => (
              <FormControlLabel
                key={`${display.id}-anchor-${index}`}
                value={index}
                control={<Radio />}
                label={anchorText}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </Stack>
    </Paper>
  );
}
