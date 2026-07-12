# V5-B0 — Content Review

**Date:** 2026-07-12 | **Bank:** 22 core + 30 adaptive = 52 | **Mode:** Doubles implementation / Singles spec-only

## Executive summary

| Check | Result |
|-------|--------|
| 22 core questions | ✅ |
| 30 adaptive questions | ✅ |
| 8 anchors per core question | ✅ |
| No generic Weak/Average/Good labels | ✅ |
| Self-rating not in score | ✅ |
| Singles uses incomplete status only | ✅ (V5-B.1) |

## Issues requiring owner revision

1. **core_exp_01** — double-barreled (duration + frequency); maps to `consistency` domain but measures experience.
2. **footwork** — 8% weight but only 1 adaptive question (`adp_adv_foot_01`); core bank thiếu coverage.
3. **Adaptive anchors** — một số câu adaptive dùng anchor ngắn (OK cho routing, owner có thể mở rộng).
4. **Thuật ngữ** — kitchen/vôi, stagger, stack, poach, Ernie cần glossary UI.

## Core questions (22)

### core_exp_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_exp_01` |
| Domain | consistency |
| Skill measured | consistency |
| Question | Bạn đã chơi pickleball được bao lâu và với tần suất nào? |
| Anchors 0–7 | 0: Chưa từng chơi hoặc mới biết đến môn<br>1: Biết luật cơ bản nhưng chưa ra sân thường xuyên<br>2: Chơi thử vài buổi, chưa quen nhịp rally<br>3: Chơi 1–2 lần/tháng, còn thiếu ổn định<br>4: Chơi 1 lần/tuần, quen các tình huống cơ bản<br>5: Chơi 2–3 lần/tuần, duy trì được nhịp đấu<br>6: Chơi gần như hằng tuần có lịch cố định<br>7: Chơi thường xuyên nhiều năm, coi đây là môn chính |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | ⚠️ Double-barreled (thời gian + tần suất). Đề xuất tách 2 câu hoặc đổi domain sang experience_metadata (không cộng weight). |

### core_exp_02

| Trường | Nội dung |
|--------|----------|
| ID | `core_exp_02` |
| Domain | pressure_execution (+ consistency) |
| Skill measured | pressure_execution |
| Question | Trong buổi chơi thông thường, bạn duy trì rally được bao lâu trước khi mắc lỗi không ép buộc? |
| Anchors 0–7 | 0: Gần như không rally được<br>1: Rally 1–2 quả rồi lỗi<br>2: Rally 3–4 quả trong tập nhẹ<br>3: Rally 5–6 quả khi tốc độ chậm<br>4: Rally 8–10 quả trong đấu giao lưu<br>5: Rally 10–15 quả ở nhịp trung bình<br>6: Rally dài ngay cả khi đối thủ tăng áp lực<br>7: Giữ rally ổn định và chủ động thay đổi nhịp |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_srv_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_srv_01` |
| Domain | serve |
| Skill measured | serve |
| Question | Giao bóng vào vùng hợp lệ (bao gồm depth và hướng cơ bản)? |
| Anchors 0–7 | 0: Chưa giao được vào sân<br>1: Biết luật giao nhưng thường lỗi foot fault/net<br>2: Giao vào sân khi không áp lực<br>3: Giao vào sân ổn định ở tốc độ chậm<br>4: Giao sâu hoặc rộng được một phần<br>5: Giao đa dạng (sâu, ngắn, góc) trong đấu thường<br>6: Giao có chủ đích theo đối thủ<br>7: Giao ổn định dưới áp lực, ít bị attack ngay |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_srv_02

| Trường | Nội dung |
|--------|----------|
| ID | `core_srv_02` |
| Domain | serve |
| Skill measured | serve |
| Question | Giao bóng thứ 3 (third-shot serve sequence awareness) — bạn chủ động giao để mở điểm? |
| Anchors 0–7 | 0: Chưa hiểu mục tiêu sau giao<br>1: Giao xong không biết bước tiếp theo<br>2: Giao xong chỉ phòng thủ thụ động<br>3: Thỉnh thoảng giao sâu để lùi đối thủ<br>4: Giao có kế hoạch drop/drive sau giao<br>5: Giao kết hợp vị trí đồng đội<br>6: Giao tạo lợi thế ngay từ đầu điểm<br>7: Giao đa dạng và đọc được return của đối thủ |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | Thuật ngữ 'third-shot serve sequence' — cần tooltip giải thích. |

### core_ret_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_ret_01` |
| Domain | return |
| Skill measured | return |
| Question | Trả giao bóng an toàn vào sân (không bị attack ngay)? |
| Anchors 0–7 | 0: Thường lỗi return hoặc pop-up<br>1: Return vào sân nhưng quá cao/ngắn<br>2: Return sâu khi giao chậm<br>3: Return sâu ở nhịp giao lưu chậm<br>4: Return sâu và thấp phần lớn tình huống<br>5: Return chọn góc hoặc tốc độ theo server<br>6: Return ổn định dưới giao mạnh<br>7: Return chủ động tạo lợi thế (depth + placement) |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_gs_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_gs_01` |
| Domain | groundstroke |
| Skill measured | groundstroke |
| Question | Forehand drive từ baseline — kiểm soát hướng và độ sâu? |
| Anchors 0–7 | 0: Chưa đánh forehand ổn định<br>1: Đánh được nhưng thường ra ngoài/lưới<br>2: Drive vào sân khi bóng cao/chậm<br>3: Drive ổn định ở tốc độ trung bình<br>4: Drive sâu và ngang phần lớn tình huống<br>5: Drive thay đổi góc có chủ đích<br>6: Drive dưới áp lực rally nhanh<br>7: Drive đa dạng (pace, angle) theo đối thủ |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_gs_02

| Trường | Nội dung |
|--------|----------|
| ID | `core_gs_02` |
| Domain | groundstroke |
| Skill measured | groundstroke |
| Question | Backhand drive hoặc backhand groundstroke — độ ổn định? |
| Anchors 0–7 | 0: Tránh dùng backhand<br>1: Backhand thường lỗi<br>2: Backhand vào sân khi bóng chậm<br>3: Backhand ổn định ở tốc độ chậm<br>4: Backhand sâu trong rally trung bình<br>5: Backhand đổi hướng được<br>6: Backhand giữ nhịp khi bị ép<br>7: Backhand chủ động tấn công hoặc reset |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_gs_03

| Trường | Nội dung |
|--------|----------|
| ID | `core_gs_03` |
| Domain | rally_consistency (+ groundstroke) |
| Skill measured | rally_consistency |
| Question | Rally groundstroke hai bên baseline — giữ bóng trong sân? |
| Anchors 0–7 | 0: Không rally baseline được<br>1: 1–2 quả rồi lỗi<br>2: Rally chậm được vài quả<br>3: Rally trung bình nhưng hay lỗi biên<br>4: Rally ổn định ở pace trung bình<br>5: Rally và chuyển sang tấn công<br>6: Rally kiểm soát nhịp đối thủ<br>7: Rally dài với ít lỗi không ép buộc |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_dink_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_dink_01` |
| Domain | dink_soft_game |
| Skill measured | dink_soft_game |
| Question | Dink vào kitchen — bóng qua lưới thấp và trong sân? |
| Anchors 0–7 | 0: Chưa biết dink hoặc toàn lỗi lưới<br>1: Dink thử nhưng pop-up nhiều<br>2: Dink vào kitchen khi không bị ép<br>3: Dink ổn định vài pha<br>4: Dink cross-court hoặc straight cơ bản<br>5: Dink giữ rally kitchen trung bình<br>6: Dink thay đổi góc/pace có chủ đích<br>7: Dink ổn định dưới áp lực speed-up |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_dink_02

| Trường | Nội dung |
|--------|----------|
| ID | `core_dink_02` |
| Domain | dink_soft_game |
| Skill measured | dink_soft_game |
| Question | Soft game — bạn kiểm soát được tốc độ bóng ở kitchen? |
| Anchors 0–7 | 0: Không chơi soft game<br>1: Chỉ đánh cứng, không dink<br>2: Dink nhưng hay bị attack<br>3: Giữ được vài pha soft khi đối thủ chậm<br>4: Soft game cân bằng với drive<br>5: Chủ động dink để mở điểm<br>6: Soft game khi bị ép ở kitchen<br>7: Điều chỉnh soft theo đối thủ và đồng đội |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_dink_03

| Trường | Nội dung |
|--------|----------|
| ID | `core_dink_03` |
| Domain | error_control (+ dink_soft_game) |
| Skill measured | error_control |
| Question | Khi chơi tại kitchen, bạn tránh lỗi pop-up hoặc vào vôi? |
| Anchors 0–7 | 0: Thường xuyên pop-up hoặc vôi<br>1: Lỗi kitchen nhiều hơn giữ được<br>2: Giữ được khi không bị speed-up<br>3: Pop-up thỉnh thoảng khi bị ép<br>4: Kiểm soát lỗi ở nhịp trung bình<br>5: Ít lỗi không ép buộc ở kitchen<br>6: Reset được sau khi bị attack<br>7: Giữ bóng thấp ngay cả khi đối thủ poach |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_ts_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_ts_01` |
| Domain | third_shot |
| Skill measured | third_shot |
| Question | Third-shot drop — đưa bóng vào kitchen đối phương? |
| Anchors 0–7 | 0: Chưa biết third-shot drop<br>1: Thử drop nhưng thường lỗi lưới/cao<br>2: Drop vào kitchen khi không bị ép<br>3: Drop ổn định ở pace chậm<br>4: Drop sâu kitchen phần lớn tình huống<br>5: Chọn drop hoặc drive theo return<br>6: Drop dưới áp lực sau return sâu<br>7: Drop đa dạng (height, depth, angle) |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_tr_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_tr_01` |
| Domain | transition |
| Skill measured | transition |
| Question | Transition từ baseline lên kitchen (không bị attack dễ dàng)? |
| Anchors 0–7 | 0: Không biết khi nào lên<br>1: Lên sớm và bị punish nhiều<br>2: Lên được khi đối thủ chậm<br>3: Lên sau third-shot ổn định<br>4: Lên có split-step và ready<br>5: Lên đúng thời điểm phần lớn điểm<br>6: Lên dưới áp lực drive<br>7: Lên linh hoạt theo đồng đội và match-up |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_tr_02

| Trường | Nội dung |
|--------|----------|
| ID | `core_tr_02` |
| Domain | transition |
| Skill measured | transition |
| Question | Khi bị ép giữa sân (no-man's land), bạn xử lý thế nào? |
| Anchors 0–7 | 0: Đứng giữa sân và thường lỗi<br>1: Biết nên lùi/tiến nhưng hay chậm<br>2: Reset được khi bóng chậm<br>3: Chọn lùi hoặc lên cơ bản<br>4: Reset hoặc block rồi về vị trí<br>5: Ít mắc kẹt ở transition zone<br>6: Xử lý nhanh dưới pace cao<br>7: Chủ động điều chỉnh theo đối thủ |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | Thuật ngữ "no-man's land" — cần chú thích tiếng Việt. |

### core_vol_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_vol_01` |
| Domain | volley |
| Skill measured | volley |
| Question | Volley punch hoặc volley tấn công từ kitchen line? |
| Anchors 0–7 | 0: Không volley được<br>1: Volley thường ra ngoài hoặc pop-up<br>2: Volley vào sân khi bóng cao<br>3: Volley cơ bản ở pace chậm<br>4: Volley put-away khi bóng cao<br>5: Volley chọn góc chân đối thủ<br>6: Volley dưới áp lực speed-up<br>7: Volley đa dạng (angle, pace, fake) |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_blk_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_blk_01` |
| Domain | block_reset |
| Skill measured | block_reset |
| Question | Block drive đối phương — giữ bóng thấp và trong sân? |
| Anchors 0–7 | 0: Không block được<br>1: Block nhưng pop-up nhiều<br>2: Block khi drive chậm<br>3: Block ổn định vài pha<br>4: Block rồi reset vào kitchen<br>5: Block chủ động theo hướng drive<br>6: Block dưới pace cao<br>7: Block + reset tạo lại neutral |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_blk_02

| Trường | Nội dung |
|--------|----------|
| ID | `core_blk_02` |
| Domain | block_reset |
| Skill measured | block_reset |
| Question | Reset bóng khi bị attack — đưa rally về trạng thái trung tính? |
| Anchors 0–7 | 0: Không reset được, thường lỗi<br>1: Reset thử nhưng hay out<br>2: Reset khi attack chậm<br>3: Reset vào kitchen cơ bản<br>4: Reset ổn định sau block<br>5: Reset chọn góc xa đối thủ<br>6: Reset dưới áp lực poach<br>7: Reset chủ động thay đổi nhịp rally |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_pos_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_pos_01` |
| Domain | doubles_positioning |
| Skill measured | doubles_positioning |
| Question | Vị trí đứng khi đồng đội đang dink — bạn giữ khoảng cách và che sân? |
| Anchors 0–7 | 0: Không biết đứng đâu khi đồng đội dink<br>1: Hay đứng quá gần hoặc che khuất<br>2: Giữ vị trí khi không bị poach<br>3: Biết stagger cơ bản<br>4: Che middle và line cơ bản<br>5: Điều chỉnh theo tay thuận đối thủ<br>6: Poach hoặc giữ line có chủ đích<br>7: Phối hợp di chuyển mượt với đồng đội |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_pos_02

| Trường | Nội dung |
|--------|----------|
| ID | `core_pos_02` |
| Domain | communication (+ doubles_positioning) |
| Skill measured | communication |
| Question | Giao tiếp với đồng đội (mine/yours, switch, stack)? |
| Anchors 0–7 | 0: Không giao tiếp trên sân<br>1: Thỉnh thoảng gọi mine/yours<br>2: Gọi bóng trong tình huống dễ<br>3: Switch cơ bản khi cần<br>4: Stack hoặc formation đơn giản<br>5: Giao tiếp khi bị attack<br>6: Điều phối poach và coverage<br>7: Giao tiếp linh hoạt theo match-up |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_tac_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_tac_01` |
| Domain | tactical_decision |
| Skill measured | tactical_decision |
| Question | Chọn cú đánh (drive/dink/lob/ernie) theo tình huống? |
| Anchors 0–7 | 0: Đánh theo thói quen, không chọn lọc<br>1: Biết các lựa chọn nhưng hay sai<br>2: Chọn đúng khi bóng rất dễ<br>3: Chọn ổn ở pace chậm<br>4: Chọn theo vị trí đối thủ cơ bản<br>5: Kết hợp chiến thuật theo điểm<br>6: Điều chỉnh theo điểm số/áp lực<br>7: Đọc match-up và exploit weakness |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_tac_02

| Trường | Nội dung |
|--------|----------|
| ID | `core_tac_02` |
| Domain | tactical_decision |
| Skill measured | tactical_decision |
| Question | Nhận diện thời điểm tấn công vs giữ rally? |
| Anchors 0–7 | 0: Luôn đánh cứng hoặc luôn chỉ dink<br>1: Khó nhận ra ball tấn công<br>2: Tấn công khi bóng rất cao<br>3: Giữ rally khi không chắc<br>4: Cân bằng tấn công/phòng thủ<br>5: Chủ động tạo ball tấn công<br>6: Quyết định nhanh dưới áp lực<br>7: Điều chỉnh chiến thuật theo set |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### core_rules_01

| Trường | Nội dung |
|--------|----------|
| ID | `core_rules_01` |
| Domain | rules |
| Skill measured | rules |
| Question | Luật kitchen/vôi, double bounce, và giao bóng — bạn nắm và áp dụng? |
| Anchors 0–7 | 0: Chưa nắm luật cơ bản<br>1: Biết luật nhưng hay mắc lỗi vôi<br>2: Áp dụng được khi nhắc nhở<br>3: Ít lỗi kitchen trong chơi chậm<br>4: Nắm luật trong đấu giao lưu<br>5: Áp dụng đúng khi tranh chấp<br>6: Giải thích luật cho người mới<br>7: Nắm luật tình huống (let, replay, fault) |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | Luôn (core) |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

## Adaptive questions (30)

### adp_found_srv_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_found_srv_01` |
| Domain | serve |
| Skill measured | serve |
| Question | Bạn có giao được bóng vào ô giao bóng đối diện không? |
| Anchors 0–7 | 0: Không<br>1: Thử nhưng lỗi<br>2: Được khi chậm<br>3: Ổn định chậm<br>4: Ổn định TB<br>5: Sâu/rộng<br>6: Có kế hoạch<br>7: Đa dạng |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | avg anchor 0–2 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_found_ret_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_found_ret_01` |
| Domain | return |
| Skill measured | return |
| Question | Return có vào sân không? |
| Anchors 0–7 | 0: Không<br>1: Hiếm khi<br>2: Khi giao chậm<br>3: TB chậm<br>4: TB<br>5: Sâu<br>6: Sâu+thấp<br>7: Chủ động |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | avg anchor 0–2 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_found_dink_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_found_dink_01` |
| Domain | dink_soft_game |
| Skill measured | dink_soft_game |
| Question | Bạn có biết dink là gì và thử được không? |
| Anchors 0–7 | 0: Không biết<br>1: Biết, chưa làm<br>2: Thử lỗi nhiều<br>3: Vài quả OK<br>4: Giữ vài pha<br>5: Cross OK<br>6: Ổn TB<br>7: Ổn áp lực |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | avg anchor 0–2 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_found_pos_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_found_pos_01` |
| Domain | doubles_positioning |
| Skill measured | doubles_positioning |
| Question | Khi đánh đôi, bạn đứng cạnh đồng đội hay lệch stagger? |
| Anchors 0–7 | 0: Không biết<br>1: Đứng sát<br>2: Thỉnh thoảng stagger<br>3: Stagger cơ bản<br>4: Che middle<br>5: Theo poach<br>6: Stack đơn giản<br>7: Linh hoạt |
| Difficulty | Cơ bản |
| Critical | Có |
| Adaptive trigger | avg anchor 0–2 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_found_rules_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_found_rules_01` |
| Domain | rules |
| Skill measured | rules |
| Question | Bạn có biết vùng kitchen (vôi) không? |
| Anchors 0–7 | 0: Không<br>1: Biết nhưng hay vào<br>2: Nhớ khi nhắc<br>3: Ít vôi chậm<br>4: OK giao lưu<br>5: OK đấu<br>6: Giải thích được<br>7: Luật tình huống |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | avg anchor 0–2 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_med_gs_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_med_gs_01` |
| Domain | groundstroke |
| Skill measured | groundstroke |
| Question | Forehand bạn ổn định hơn hay backhand? |
| Anchors 0–7 | 0: Cả hai yếu<br>1: Forehand hơn<br>2: Backhand hơn<br>3: Tương đương chậm<br>4: TB ổn<br>5: Đổi hướng<br>6: Dưới áp lực<br>7: Theo match-up |
| Difficulty | Trung bình |
| Critical | Không |
| Adaptive trigger | avg anchor 3–4 |
| Contradiction rule | core_gs_01, core_gs_02 |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | Meta-question so sánh FH/BH — không thay thế core gs scores. |

### adp_med_rally_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_med_rally_01` |
| Domain | rally_consistency |
| Skill measured | rally_consistency |
| Question | Rally 10 quả — bạn hoàn thành được bao nhiêu lần trong 5 điểm? |
| Anchors 0–7 | 0: 0<br>1: 1<br>2: 2<br>3: 3<br>4: 4<br>5: 5<br>6: Hầu hết<br>7: Luôn |
| Difficulty | Trung bình |
| Critical | Có |
| Adaptive trigger | avg anchor 3–4 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_med_err_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_med_err_01` |
| Domain | error_control |
| Skill measured | error_control |
| Question | Lỗi không ép buộc chiếm bao nhiêu % điểm thua? |
| Anchors 0–7 | 0: >80%<br>1: 60–80%<br>2: 40–60%<br>3: 30–40%<br>4: 20–30%<br>5: 10–20%<br>6: 5–10%<br>7: <5% |
| Difficulty | Trung bình |
| Critical | Có |
| Adaptive trigger | avg anchor 3–4 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_med_ts_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_med_ts_01` |
| Domain | third_shot |
| Skill measured | third_shot |
| Question | Sau return sâu, bạn drop hay drive nhiều hơn? |
| Anchors 0–7 | 0: Không biết<br>1: Toàn lỗi<br>2: Drop thử<br>3: Drive thử<br>4: Chọn lọc<br>5: Cân bằng<br>6: Theo đối thủ<br>7: Chủ động |
| Difficulty | Trung bình |
| Critical | Không |
| Adaptive trigger | avg anchor 3–4 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_med_tr_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_med_tr_01` |
| Domain | transition |
| Skill measured | transition |
| Question | Sau third-shot tốt, bạn lên kitchen trong bao nhiêu % điểm? |
| Anchors 0–7 | 0: 0%<br>1: <25%<br>2: 25–40%<br>3: 40–55%<br>4: 55–70%<br>5: 70–85%<br>6: >85%<br>7: Luôn đúng lúc |
| Difficulty | Trung bình |
| Critical | Có |
| Adaptive trigger | avg anchor 3–4 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_adv_dink_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_adv_dink_01` |
| Domain | dink_soft_game |
| Skill measured | dink_soft_game |
| Question | Bạn dink cross-court để kéo đối thủ rời middle? |
| Anchors 0–7 | 0: Không<br>1: Thử lỗi<br>2: Thỉnh thoảng<br>3: TB<br>4: Thường xuyên<br>5: Theo match-up<br>6: Dưới speed-up<br>7: Chủ động setup |
| Difficulty | Nâng cao |
| Critical | Có |
| Adaptive trigger | avg anchor 5–7 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_adv_reset_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_adv_reset_01` |
| Domain | block_reset |
| Skill measured | block_reset |
| Question | Sau bị speed-up, reset vào kitchen thành công? |
| Anchors 0–7 | 0: Không<br>1: Hiếm<br>2: Chậm OK<br>3: TB<br>4: Thường<br>5: Chọn góc<br>6: Dưới poach<br>7: Chủ động |
| Difficulty | Nâng cao |
| Critical | Có |
| Adaptive trigger | avg anchor 5–7 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_adv_vol_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_adv_vol_01` |
| Domain | volley |
| Skill measured | volley |
| Question | Put-away volley khi bóng cao — tỷ lệ thành công? |
| Anchors 0–7 | 0: 0%<br>1: <25%<br>2: 25–40%<br>3: 40–55%<br>4: 55–70%<br>5: 70–85%<br>6: >85%<br>7: Chủ động setup |
| Difficulty | Nâng cao |
| Critical | Không |
| Adaptive trigger | avg anchor 5–7 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_adv_tac_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_adv_tac_01` |
| Domain | tactical_decision |
| Skill measured | tactical_decision |
| Question | Bạn target yếu điểm đối thủ (backhand, middle, deep)? |
| Anchors 0–7 | 0: Không<br>1: Ngẫu nhiên<br>2: Thỉnh thoảng<br>3: TB<br>4: Thường<br>5: Theo set<br>6: Dưới áp lực<br>7: Đọc match-up |
| Difficulty | Nâng cao |
| Critical | Không |
| Adaptive trigger | avg anchor 5–7 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_adv_press_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_adv_press_01` |
| Domain | pressure_execution |
| Skill measured | pressure_execution |
| Question | Điểm quyết định (10–10+) — bạn giữ được lối chơi? |
| Anchors 0–7 | 0: Rất khó<br>1: Thường lỗi<br>2: Chậm OK<br>3: TB<br>4: Ổn<br>5: Tăng tập trung<br>6: Chủ động<br>7: Thích áp lực |
| Difficulty | Nâng cao |
| Critical | Không |
| Adaptive trigger | avg anchor 5–7 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_cc_srv_ret_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_cc_srv_ret_01` |
| Domain | serve |
| Skill measured | serve |
| Question | Bạn vừa chọn mức giao bóng cao — return của bạn so với giao? |
| Anchors 0–7 | 0: Return << giao<br>1: Return < giao<br>2: Gần bằng<br>3: Return > giao<br>4: Khớp<br>5: Khớp TB<br>6: Khớp áp lực<br>7: Return mạnh hơn |
| Difficulty | Trung bình |
| Critical | Có |
| Adaptive trigger | contradiction detected |
| Contradiction rule | core_srv_01, core_ret_01 |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_cc_dink_drive_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_cc_dink_drive_01` |
| Domain | dink_soft_game |
| Skill measured | dink_soft_game |
| Question | Bạn đánh drive mạnh nhưng dink — mức nào phản ánh đúng hơn? |
| Anchors 0–7 | 0: Chỉ drive<br>1: Drive >> dink<br>2: Drive > dink<br>3: Cân bằng<br>4: Dink > drive<br>5: Dink >> drive<br>6: Soft game chính<br>7: Hoàn toàn soft |
| Difficulty | Trung bình |
| Critical | Có |
| Adaptive trigger | contradiction detected |
| Contradiction rule | core_dink_01, core_gs_01 |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_cc_exp_rally_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_cc_exp_rally_01` |
| Domain | consistency |
| Skill measured | consistency |
| Question | Kinh nghiệm dài nhưng rally ngắn — điều nào đúng hơn? |
| Anchors 0–7 | 0: Kinh nghiệm quan trọng hơn<br>1: Hơi kinh nghiệm<br>2: Cân bằng<br>3: Rally quan trọng hơn<br>4: Rally dài hơn<br>5: Rally >> exp<br>6: Chưa đủ data<br>7: Cần HLV xem |
| Difficulty | Trung bình |
| Critical | Không |
| Adaptive trigger | contradiction detected |
| Contradiction rule | core_exp_01, core_exp_02 |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_adv_foot_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_adv_foot_01` |
| Domain | footwork |
| Skill measured | footwork |
| Question | Split-step và recovery sau mỗi cú? |
| Anchors 0–7 | 0: Không<br>1: Thỉnh thoảng<br>2: Chậm OK<br>3: TB<br>4: Thường<br>5: Theo poach<br>6: Dưới pace<br>7: Chủ động |
| Difficulty | Nâng cao |
| Critical | Không |
| Adaptive trigger | avg anchor 5–7 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_med_comm_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_med_comm_01` |
| Domain | communication |
| Skill measured | communication |
| Question | Gọi 'mine' khi bóng giữa hai người? |
| Anchors 0–7 | 0: Không<br>1: Hiếm<br>2: Chậm<br>3: TB<br>4: Thường<br>5: Sớm<br>6: Dưới attack<br>7: Chủ động |
| Difficulty | Trung bình |
| Critical | Không |
| Adaptive trigger | avg anchor 3–4 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_adv_stack_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_adv_stack_01` |
| Domain | doubles_positioning |
| Skill measured | doubles_positioning |
| Question | Stacking khi return — bạn và đồng đội? |
| Anchors 0–7 | 0: Không biết<br>1: Thử lỗi<br>2: Cơ bản<br>3: TB<br>4: Thường<br>5: Theo match-up<br>6: Che middle<br>7: Poach setup |
| Difficulty | Nâng cao |
| Critical | Có |
| Adaptive trigger | avg anchor 5–7 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_med_vol_blk_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_med_vol_blk_01` |
| Domain | volley |
| Skill measured | volley |
| Question | Volley defensive vs punch — bạn mạnh hơn ở? |
| Anchors 0–7 | 0: Không volley<br>1: Def yếu<br>2: Def TB<br>3: Cân bằng<br>4: Punch TB<br>5: Punch mạnh<br>6: Chọn lọc<br>7: Theo tình huống |
| Difficulty | Trung bình |
| Critical | Không |
| Adaptive trigger | avg anchor 3–4 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_found_exp_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_found_exp_01` |
| Domain | consistency |
| Skill measured | consistency |
| Question | Trước pickleball bạn chơi môn vợt nào? |
| Anchors 0–7 | 0: Không<br>1: Thể thao khác<br>2: Bóng bàn<br>3: Cầu lông<br>4: Tennis<br>5: Nhiều môn<br>6: Chuyên vợt<br>7: Chuyên pickleball |
| Difficulty | Cơ bản |
| Critical | Không |
| Adaptive trigger | avg anchor 0–2 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | Metadata nền tảng — không được cộng trực tiếp vào skill score lớn (chỉ adaptive, không core). |

### adp_adv_lob_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_adv_lob_01` |
| Domain | tactical_decision |
| Skill measured | tactical_decision |
| Question | Lob defensive khi bị ép tại kitchen? |
| Anchors 0–7 | 0: Không<br>1: Lỗi nhiều<br>2: Thỉnh thoảng<br>3: TB<br>4: Thường<br>5: Chọn lọc<br>6: Dưới poach<br>7: Chủ động |
| Difficulty | Nâng cao |
| Critical | Không |
| Adaptive trigger | avg anchor 5–7 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_med_serve_depth_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_med_serve_depth_01` |
| Domain | serve |
| Skill measured | serve |
| Question | Giao sâu (gần baseline đối phương)? |
| Anchors 0–7 | 0: Không<br>1: Hiếm<br>2: Chậm<br>3: TB<br>4: Thường<br>5: Theo người<br>6: Dưới áp lực<br>7: Setup third |
| Difficulty | Trung bình |
| Critical | Có |
| Adaptive trigger | avg anchor 3–4 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_adv_ernie_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_adv_ernie_01` |
| Domain | tactical_decision |
| Skill measured | tactical_decision |
| Question | Ernie hoặc counter-attack từ ngoài kitchen? |
| Anchors 0–7 | 0: Không biết<br>1: Thử lỗi<br>2: Thỉnh thoảng<br>3: TB<br>4: Chọn lọc<br>5: Thường<br>6: Dưới setup<br>7: Chủ động |
| Difficulty | Nâng cao |
| Critical | Không |
| Adaptive trigger | avg anchor 5–7 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_cc_pos_drive_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_cc_pos_drive_01` |
| Domain | doubles_positioning |
| Skill measured | doubles_positioning |
| Question | Drive mạnh nhưng hay mất vị trí — điều nào đúng? |
| Anchors 0–7 | 0: Drive quan trọng hơn<br>1: Hơi drive<br>2: Cân bằng<br>3: Vị trí quan trọng hơn<br>4: Vị trí >> drive<br>5: Cần HLV<br>6: Chưa rõ<br>7: Mâu thuẫn |
| Difficulty | Trung bình |
| Critical | Có |
| Adaptive trigger | contradiction detected |
| Contradiction rule | core_pos_01, core_gs_01 |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_med_pressure_dink_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_med_pressure_dink_01` |
| Domain | dink_soft_game |
| Skill measured | dink_soft_game |
| Question | Speed-up từ kitchen — bạn block hay counter? |
| Anchors 0–7 | 0: Không biết<br>1: Thường lỗi<br>2: Block thử<br>3: TB block<br>4: Counter thử<br>5: Chọn lọc<br>6: Dưới poach<br>7: Chủ động |
| Difficulty | Trung bình |
| Critical | Có |
| Adaptive trigger | avg anchor 3–4 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_adv_return_depth_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_adv_return_depth_01` |
| Domain | return |
| Skill measured | return |
| Question | Return deep giữ đối thủ baseline? |
| Anchors 0–7 | 0: Không<br>1: Hiếm<br>2: Chậm<br>3: TB<br>4: Thường<br>5: Theo server<br>6: Dưới giao mạnh<br>7: Setup third |
| Difficulty | Nâng cao |
| Critical | Có |
| Adaptive trigger | avg anchor 5–7 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

### adp_med_rules_nvz_01

| Trường | Nội dung |
|--------|----------|
| ID | `adp_med_rules_nvz_01` |
| Domain | rules |
| Skill measured | rules |
| Question | Bóng trên line kitchen — bạn xử lý đúng luật? |
| Anchors 0–7 | 0: Không chắc<br>1: Hay sai<br>2: Nhắc mới đúng<br>3: TB<br>4: Thường đúng<br>5: Tranh chấp OK<br>6: Giải thích<br>7: Trọng tài level |
| Difficulty | Trung bình |
| Critical | Không |
| Adaptive trigger | avg anchor 3–4 |
| Contradiction rule | — |
| Applicable mode | Doubles (singles: V5-B.1) |
| Review note | — |

## Content verdict

**V5-B CONTENT:** PASS with **NEEDS REVISION** on items 1–4 above before pilot.

