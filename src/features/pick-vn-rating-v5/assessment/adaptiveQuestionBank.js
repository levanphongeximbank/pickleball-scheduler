import { DOMAIN_CODES as SKILL_DOMAINS } from "../constants/domainCodes.js";

/** Adaptive routing categories */
export const ADAPTIVE_ROUTE = Object.freeze({
  FOUNDATION: "foundation",
  MEDIUM: "medium",
  ADVANCED: "advanced",
  CONSISTENCY_CHECK: "consistency_check",
});

function q(id, domain, route, prompt, anchors, meta = {}) {
  return Object.freeze({
    id,
    domain,
    route,
    prompt,
    anchors: Object.freeze(anchors),
    isCore: false,
    ...meta,
  });
}

/**
 * 30 câu thích ứng — tổng ngân hàng 52 câu (22 core + 30 adaptive).
 * Owner có thể mở rộng lên 60 trong pilot.
 */
export const ADAPTIVE_QUESTIONS = Object.freeze([
  q("adp_found_srv_01", SKILL_DOMAINS.SERVE, ADAPTIVE_ROUTE.FOUNDATION,
    "Bạn có giao được bóng vào ô giao bóng đối diện không?",
    ["Không", "Thử nhưng lỗi", "Được khi chậm", "Ổn định chậm", "Ổn định TB", "Sâu/rộng", "Có kế hoạch", "Đa dạng"]),
  q("adp_found_ret_01", SKILL_DOMAINS.RETURN, ADAPTIVE_ROUTE.FOUNDATION,
    "Return có vào sân không?",
    ["Không", "Hiếm khi", "Khi giao chậm", "TB chậm", "TB", "Sâu", "Sâu+thấp", "Chủ động"]),
  q("adp_found_dink_01", SKILL_DOMAINS.DINK_SOFT_GAME, ADAPTIVE_ROUTE.FOUNDATION,
    "Bạn có biết {{dink_soft_game}} là gì và thử được không?",
    ["Không biết", "Biết, chưa làm", "Thử lỗi nhiều", "Vài quả OK", "Giữ vài pha", "Cross OK", "Ổn TB", "Ổn áp lực"]),
  q("adp_found_pos_01", SKILL_DOMAINS.DOUBLES_POSITIONING, ADAPTIVE_ROUTE.FOUNDATION,
    "Khi đánh đôi, bạn đứng cạnh đồng đội hay lệch stagger?",
    ["Không biết", "Đứng sát", "Thỉnh thoảng stagger", "Stagger cơ bản", "Che middle", "Theo {{poach}}", "{{stack}} đơn giản", "Linh hoạt"]),
  q("adp_found_rules_01", SKILL_DOMAINS.RULES, ADAPTIVE_ROUTE.FOUNDATION,
    "Bạn có biết vùng {{kitchen}} không?",
    ["Không", "Biết nhưng hay vào", "Nhắc mới đúng", "Ít vôi chậm", "OK giao lưu", "OK đấu", "Giải thích được", "Luật tình huống"]),

  q("adp_med_gs_01", SKILL_DOMAINS.GROUNDSTROKE, ADAPTIVE_ROUTE.MEDIUM,
    "{{forehand}} bạn ổn định hơn hay {{backhand}}?",
    ["Cả hai yếu", "{{forehand}} hơn", "{{backhand}} hơn", "Tương đương chậm", "TB ổn", "Đổi hướng", "Dưới áp lực", "Theo {{match_up}}"],
    { checksContradiction: ["core_gs_01", "core_gs_02"] }),
  q("adp_med_rally_01", SKILL_DOMAINS.RALLY_CONSISTENCY, ADAPTIVE_ROUTE.MEDIUM,
    "{{rally}} 10 quả — bạn hoàn thành được bao nhiêu lần trong 5 điểm?",
    ["0", "1", "2", "3", "4", "5", "Hầu hết", "Luôn"]),
  q("adp_med_err_01", SKILL_DOMAINS.ERROR_CONTROL, ADAPTIVE_ROUTE.MEDIUM,
    "{{unforced_error}} chiếm bao nhiêu % điểm thua?",
    [">80%", "60–80%", "40–60%", "30–40%", "20–30%", "10–20%", "5–10%", "<5%"]),
  q("adp_med_ts_01", SKILL_DOMAINS.THIRD_SHOT, ADAPTIVE_ROUTE.MEDIUM,
    "Sau return sâu, bạn {{third_shot_drop}} hay {{third_shot_drive}} nhiều hơn?",
    ["Không biết", "Toàn lỗi", "Thử {{third_shot_drop}}", "Thử {{third_shot_drive}}", "Chọn lọc", "Cân bằng", "Theo đối thủ", "Chủ động"]),
  q("adp_med_tr_01", SKILL_DOMAINS.TRANSITION, ADAPTIVE_ROUTE.MEDIUM,
    "Sau {{third_shot}} tốt, bạn lên {{kitchen}} trong bao nhiêu % điểm?",
    ["0%", "<25%", "25–40%", "40–55%", "55–70%", "70–85%", ">85%", "Luôn đúng lúc"]),

  q("adp_adv_dink_01", SKILL_DOMAINS.DINK_SOFT_GAME, ADAPTIVE_ROUTE.ADVANCED,
    "Bạn dink {{crosscourt}} để kéo đối thủ rời middle?",
    ["Không", "Thử lỗi", "Thỉnh thoảng", "TB", "Thường xuyên", "Theo {{match_up}}", "Dưới {{speed_up}}", "Chủ động setup"]),
  q("adp_adv_reset_01", SKILL_DOMAINS.BLOCK_RESET, ADAPTIVE_ROUTE.ADVANCED,
    "Sau bị {{speed_up}}, {{reset}} vào {{kitchen}} thành công?",
    ["Không", "Hiếm", "Chậm OK", "TB", "Thường", "Chọn góc", "Dưới {{poach}}", "Chủ động"]),
  q("adp_adv_vol_01", SKILL_DOMAINS.VOLLEY, ADAPTIVE_ROUTE.ADVANCED,
    "{{put_away}} {{volley}} khi bóng cao — tỷ lệ thành công?",
    ["0%", "<25%", "25–40%", "40–55%", "55–70%", "70–85%", ">85%", "Chủ động setup"]),
  q("adp_adv_tac_01", SKILL_DOMAINS.TACTICAL_DECISION, ADAPTIVE_ROUTE.ADVANCED,
    "Bạn target yếu điểm đối thủ ({{backhand}}, middle, deep)?",
    ["Không", "Ngẫu nhiên", "Thỉnh thoảng", "TB", "Thường", "Theo set", "Dưới áp lực", "Đọc {{match_up}}"]),
  q("adp_adv_press_01", SKILL_DOMAINS.PRESSURE_EXECUTION, ADAPTIVE_ROUTE.ADVANCED,
    "Điểm quyết định (10–10+) — bạn giữ được lối chơi?",
    ["Rất khó", "Thường lỗi", "Chậm OK", "TB", "Ổn", "Tăng tập trung", "Chủ động", "Thích áp lực"]),

  q("adp_cc_srv_ret_01", SKILL_DOMAINS.SERVE, ADAPTIVE_ROUTE.CONSISTENCY_CHECK,
    "Bạn vừa chọn mức giao bóng cao — return của bạn so với giao?",
    ["Return << giao", "Return < giao", "Gần bằng", "Return > giao", "Khớp", "Khớp TB", "Khớp áp lực", "Return mạnh hơn"],
    { checksContradiction: ["core_srv_01", "core_ret_01"] }),
  q("adp_cc_dink_drive_01", SKILL_DOMAINS.DINK_SOFT_GAME, ADAPTIVE_ROUTE.CONSISTENCY_CHECK,
    "Bạn đánh {{drive}} mạnh nhưng dink — mức nào phản ánh đúng hơn?",
    ["Chỉ {{drive}}", "{{drive}} >> dink", "{{drive}} > dink", "Cân bằng", "Dink > {{drive}}", "Dink >> {{drive}}", "Soft game chính", "Hoàn toàn soft"],
    { checksContradiction: ["core_dink_01", "core_gs_01"] }),
  q("adp_cc_exp_rally_01", SKILL_DOMAINS.CONSISTENCY, ADAPTIVE_ROUTE.CONSISTENCY_CHECK,
    "Kinh nghiệm dài nhưng {{rally}} ngắn — điều nào đúng hơn?",
    ["Kinh nghiệm quan trọng hơn", "Hơi kinh nghiệm", "Cân bằng", "{{rally}} quan trọng hơn", "{{rally}} dài hơn", "{{rally}} >> exp", "Chưa đủ data", "Cần HLV xem"],
    { checksContradiction: ["core_exp_01", "core_exp_02"] }),

  q("adp_adv_foot_01", SKILL_DOMAINS.FOOTWORK, ADAPTIVE_ROUTE.ADVANCED,
    "Split-step và {{recovery_position}} sau mỗi cú?",
    ["Không", "Thỉnh thoảng", "Chậm OK", "TB", "Thường", "Theo {{poach}}", "Dưới pace", "Chủ động"]),
  q("adp_med_comm_01", SKILL_DOMAINS.COMMUNICATION, ADAPTIVE_ROUTE.MEDIUM,
    "Gọi 'mine' khi bóng giữa hai người?",
    ["Không", "Hiếm", "Chậm", "TB", "Thường", "Sớm", "Dưới attack", "Chủ động"]),
  q("adp_adv_stack_01", SKILL_DOMAINS.DOUBLES_POSITIONING, ADAPTIVE_ROUTE.ADVANCED,
    "{{stack}} khi return — bạn và đồng đội?",
    ["Không biết", "Thử lỗi", "Cơ bản", "TB", "Thường", "Theo {{match_up}}", "Che middle", "{{poach}} setup"]),
  q("adp_med_vol_blk_01", SKILL_DOMAINS.VOLLEY, ADAPTIVE_ROUTE.MEDIUM,
    "{{volley}} defensive vs punch — bạn mạnh hơn ở?",
    ["Không {{volley}}", "Def yếu", "Def TB", "Cân bằng", "Punch TB", "Punch mạnh", "Chọn lọc", "Theo tình huống"]),
  q("adp_found_exp_01", SKILL_DOMAINS.CONSISTENCY, ADAPTIVE_ROUTE.FOUNDATION,
    "Trước pickleball bạn chơi môn vợt nào?",
    ["Không", "Thể thao khác", "Bóng bàn", "Cầu lông", "Tennis", "Nhiều môn", "Chuyên vợt", "Chuyên pickleball"]),
  q("adp_adv_lob_01", SKILL_DOMAINS.TACTICAL_DECISION, ADAPTIVE_ROUTE.ADVANCED,
    "{{lob}} defensive khi bị ép tại {{kitchen}}?",
    ["Không", "Lỗi nhiều", "Thỉnh thoảng", "TB", "Thường", "Chọn lọc", "Dưới {{poach}}", "Chủ động"]),
  q("adp_med_serve_depth_01", SKILL_DOMAINS.SERVE, ADAPTIVE_ROUTE.MEDIUM,
    "Giao sâu (gần {{baseline}} đối phương)?",
    ["Không", "Hiếm", "Chậm", "TB", "Thường", "Theo người", "Dưới áp lực", "Setup third"]),
  q("adp_adv_ernie_01", SKILL_DOMAINS.TACTICAL_DECISION, ADAPTIVE_ROUTE.ADVANCED,
    "{{ernie}} hoặc {{counterattack}} từ ngoài {{kitchen}}?",
    ["Không biết", "Thử lỗi", "Thỉnh thoảng", "TB", "Chọn lọc", "Thường", "Dưới setup", "Chủ động"]),
  q("adp_cc_pos_drive_01", SKILL_DOMAINS.DOUBLES_POSITIONING, ADAPTIVE_ROUTE.CONSISTENCY_CHECK,
    "{{drive}} mạnh nhưng hay mất vị trí — điều nào đúng?",
    ["{{drive}} quan trọng hơn", "Hơi {{drive}}", "Cân bằng", "Vị trí quan trọng hơn", "Vị trí >> {{drive}}", "Cần HLV", "Chưa rõ", "Mâu thuẫn"],
    { checksContradiction: ["core_pos_01", "core_gs_01"] }),
  q("adp_med_pressure_dink_01", SKILL_DOMAINS.DINK_SOFT_GAME, ADAPTIVE_ROUTE.MEDIUM,
    "{{speed_up}} từ {{kitchen}} — bạn block hay counter?",
    ["Không biết", "Thường lỗi", "Block thử", "TB block", "Counter thử", "Chọn lọc", "Dưới {{poach}}", "Chủ động"]),
  q("adp_adv_return_depth_01", SKILL_DOMAINS.RETURN, ADAPTIVE_ROUTE.ADVANCED,
    "Return deep giữ đối thủ {{baseline}}?",
    ["Không", "Hiếm", "Chậm", "TB", "Thường", "Theo server", "Dưới giao mạnh", "Setup third"]),
  q("adp_med_rules_nvz_01", SKILL_DOMAINS.RULES, ADAPTIVE_ROUTE.MEDIUM,
    "Bóng trên line {{kitchen}} — bạn xử lý đúng luật?",
    ["Không chắc", "Hay sai", "Nhắc mới đúng", "TB", "Thường đúng", "Tranh chấp OK", "Giải thích", "Trọng tài level"]),
]);

export const MAX_ADAPTIVE_QUESTIONS = 8;

export function getAdaptiveQuestionsByRoute(route) {
  return ADAPTIVE_QUESTIONS.filter((q) => q.route === route);
}

export function getQuestionBankSize() {
  return 22 + ADAPTIVE_QUESTIONS.length;
}
