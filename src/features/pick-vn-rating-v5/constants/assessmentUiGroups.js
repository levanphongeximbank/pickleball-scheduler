/**
 * V5 assessment UI progress groups — không hiển thị "1/52".
 * Frozen mapping for assessment-v5.0f / qbank-v5.0f.
 */
export const ASSESSMENT_UI_GROUPS = Object.freeze([
  {
    id: "experience",
    label: "Kinh nghiệm và mức độ chơi",
    questionIds: ["core_exp_01", "core_exp_02"],
  },
  {
    id: "serve_return",
    label: "Serve và return",
    questionIds: ["core_srv_01", "core_srv_02", "core_ret_01"],
  },
  {
    id: "groundstroke_rally",
    label: "Forehand, backhand và rally",
    questionIds: ["core_gs_01", "core_gs_02", "core_gs_03"],
  },
  {
    id: "dink_soft",
    label: "Dink và soft game",
    questionIds: ["core_dink_01", "core_dink_02", "core_dink_03"],
  },
  {
    id: "third_shot",
    label: "Third shot",
    questionIds: ["core_ts_01"],
  },
  {
    id: "transition",
    label: "Transition",
    questionIds: ["core_tr_01", "core_tr_02"],
  },
  {
    id: "volley_block",
    label: "Volley, block và reset",
    questionIds: ["core_vol_01", "core_blk_01", "core_blk_02"],
  },
  {
    id: "positioning",
    label: "Footwork và positioning",
    questionIds: ["core_pos_01", "core_pos_02"],
  },
  {
    id: "tactical",
    label: "Tactical decision",
    questionIds: ["core_tac_01", "core_tac_02", "core_rules_01"],
  },
  {
    id: "adaptive",
    label: "Adaptive validation",
    questionIds: [],
    adaptive: true,
  },
]);

export const CORE_QUESTION_ORDER = ASSESSMENT_UI_GROUPS
  .filter((group) => !group.adaptive)
  .flatMap((group) => group.questionIds);

export const CORE_QUESTION_COUNT = CORE_QUESTION_ORDER.length;

export function getGroupForQuestionId(questionId) {
  const id = String(questionId ?? "");
  if (id.startsWith("adp_")) {
    return ASSESSMENT_UI_GROUPS.find((group) => group.adaptive) ?? null;
  }
  return ASSESSMENT_UI_GROUPS.find((group) => group.questionIds.includes(id)) ?? null;
}

export function getGroupProgress(group, answeredIds = []) {
  const answered = new Set(answeredIds);
  if (group.adaptive) {
    const adaptiveAnswered = answeredIds.filter((qid) => qid.startsWith("adp_"));
    return {
      answered: adaptiveAnswered.length,
      total: adaptiveAnswered.length,
      complete: adaptiveAnswered.length > 0,
    };
  }
  const total = group.questionIds.length;
  const done = group.questionIds.filter((qid) => answered.has(qid)).length;
  return { answered: done, total, complete: done >= total };
}
