import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import {
  ASSESSMENT_STEPS,
  GENDER_TO_PLAYER_LABEL,
  getQuestionsForStep,
  getTechniqueUiGroups,
  WARNING_FLAG_LABELS,
} from "../../player-rating/playerSkillAssessmentConfig.js";
import {
  calculatePlayerAssessment,
  validateAssessmentStep,
} from "../../player-rating/playerSkillAssessmentEngine.js";
import { formatPickVnRating } from "../constants/pickVnRatingScale.js";
import { RATING_STATUS_LABELS } from "../constants/ratingStatus.js";
import { completePickVnOnboarding } from "../services/pickVnRatingService.js";
import PickVnRatingBadge from "./PickVnRatingBadge.jsx";

const CONTENT_STEPS = 6;
const TOTAL_STEPS = 7;
const CURRENT_YEAR = new Date().getFullYear();
const MIN_BIRTH_YEAR = CURRENT_YEAR - 90;
const MAX_BIRTH_YEAR = CURRENT_YEAR - 8;

const WARNING_LABELS = WARNING_FLAG_LABELS;

function QuestionField({ question, answers, onChange, showWhen = true }) {
  if (!showWhen) return null;
  const value = answers[question.id];

  if (question.type === "birth_year") {
    return (
      <TextField
        fullWidth
        type="number"
        label={question.label}
        value={value ?? ""}
        inputProps={{ min: MIN_BIRTH_YEAR, max: MAX_BIRTH_YEAR }}
        onChange={(event) => onChange(question.id, event.target.value)}
      />
    );
  }

  if (question.type === "optional_number") {
    return (
      <TextField
        fullWidth
        type="number"
        label={question.label}
        value={value ?? ""}
        inputProps={{ min: 1.5, max: 6.5, step: 0.1 }}
        onChange={(event) => onChange(question.id, event.target.value)}
        helperText="Tùy chọn — tăng độ tin cậy"
      />
    );
  }

  if (question.type === "multi") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <FormControl component="fieldset" fullWidth>
        <FormLabel component="legend">{question.label}</FormLabel>
        <FormGroup>
          {(question.options || []).map((option) => (
            <FormControlLabel
              key={option.id}
              control={
                <Checkbox
                  checked={selected.includes(option.id)}
                  onChange={(event) => {
                    let next = [...selected];
                    if (event.target.checked) {
                      next = option.id === "none" ? ["none"] : [...next.filter((id) => id !== "none"), option.id];
                    } else {
                      next = next.filter((id) => id !== option.id);
                    }
                    onChange(question.id, next);
                  }}
                />
              }
              label={option.label}
            />
          ))}
        </FormGroup>
      </FormControl>
    );
  }

  return (
    <FormControl component="fieldset" fullWidth>
      <FormLabel component="legend">{question.label}</FormLabel>
      <RadioGroup
        value={value ?? ""}
        onChange={(event) => onChange(question.id, event.target.value)}
      >
        {(question.options || []).map((option) => (
          <FormControlLabel
            key={option.id}
            value={option.id}
            control={<Radio />}
            label={option.label}
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
}

function AssessmentResultPanel({ preview, answers }) {
  if (!preview?.ok) {
    return <Alert severity="warning">Hoàn thành các bước trước để xem kết quả.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Đây là <strong>rating tạm thời</strong>. CLB/BTC/Admin có thể xác thực sau khi
        bạn thi đấu.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Kết quả đánh giá tạm thời
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Rating Pick_VN (tạm tính)
            </Typography>
            <Typography variant="h4" fontWeight="bold">
              {formatPickVnRating(preview.provisional_rating)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Assessment Score
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {preview.assessment_score}/100
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Confidence
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {preview.rating_confidence}%
            </Typography>
          </Box>
        </Stack>

        <PickVnRatingBadge
          rating={preview.provisional_rating}
          status={preview.rating_status}
          confidence={preview.rating_confidence_normalized}
        />

        <Typography variant="body2" sx={{ mt: 1.5 }}>
          Trạng thái:{" "}
          <strong>{RATING_STATUS_LABELS[preview.rating_status] || preview.rating_status}</strong>
        </Typography>
        {preview.raw_provisional_rating != null &&
          preview.raw_provisional_rating !== preview.provisional_rating && (
            <Typography variant="body2" color="text.secondary">
              Trước hiệu chuẩn ×{preview.rating_calibration ?? 0.8}:{" "}
              {formatPickVnRating(preview.raw_provisional_rating)} →{" "}
              {formatPickVnRating(preview.provisional_rating)}
            </Typography>
          )}
      </Paper>

      <Stack direction="row" flexWrap="wrap" gap={1}>
        {preview.strengths?.map((item) => (
          <Chip key={item} label={`Mạnh: ${item}`} color="success" variant="outlined" size="small" />
        ))}
        {preview.weaknesses?.map((item) => (
          <Chip key={item} label={`Cần cải thiện: ${item}`} color="warning" variant="outlined" size="small" />
        ))}
      </Stack>

      {preview.warning_flags?.length > 0 && (
        <Stack spacing={0.5}>
          {preview.warning_flags.map((flag) => (
            <Alert key={flag} severity="warning" sx={{ py: 0 }}>
              {WARNING_LABELS[flag] || flag}
            </Alert>
          ))}
        </Stack>
      )}

      <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
        <Typography variant="subtitle2" gutterBottom>
          Giải thích
        </Typography>
        {(preview.explanation || []).map((line) => (
          <Typography key={line} variant="body2" color="text.secondary">
            • {line}
          </Typography>
        ))}
      </Paper>

      {answers.gender && (
        <Typography variant="caption" color="text.secondary">
          Hồ sơ: {GENDER_TO_PLAYER_LABEL[answers.gender] || answers.gender}
          {answers.birth_year ? ` • Sinh ${answers.birth_year}` : ""}
        </Typography>
      )}
    </Stack>
  );
}

export default function PickVnRatingOnboarding({
  authUserId,
  clubId = null,
  playerId = null,
  onComplete,
  title = "Đánh giá trình độ Pick_VN",
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [activeStep, setActiveStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const stepNumber = activeStep + 1;
  const onResultStep = activeStep === CONTENT_STEPS;

  const preview = useMemo(
    () =>
      onResultStep
        ? calculatePlayerAssessment({ answers, hasClub: Boolean(clubId), matchCount: 0 })
        : null,
    [answers, clubId, onResultStep]
  );

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setError(null);
  };

  const handleNext = () => {
    if (onResultStep) return;
    const validation = validateAssessmentStep(stepNumber, answers);
    if (!validation.ok) {
      setError("Vui lòng trả lời đủ câu hỏi bắt buộc trước khi tiếp tục.");
      return;
    }
    setError(null);
    setActiveStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    if (!authUserId) {
      setError("Thiếu thông tin tài khoản.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await completePickVnOnboarding(authUserId, {
      answers,
      clubId,
      playerId,
      hasClub: Boolean(clubId),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error || "Không lưu được đánh giá.");
      return;
    }
    onComplete?.(result.record);
  };

  const renderStepContent = () => {
    if (onResultStep) {
      return <AssessmentResultPanel preview={preview} answers={answers} />;
    }

    if (stepNumber === 4) {
      return (
        <Stack spacing={2}>
          {getTechniqueUiGroups(4).map(([groupName, questions]) => (
            <Paper key={groupName} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                {groupName}
              </Typography>
              <Stack spacing={2}>
                {questions.map((question) => (
                  <QuestionField
                    key={question.id}
                    question={question}
                    answers={answers}
                    onChange={handleAnswerChange}
                  />
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      );
    }

    const questions = getQuestionsForStep(stepNumber).filter((question) => {
      if (typeof question.showWhen === "function") {
        return question.showWhen(answers);
      }
      return true;
    });

    return (
      <Stack spacing={3}>
        {questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            answers={answers}
            onChange={handleAnswerChange}
            showWhen={
              typeof question.showWhen === "function"
                ? question.showWhen(answers)
                : true
            }
          />
        ))}
      </Stack>
    );
  };

  const stepValid =
    onResultStep || validateAssessmentStep(stepNumber, answers).ok;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 760, mx: "auto" }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Hoàn thành bảng câu hỏi — hệ thống tính rating tạm thời (không lấy tự khai làm
        điểm cuối).
      </Typography>

      <Stepper
        activeStep={activeStep}
        alternativeLabel={!isMobile}
        orientation={isMobile ? "vertical" : "horizontal"}
        sx={{ mb: 3 }}
      >
        {ASSESSMENT_STEPS.map((step) => (
          <Step key={step.id}>
            <StepLabel>{isMobile ? step.title : step.title}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
        Bước {stepNumber}/{TOTAL_STEPS}
        {ASSESSMENT_STEPS[activeStep] ? ` — ${ASSESSMENT_STEPS[activeStep].title}` : ""}
      </Typography>

      {renderStepContent()}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ mt: 3 }}>
        <Button disabled={activeStep === 0 || saving} onClick={handleBack}>
          Quay lại
        </Button>
        {onResultStep ? (
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !preview?.ok}
          >
            {saving ? "Đang lưu..." : "Lưu đánh giá tạm thời"}
          </Button>
        ) : (
          <Button variant="contained" onClick={handleNext} disabled={!stepValid}>
            Tiếp
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
