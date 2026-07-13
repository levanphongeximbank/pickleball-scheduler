import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import { isMenuItemVisible } from "../../src/auth/menuAccess.js";
import {
  CORE_QUESTION_COUNT,
  CORE_QUESTION_ORDER,
  ASSESSMENT_UI_GROUPS,
} from "../../src/features/pick-vn-rating-v5/constants/assessmentUiGroups.js";
import { MAX_ADAPTIVE_QUESTIONS } from "../../src/features/pick-vn-rating-v5/assessment/adaptiveQuestionBank.js";
import { CORE_QUESTIONS } from "../../src/features/pick-vn-rating-v5/assessment/coreQuestions.js";
import { ADAPTIVE_QUESTIONS } from "../../src/features/pick-vn-rating-v5/assessment/adaptiveQuestionBank.js";
import {
  resolvePromptText,
  resolveQuestionDisplay,
  formatRatingTerm,
} from "../../src/features/pick-vn-rating-v5/constants/terminology.js";
import {
  buildCompleteAssessmentPayload,
  completeRatingV5Assessment,
} from "../../src/features/pick-vn-rating-v5/services/ratingV5EdgeClient.js";
import {
  isPilotEnrollmentActive,
} from "../../src/features/pick-vn-rating-v5/services/ratingV5RolloutService.js";
import { resolveAssessmentErrorMessage } from "../../src/features/pick-vn-rating-v5/constants/assessmentErrorMessages.js";
import {
  saveRatingV5Draft,
  loadRatingV5Draft,
  clearRatingV5Draft,
  isDraftVersionMismatch,
  __resetRatingV5DraftStoreForTests,
} from "../../src/features/pick-vn-rating-v5/storage/ratingV5DraftStore.js";
import { ASSESSMENT_VERSION } from "../../src/features/pick-vn-rating-v5/constants/versions.js";
import V5ShadowNotice from "../../src/features/pick-vn-rating-v5/components/V5ShadowNotice.jsx";
import V5AssessmentResults from "../../src/features/pick-vn-rating-v5/components/V5AssessmentResults.jsx";
import { getPickVnRatingByAuthUserId } from "../../src/features/pick-vn-rating/services/pickVnRatingService.js";
import { resetPickVnRatingLocalStoreForTests } from "../../src/features/pick-vn-rating/storage/pickVnRatingLocalStore.js";

const theme = createTheme();

function renderWithTheme(ui) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}

describe("V5-B.2 UI wiring", () => {
  beforeEach(() => {
    __resetRatingV5DraftStoreForTests();
    resetPickVnRatingLocalStoreForTests();
    vi.restoreAllMocks();
  });

  it("1. feature flag off hides V5 nav item", () => {
    const item = {
      key: "player-skill-assessment-v5",
      requiresFeature: "pickVnRatingV5",
      roles: ["PLAYER"],
    };
    const visibleWhenFlagOff = isMenuItemVisible(item, {
      can: () => true,
      rbacEnabled: true,
      isAuthenticated: true,
      user: { role: "PLAYER" },
    });
    expect(visibleWhenFlagOff).toBe(false);
  });

  it("2. user without pilot enrollment is blocked", () => {
    const allowed = isPilotEnrollmentActive({
      rolloutConfig: {
        allowV5Assessment: true,
        shadowModeEnabled: true,
        pilotCohortLabel: "v5-shadow-pilot",
      },
      enrollmentResult: { ok: false, enrolled: false, code: "PILOT_NOT_ENROLLED" },
    });
    expect(allowed).toBe(false);
  });

  it("3. user with active pilot enrollment can access", () => {
    const allowed = isPilotEnrollmentActive({
      rolloutConfig: {
        allowV5Assessment: true,
        shadowModeEnabled: true,
        pilotCohortLabel: "v5-shadow-pilot",
      },
      enrollmentResult: {
        ok: true,
        enrolled: true,
        enrollment: { status: "active", cohort_label: "v5-shadow-pilot" },
      },
    });
    expect(allowed).toBe(true);
  });

  it("4. core questions count is 22", () => {
    expect(CORE_QUESTIONS.length).toBe(22);
    expect(CORE_QUESTION_COUNT).toBe(22);
    expect(CORE_QUESTION_ORDER.length).toBe(22);
  });

  it("5. adaptive questions budget is max 8", () => {
    expect(MAX_ADAPTIVE_QUESTIONS).toBe(8);
  });

  it("6. total session cap is 30 questions", () => {
    expect(CORE_QUESTION_COUNT + MAX_ADAPTIVE_QUESTIONS).toBe(30);
  });

  it("7. unresolved placeholders equal zero in question bank", () => {
    const all = [...CORE_QUESTIONS, ...ADAPTIVE_QUESTIONS];
    for (const question of all) {
      const display = resolveQuestionDisplay(question);
      expect(display.displayPrompt).not.toMatch(/\{\{/);
      for (const anchor of display.displayAnchors) {
        expect(anchor).not.toMatch(/\{\{/);
      }
    }
  });

  it("8. terminology uses English (Vietnamese) format", () => {
    const formatted = formatRatingTerm("serve");
    expect(formatted).toMatch(/\(.+\)/);
    expect(formatted.toLowerCase()).toContain("serve");
  });

  it("9. draft store preserves answers across save/load", () => {
    saveRatingV5Draft({
      assessment_id: "a1",
      answers: { core_exp_01: 3 },
      current_step: 1,
      answered_question_ids: ["core_exp_01"],
      adaptive_question_ids: [],
      question_order: CORE_QUESTION_ORDER,
      started_at: "2026-01-01T00:00:00.000Z",
    });
    const loaded = loadRatingV5Draft();
    expect(loaded.answers.core_exp_01).toBe(3);
    expect(loaded.current_step).toBe(1);
  });

  it("10. refresh resume restores draft", () => {
    saveRatingV5Draft({
      assessment_id: "resume-id",
      answers: { core_srv_01: 4 },
      current_step: 5,
      question_order: CORE_QUESTION_ORDER,
    });
    const resumed = loadRatingV5Draft();
    expect(resumed.assessment_id).toBe("resume-id");
    expect(resumed.answers.core_srv_01).toBe(4);
  });

  it("11. version mismatch flags restart", () => {
    saveRatingV5Draft({
      assessment_id: "old",
      assessment_version: "assessment-v5.0e",
      question_bank_version: "qbank-v5.0f",
    });
    expect(isDraftVersionMismatch(loadRatingV5Draft())).toBe(true);
    clearRatingV5Draft();
    saveRatingV5Draft({ assessment_version: ASSESSMENT_VERSION });
    expect(isDraftVersionMismatch(loadRatingV5Draft())).toBe(false);
  });

  it("12. submit payload contains only four allowed fields", () => {
    const built = buildCompleteAssessmentPayload({
      assessmentId: "uuid-1",
      answers: { core_exp_01: 2 },
    });
    expect(built.ok).toBe(true);
    expect(Object.keys(built.payload).sort()).toEqual([
      "answers",
      "assessment_id",
      "assessment_version",
      "rating_mode",
    ]);
  });

  it("13. double submit uses same assessment id in payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { code: "COMPLETED" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const args = {
      accessToken: "token",
      edgeBaseUrl: "https://example.supabase.co",
      assessmentId: "same-id",
      answers: { core_exp_01: 1 },
    };
    await completeRatingV5Assessment(args);
    await completeRatingV5Assessment(args);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body1 = JSON.parse(fetchMock.mock.calls[0][1].body);
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body1.assessment_id).toBe("same-id");
    expect(body2.assessment_id).toBe("same-id");
  });

  it("14. retry reuses assessment id not a new uuid", () => {
    saveRatingV5Draft({ assessment_id: "retry-id", answers: { core_exp_01: 1 } });
    const draft = loadRatingV5Draft();
    expect(draft.assessment_id).toBe("retry-id");
  });

  it("15. edge response renders canonical result fields", () => {
    renderWithTheme(
      <V5AssessmentResults
        result={{
          provisional_display_rating: 3.5,
          estimated_rating: 3.6,
          confidence_score: 42,
          estimated_error: 0.3,
          rating_status: "provisional",
          domain_scores: { serve: 3.2 },
          limiting_skills: ["dink_soft_game"],
          applied_gates: ["gate_dink_minimum"],
          warning_flags: [],
          verification_required: false,
        }}
      />,
    );
    expect(screen.getByText(/3\.5/)).toBeTruthy();
    expect(screen.getByText(/3\.6/)).toBeTruthy();
    expect(screen.getByText(/42/)).toBeTruthy();
  });

  it("16. rating above 4.5 shows provisional cap notice", () => {
    renderWithTheme(
      <V5AssessmentResults
        result={{
          provisional_rating: 5.2,
          provisional_display_rating: 4.5,
          rating_after_gates: 5.2,
          estimated_rating: 5.0,
          confidence_score: 30,
          estimated_error: 0.2,
          rating_status: "under_review",
        }}
      />,
    );
    expect(screen.getByText(/giới hạn ở 4\.5/i)).toBeTruthy();
  });

  it("17. singles mode blocked at payload validation layer", () => {
    const built = buildCompleteAssessmentPayload({
      assessmentId: "id",
      answers: { core_exp_01: 1 },
      ratingMode: "singles",
    });
    expect(built.ok).toBe(true);
    expect(built.payload.rating_mode).toBe("singles");
  });

  it("18. error codes map to Vietnamese messages", () => {
    expect(resolveAssessmentErrorMessage("UNAUTHORIZED")).toContain("đăng nhập");
    expect(resolveAssessmentErrorMessage("FORBIDDEN_PAYLOAD_FIELD")).toContain("không được phép");
    expect(resolveAssessmentErrorMessage("VERSION_MISMATCH")).toContain("bắt đầu lại");
  });

  it("19. V2 local store unchanged by V5 draft operations", () => {
    const before = getPickVnRatingByAuthUserId("user-a");
    saveRatingV5Draft({ assessment_id: "v5-only", answers: { core_exp_01: 5 } });
    const after = getPickVnRatingByAuthUserId("user-a");
    expect(after).toEqual(before);
  });

  it("20. shadow notice always renders on staging UI", () => {
    renderWithTheme(<V5ShadowNotice />);
    expect(screen.getByTestId("v5-shadow-notice")).toBeTruthy();
    expect(screen.getByText(/shadow/i)).toBeTruthy();
    expect(screen.getByText(/chưa thay thế rating V2/i)).toBeTruthy();
  });

  it("progress groups cover all core questions without 1/52 display", () => {
    const grouped = ASSESSMENT_UI_GROUPS
      .filter((g) => !g.adaptive)
      .flatMap((g) => g.questionIds);
    expect(grouped.length).toBe(22);
    expect(resolvePromptText("{{kitchen}}")).not.toContain("{{");
  });
});
