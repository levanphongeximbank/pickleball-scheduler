/**

 * V5 behavioral anchor scale (0–7) — per-skill anchors, not generic labels.

 * Each question defines its own anchor text array.

 */

import { DOMAIN_CODES as SKILL_DOMAINS } from "../constants/domainCodes.js";



export { SKILL_DOMAINS };



export const BEHAVIORAL_ANCHOR_LEVELS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]);



function anchors(

  l0, l1, l2, l3, l4, l5, l6, l7,

) {

  return Object.freeze([l0, l1, l2, l3, l4, l5, l6, l7]);

}



/** 22 câu cốt lõi — assessment-v5.0f / qbank-v5.0f */

export const CORE_QUESTIONS = Object.freeze([

  {

    id: "core_exp_01",

    domain: SKILL_DOMAINS.CONSISTENCY,

    secondaryDomains: [],

    prompt: "Bạn đã chơi pickleball được bao lâu và với tần suất nào?",

    anchors: anchors(

      "Chưa từng chơi hoặc mới biết đến môn",

      "Biết luật cơ bản nhưng chưa ra sân thường xuyên",

      "Chơi thử vài buổi, chưa quen nhịp {{rally}}",

      "Chơi 1–2 lần/tháng, còn thiếu ổn định",

      "Chơi 1 lần/tuần, quen các tình huống cơ bản",

      "Chơi 2–3 lần/tuần, duy trì được nhịp đấu",

      "Chơi gần như hằng tuần có lịch cố định",

      "Chơi thường xuyên nhiều năm, coi đây là môn chính",

    ),

    isCore: true,

    order: 1,

  },

  {

    id: "core_exp_02",

    domain: SKILL_DOMAINS.PRESSURE_EXECUTION,

    secondaryDomains: [SKILL_DOMAINS.CONSISTENCY],

    prompt: "Trong buổi chơi thông thường, bạn duy trì {{rally}} được bao lâu trước khi mắc {{unforced_error}}?",

    anchors: anchors(

      "Gần như không {{rally}} được",

      "{{rally}} 1–2 quả rồi lỗi",

      "{{rally}} 3–4 quả trong tập nhẹ",

      "{{rally}} 5–6 quả khi tốc độ chậm",

      "{{rally}} 8–10 quả trong đấu giao lưu",

      "{{rally}} 10–15 quả ở nhịp trung bình",

      "{{rally}} dài ngay cả khi đối thủ tăng áp lực",

      "Giữ {{rally}} ổn định và chủ động thay đổi nhịp",

    ),

    isCore: true,

    order: 2,

  },

  {

    id: "core_srv_01",

    domain: SKILL_DOMAINS.SERVE,

    prompt: "Giao bóng vào vùng hợp lệ (bao gồm depth và hướng cơ bản)?",

    anchors: anchors(

      "Chưa giao được vào sân",

      "Biết luật giao nhưng thường lỗi {{foot_fault}}/lưới",

      "Giao vào sân khi không áp lực",

      "Giao vào sân ổn định ở tốc độ chậm",

      "Giao sâu hoặc rộng được một phần",

      "Giao đa dạng (sâu, ngắn, góc) trong đấu thường",

      "Giao có chủ đích theo đối thủ",

      "Giao ổn định dưới áp lực, ít bị attack ngay",

    ),

    isCore: true,

    order: 3,

  },

  {

    id: "core_srv_02",

    domain: SKILL_DOMAINS.SERVE,

    prompt: "Giao bóng thứ 3 ({{third_shot}}) — bạn chủ động giao để mở điểm?",

    anchors: anchors(

      "Chưa hiểu mục tiêu sau giao",

      "Giao xong không biết bước tiếp theo",

      "Giao xong chỉ phòng thủ thụ động",

      "Thỉnh thoảng giao sâu để lùi đối thủ",

      "Giao có kế hoạch {{third_shot_drop}}/{{third_shot_drive}} sau giao",

      "Giao kết hợp vị trí đồng đội",

      "Giao tạo lợi thế ngay từ đầu điểm",

      "Giao đa dạng và đọc được return của đối thủ",

    ),

    isCore: true,

    order: 4,

  },

  {

    id: "core_ret_01",

    domain: SKILL_DOMAINS.RETURN,

    prompt: "Trả giao bóng an toàn vào sân (không bị attack ngay)?",

    anchors: anchors(

      "Thường lỗi return hoặc {{pop_up}}",

      "Return vào sân nhưng quá cao/ngắn",

      "Return sâu khi giao chậm",

      "Return sâu ở nhịp giao lưu chậm",

      "Return sâu và thấp phần lớn tình huống",

      "Return chọn góc hoặc tốc độ theo server",

      "Return ổn định dưới giao mạnh",

      "Return chủ động tạo lợi thế (depth + placement)",

    ),

    isCore: true,

    order: 5,

  },

  {

    id: "core_gs_01",

    domain: SKILL_DOMAINS.GROUNDSTROKE,

    prompt: "{{forehand}} {{drive}} từ {{baseline}} — kiểm soát hướng và độ sâu?",

    anchors: anchors(

      "Chưa đánh {{forehand}} ổn định",

      "Đánh được nhưng thường ra ngoài/lưới",

      "{{drive}} vào sân khi bóng cao/chậm",

      "{{drive}} ổn định ở tốc độ trung bình",

      "{{drive}} sâu và ngang phần lớn tình huống",

      "{{drive}} thay đổi góc có chủ đích",

      "{{drive}} dưới áp lực {{rally}} nhanh",

      "{{drive}} đa dạng (pace, angle) theo đối thủ",

    ),

    isCore: true,

    order: 6,

  },

  {

    id: "core_gs_02",

    domain: SKILL_DOMAINS.GROUNDSTROKE,

    prompt: "{{backhand}} {{drive}} hoặc {{backhand}} {{groundstroke}} — độ ổn định?",

    anchors: anchors(

      "Tránh dùng {{backhand}}",

      "{{backhand}} thường lỗi",

      "{{backhand}} vào sân khi bóng chậm",

      "{{backhand}} ổn định ở tốc độ chậm",

      "{{backhand}} sâu trong {{rally}} trung bình",

      "{{backhand}} đổi hướng được",

      "{{backhand}} giữ nhịp khi bị ép",

      "{{backhand}} chủ động tấn công hoặc {{reset}}",

    ),

    isCore: true,

    order: 7,

  },

  {

    id: "core_gs_03",

    domain: SKILL_DOMAINS.RALLY_CONSISTENCY,

    secondaryDomains: [SKILL_DOMAINS.GROUNDSTROKE],

    prompt: "{{rally}} {{groundstroke}} hai bên {{baseline}} — giữ bóng trong sân?",

    anchors: anchors(

      "Không {{rally}} {{baseline}} được",

      "1–2 quả rồi lỗi",

      "{{rally}} chậm được vài quả",

      "{{rally}} trung bình nhưng hay lỗi biên",

      "{{rally}} ổn định ở pace trung bình",

      "{{rally}} và chuyển sang tấn công",

      "{{rally}} kiểm soát nhịp đối thủ",

      "{{rally}} dài với ít {{unforced_error}}",

    ),

    isCore: true,

    order: 8,

  },

  {

    id: "core_dink_01",

    domain: SKILL_DOMAINS.DINK_SOFT_GAME,

    prompt: "{{dink_soft_game}} vào {{kitchen}} — bóng qua lưới thấp và trong sân?",

    anchors: anchors(

      "Chưa biết dink hoặc toàn lỗi lưới",

      "Dink thử nhưng {{pop_up}} nhiều",

      "Dink vào {{kitchen}} khi không bị ép",

      "Dink ổn định vài pha",

      "Dink {{crosscourt}} hoặc straight cơ bản",

      "Dink giữ {{rally}} {{kitchen}} trung bình",

      "Dink thay đổi góc/pace có chủ đích",

      "Dink ổn định dưới áp lực {{speed_up}}",

    ),

    isCore: true,

    order: 9,

  },

  {

    id: "core_dink_02",

    domain: SKILL_DOMAINS.DINK_SOFT_GAME,

    prompt: "{{dink_soft_game}} — bạn kiểm soát được tốc độ bóng ở {{kitchen}}?",

    anchors: anchors(

      "Không chơi soft game",

      "Chỉ đánh cứng, không dink",

      "Dink nhưng hay bị attack",

      "Giữ được vài pha soft khi đối thủ chậm",

      "Soft game cân bằng với {{drive}}",

      "Chủ động dink để mở điểm",

      "Soft game khi bị ép ở {{kitchen}}",

      "Điều chỉnh soft theo đối thủ và đồng đội",

    ),

    isCore: true,

    order: 10,

  },

  {

    id: "core_dink_03",

    domain: SKILL_DOMAINS.ERROR_CONTROL,

    secondaryDomains: [SKILL_DOMAINS.DINK_SOFT_GAME],

    prompt: "Khi chơi tại {{kitchen}}, bạn tránh lỗi {{pop_up}} hoặc vào vôi?",

    anchors: anchors(

      "Thường xuyên {{pop_up}} hoặc vôi",

      "Lỗi {{kitchen}} nhiều hơn giữ được",

      "Giữ được khi không bị {{speed_up}}",

      "{{pop_up}} thỉnh thoảng khi bị ép",

      "Kiểm soát lỗi ở nhịp trung bình",

      "Ít {{unforced_error}} ở {{kitchen}}",

      "{{reset}} được sau khi bị attack",

      "Giữ bóng thấp ngay cả khi đối thủ {{poach}}",

    ),

    isCore: true,

    order: 11,

  },

  {

    id: "core_ts_01",

    domain: SKILL_DOMAINS.THIRD_SHOT,

    prompt: "{{third_shot}} — đưa bóng vào {{kitchen}} đối phương?",

    anchors: anchors(

      "Chưa biết {{third_shot_drop}}",

      "Thử drop nhưng thường lỗi lưới/cao",

      "Drop vào {{kitchen}} khi không bị ép",

      "Drop ổn định ở pace chậm",

      "Drop sâu {{kitchen}} phần lớn tình huống",

      "Chọn {{third_shot_drop}} hoặc {{third_shot_drive}} theo return",

      "Drop dưới áp lực sau return sâu",

      "Drop đa dạng (height, depth, angle)",

    ),

    isCore: true,

    order: 12,

  },

  {

    id: "core_tr_01",

    domain: SKILL_DOMAINS.TRANSITION,

    prompt: "{{transition}} từ {{baseline}} lên {{kitchen}} (không bị attack dễ dàng)?",

    anchors: anchors(

      "Không biết khi nào lên",

      "Lên sớm và bị punish nhiều",

      "Lên được khi đối thủ chậm",

      "Lên sau {{third_shot}} ổn định",

      "Lên có split-step và ready",

      "Lên đúng thời điểm phần lớn điểm",

      "Lên dưới áp lực {{drive}}",

      "Lên linh hoạt theo đồng đội và {{match_up}}",

    ),

    isCore: true,

    order: 13,

  },

  {

    id: "core_tr_02",

    domain: SKILL_DOMAINS.TRANSITION,

    prompt: "Khi bị ép giữa sân ({{transition_zone}}), bạn xử lý thế nào?",

    anchors: anchors(

      "Đứng giữa sân và thường lỗi",

      "Biết nên lùi/tiến nhưng hay chậm",

      "{{reset}} được khi bóng chậm",

      "Chọn lùi hoặc lên cơ bản",

      "{{block_reset}} rồi về vị trí",

      "Ít mắc kẹt ở {{transition_zone}}",

      "Xử lý nhanh dưới pace cao",

      "Chủ động điều chỉnh theo đối thủ",

    ),

    isCore: true,

    order: 14,

  },

  {

    id: "core_vol_01",

    domain: SKILL_DOMAINS.VOLLEY,

    prompt: "{{volley}} punch hoặc {{volley}} tấn công từ {{kitchen}} line?",

    anchors: anchors(

      "Không {{volley}} được",

      "{{volley}} thường ra ngoài hoặc {{pop_up}}",

      "{{volley}} vào sân khi bóng cao",

      "{{volley}} cơ bản ở pace chậm",

      "{{volley}} {{put_away}} khi bóng cao",

      "{{volley}} chọn góc chân đối thủ",

      "{{volley}} dưới áp lực {{speed_up}}",

      "{{volley}} đa dạng (angle, pace, fake)",

    ),

    isCore: true,

    order: 15,

  },

  {

    id: "core_blk_01",

    domain: SKILL_DOMAINS.BLOCK_RESET,

    prompt: "Block {{drive}} đối phương — giữ bóng thấp và trong sân?",

    anchors: anchors(

      "Không block được",

      "Block nhưng {{pop_up}} nhiều",

      "Block khi {{drive}} chậm",

      "Block ổn định vài pha",

      "Block rồi {{reset}} vào {{kitchen}}",

      "Block chủ động theo hướng {{drive}}",

      "Block dưới pace cao",

      "Block + {{reset}} tạo lại neutral",

    ),

    isCore: true,

    order: 16,

  },

  {

    id: "core_blk_02",

    domain: SKILL_DOMAINS.BLOCK_RESET,

    prompt: "{{reset}} bóng khi bị attack — đưa {{rally}} về trạng thái trung tính?",

    anchors: anchors(

      "Không {{reset}} được, thường lỗi",

      "{{reset}} thử nhưng hay out",

      "{{reset}} khi attack chậm",

      "{{reset}} vào {{kitchen}} cơ bản",

      "{{reset}} ổn định sau block",

      "{{reset}} chọn góc xa đối thủ",

      "{{reset}} dưới áp lực {{poach}}",

      "{{reset}} chủ động thay đổi nhịp {{rally}}",

    ),

    isCore: true,

    order: 17,

  },

  {

    id: "core_pos_01",

    domain: SKILL_DOMAINS.DOUBLES_POSITIONING,

    prompt: "Vị trí đứng khi đồng đội đang dink — bạn giữ khoảng cách và che sân?",

    anchors: anchors(

      "Không biết đứng đâu khi đồng đội dink",

      "Hay đứng quá gần hoặc che khuất",

      "Giữ vị trí khi không bị {{poach}}",

      "Biết stagger cơ bản",

      "Che middle và line cơ bản",

      "Điều chỉnh theo tay thuận đối thủ",

      "{{poach}} hoặc giữ line có chủ đích",

      "Phối hợp di chuyển mượt với đồng đội",

    ),

    isCore: true,

    order: 18,

  },

  {

    id: "core_pos_02",

    domain: SKILL_DOMAINS.COMMUNICATION,

    secondaryDomains: [SKILL_DOMAINS.DOUBLES_POSITIONING],

    prompt: "Giao tiếp với đồng đội (mine/yours, switch, {{stack}})?",

    anchors: anchors(

      "Không giao tiếp trên sân",

      "Thỉnh thoảng gọi mine/yours",

      "Gọi bóng trong tình huống dễ",

      "Switch cơ bản khi cần",

      "{{stack}} hoặc formation đơn giản",

      "Giao tiếp khi bị attack",

      "Điều phối {{poach}} và coverage",

      "Giao tiếp linh hoạt theo {{match_up}}",

    ),

    isCore: true,

    order: 19,

  },

  {

    id: "core_tac_01",

    domain: SKILL_DOMAINS.TACTICAL_DECISION,

    prompt: "{{shot_selection}} ({{drive}}/{{dink_soft_game}}/{{lob}}/{{ernie}}) theo tình huống?",

    anchors: anchors(

      "Đánh theo thói quen, không chọn lọc",

      "Biết các lựa chọn nhưng hay sai",

      "Chọn đúng khi bóng rất dễ",

      "Chọn ổn ở pace chậm",

      "Chọn theo vị trí đối thủ cơ bản",

      "Kết hợp chiến thuật theo điểm",

      "Điều chỉnh theo điểm số/áp lực",

      "Đọc {{match_up}} và exploit weakness",

    ),

    isCore: true,

    order: 20,

  },

  {

    id: "core_tac_02",

    domain: SKILL_DOMAINS.TACTICAL_DECISION,

    prompt: "Nhận diện thời điểm tấn công vs giữ {{rally}}?",

    anchors: anchors(

      "Luôn đánh cứng hoặc luôn chỉ dink",

      "Khó nhận ra ball tấn công",

      "Tấn công khi bóng rất cao",

      "Giữ {{rally}} khi không chắc",

      "Cân bằng tấn công/phòng thủ",

      "Chủ động tạo ball tấn công",

      "Quyết định nhanh dưới áp lực",

      "Điều chỉnh chiến thuật theo set",

    ),

    isCore: true,

    order: 21,

  },

  {

    id: "core_rules_01",

    domain: SKILL_DOMAINS.RULES,

    prompt: "Luật {{kitchen}}/vôi, double bounce, và {{serve}} — bạn nắm và áp dụng?",

    anchors: anchors(

      "Chưa nắm luật cơ bản",

      "Biết luật nhưng hay mắc lỗi vôi",

      "Áp dụng được khi nhắc nhở",

      "Ít lỗi {{kitchen}} trong chơi chậm",

      "Nắm luật trong đấu giao lưu",

      "Áp dụng đúng khi tranh chấp",

      "Giải thích luật cho người mới",

      "Nắm luật tình huống (let, replay, fault)",

    ),

    isCore: true,

    order: 22,

  },

]);



export function getCoreQuestionById(id) {

  return CORE_QUESTIONS.find((q) => q.id === id) ?? null;

}



export function getCoreQuestionIds() {

  return CORE_QUESTIONS.map((q) => q.id);

}


