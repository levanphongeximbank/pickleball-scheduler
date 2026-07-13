/* Rating V5 trusted server bundle */

// src/features/pick-vn-rating-v5/server/trustedRuntimeMarker.js
var TRUSTED_RUNTIME_ID = "pick-vn-rating-v5-trusted-server";
function assertTrustedRuntime(context = "unknown") {
  if (typeof globalThis !== "undefined" && globalThis.document?.createElement) {
    throw new Error(
      `Pick_VN Rating V5 trusted server runtime must not execute in browser (${context})`
    );
  }
  return TRUSTED_RUNTIME_ID;
}

// src/features/pick-vn-rating-v5/constants/ratingScale.js
var V5_MIN_RATING = 1.5;
var V5_MAX_RATING = 6;
function clampRatingMean(value, fallback = 3.5) {
  const numeric = Number(value);
  const base = Number.isFinite(numeric) ? numeric : Number(fallback);
  const safe = Number.isFinite(base) ? base : 3.5;
  return Math.min(V5_MAX_RATING, Math.max(V5_MIN_RATING, safe));
}
function toDisplayRating(ratingMean) {
  const clamped = clampRatingMean(ratingMean);
  return Math.round(clamped * 10) / 10;
}

// src/features/pick-vn-rating-v5/constants/versions.js
var SYSTEM_VERSION = "pick-vn-rating-v5";
var ASSESSMENT_VERSION = "assessment-v5.0f";
var QUESTION_BANK_VERSION = "qbank-v5.0f";
var SCORING_ENGINE_VERSION = "scoring-v5.0f";
var GATE_VERSION = "gates-v5.0f";
var MATCH_ENGINE_VERSION = "match-v5.0";
var RELIABILITY_VERSION = "reliability-v5.0";
var CALIBRATION_VERSION = "calibration-v5.0f";
var GLOSSARY_VERSION = "glossary-v5.0f";
var V5_VERSION_BUNDLE = Object.freeze({
  systemVersion: SYSTEM_VERSION,
  assessmentVersion: ASSESSMENT_VERSION,
  questionBankVersion: QUESTION_BANK_VERSION,
  scoringEngineVersion: SCORING_ENGINE_VERSION,
  gateVersion: GATE_VERSION,
  matchEngineVersion: MATCH_ENGINE_VERSION,
  reliabilityVersion: RELIABILITY_VERSION,
  calibrationVersion: CALIBRATION_VERSION,
  glossaryVersion: GLOSSARY_VERSION
});

// src/features/pick-vn-rating-v5/constants/domainWeights.js
var DOUBLES_DOMAIN_WEIGHTS = Object.freeze({
  serve: 0.06,
  return: 0.07,
  groundstroke: 0.09,
  dink_soft_game: 0.12,
  third_shot: 0.065,
  transition: 0.065,
  volley: 0.04,
  block_reset: 0.08,
  footwork: 0.08,
  doubles_positioning: 0.05,
  communication: 0.05,
  tactical_decision: 0.1,
  consistency: 0.045,
  pressure_execution: 0.045,
  rules: 0.04
});
var SINGLES_DOMAIN_WEIGHTS = Object.freeze({
  serve: 0.08,
  return: 0.08,
  groundstroke: 0.1,
  court_coverage: 0.12,
  passing_shot: 0.1,
  serve_plus_one: 0.08,
  return_plus_one: 0.08,
  endurance: 0.06,
  full_court_defense: 0.1,
  tactical_decision: 0.1,
  consistency: 0.05,
  pressure_execution: 0.05,
  rules: 0.04
});
function getDomainWeights(ratingMode) {
  return ratingMode === "singles" ? SINGLES_DOMAIN_WEIGHTS : DOUBLES_DOMAIN_WEIGHTS;
}

// src/features/pick-vn-rating-v5/constants/ratingModes.js
var RATING_MODE = Object.freeze({
  SINGLES: "singles",
  DOUBLES: "doubles"
});
var RATING_MODE_LABELS = Object.freeze({
  [RATING_MODE.SINGLES]: "\u0110\xE1nh \u0111\u01A1n",
  [RATING_MODE.DOUBLES]: "\u0110\xE1nh \u0111\xF4i"
});

// src/features/pick-vn-rating-v5/constants/ratingStatus.js
var V5_RATING_STATUS = Object.freeze({
  NOT_ASSESSED: "not_assessed",
  SELF_ASSESSED: "self_assessed",
  PROVISIONAL: "provisional",
  PROJECTED: "projected",
  UNDER_REVIEW: "under_review",
  COURT_ASSESSED: "court_assessed",
  COACH_VERIFIED: "coach_verified",
  MATCH_CALIBRATED: "match_calibrated",
  VERIFIED: "verified",
  RELIABLE: "reliable",
  STABLE: "stable",
  OVERRIDDEN: "overridden",
  SUSPENDED: "suspended"
});
var V5_RATING_STATUS_LABELS = Object.freeze({
  [V5_RATING_STATUS.NOT_ASSESSED]: "Ch\u01B0a \u0111\xE1nh gi\xE1",
  [V5_RATING_STATUS.SELF_ASSESSED]: "T\u1EF1 \u0111\xE1nh gi\xE1",
  [V5_RATING_STATUS.PROVISIONAL]: "T\u1EA1m t\xEDnh",
  [V5_RATING_STATUS.PROJECTED]: "D\u1EF1 ki\u1EBFn",
  [V5_RATING_STATUS.UNDER_REVIEW]: "\u0110ang xem x\xE9t",
  [V5_RATING_STATUS.COURT_ASSESSED]: "\u0110\xE3 ki\u1EC3m tra s\xE2n",
  [V5_RATING_STATUS.COACH_VERIFIED]: "HLV x\xE1c nh\u1EADn",
  [V5_RATING_STATUS.MATCH_CALIBRATED]: "\u0110\xE3 hi\u1EC7u ch\u1EC9nh",
  [V5_RATING_STATUS.VERIFIED]: "\u0110\xE3 x\xE1c minh",
  [V5_RATING_STATUS.RELIABLE]: "\u0110\xE1ng tin c\u1EADy",
  [V5_RATING_STATUS.STABLE]: "\u1ED4n \u0111\u1ECBnh",
  [V5_RATING_STATUS.OVERRIDDEN]: "Ghi \u0111\xE8 c\xF3 ki\u1EC3m so\xE1t",
  [V5_RATING_STATUS.SUSPENDED]: "T\u1EA1m ng\u01B0ng"
});

// src/features/pick-vn-rating-v5/constants/ratingGlossary.js
var RATING_GLOSSARY = Object.freeze({
  serve: {
    code: "serve",
    term_en: "Serve",
    term_vi: "giao b\xF3ng",
    short_description_vi: "K\u1EF9 n\u0103ng giao b\xF3ng v\xE0o s\xE2n \u0111\u1ED1i ph\u01B0\u01A1ng",
    long_description_vi: "Giao b\xF3ng h\u1EE3p l\u1EC7, \u0111\u1ED9 s\xE2u v\xE0 h\u01B0\u1EDBng b\xF3ng theo chi\u1EBFn thu\u1EADt.",
    aliases: ["giao b\xF3ng", "service"],
    glossary_version: GLOSSARY_VERSION
  },
  return: {
    code: "return",
    term_en: "Return",
    term_vi: "tr\u1EA3 giao b\xF3ng",
    short_description_vi: "Tr\u1EA3 giao b\xF3ng an to\xE0n v\xE0 c\xF3 ch\u1EE7 \u0111\xEDch",
    long_description_vi: "Return s\xE2u, th\u1EA5p, h\u1EA1n ch\u1EBF b\u1ECB attack ngay sau giao.",
    aliases: ["tr\u1EA3 giao", "return of serve"],
    glossary_version: GLOSSARY_VERSION
  },
  groundstroke: {
    code: "groundstroke",
    term_en: "Groundstroke",
    term_vi: "c\xFA \u0111\xE1nh t\u1EEB baseline",
    short_description_vi: "Forehand/backhand t\u1EEB cu\u1ED1i s\xE2n",
    long_description_vi: "Drive v\xE0 rally t\u1EEB baseline v\u1EDBi ki\u1EC3m so\xE1t h\u01B0\u1EDBng v\xE0 \u0111\u1ED9 s\xE2u.",
    aliases: [],
    glossary_version: GLOSSARY_VERSION
  },
  drive: {
    code: "drive",
    term_en: "Drive",
    term_vi: "c\xFA \u0111\xE1nh m\u1EA1nh (drive)",
    short_description_vi: "\u0110\xE1nh b\xF3ng nhanh, s\xE2u",
    long_description_vi: "C\xFA drive t\u1EEB baseline ho\u1EB7c transition v\u1EDBi pace v\xE0 depth.",
    aliases: [],
    glossary_version: GLOSSARY_VERSION
  },
  rally: {
    code: "rally",
    term_en: "Rally",
    term_vi: "pha b\xF3ng li\xEAn ti\u1EBFp",
    short_description_vi: "Trao b\xF3ng qua l\u1EA1i",
    long_description_vi: "Chu\u1ED7i \u0111\xE1nh b\xF3ng li\xEAn ti\u1EBFp gi\u1EEFa c\xE1c b\xEAn.",
    aliases: [],
    glossary_version: GLOSSARY_VERSION
  },
  forehand: {
    code: "forehand",
    term_en: "Forehand",
    term_vi: "c\xFA thu\u1EADn tay",
    short_description_vi: "\u0110\xE1nh thu\u1EADn",
    long_description_vi: "Forehand drive v\xE0 ki\u1EC3m so\xE1t t\u1EEB baseline.",
    aliases: ["thu\u1EADn tay"],
    glossary_version: GLOSSARY_VERSION
  },
  backhand: {
    code: "backhand",
    term_en: "Backhand",
    term_vi: "c\xFA tr\xE1i tay",
    short_description_vi: "\u0110\xE1nh tr\xE1i",
    long_description_vi: "Backhand drive v\xE0 \u1ED5n \u0111\u1ECBnh t\u1EEB baseline.",
    aliases: ["tr\xE1i tay"],
    glossary_version: GLOSSARY_VERSION
  },
  baseline: {
    code: "baseline",
    term_en: "Baseline",
    term_vi: "cu\u1ED1i s\xE2n",
    short_description_vi: "V\u1ECB tr\xED cu\u1ED1i s\xE2n",
    long_description_vi: "\u0110\u01B0\u1EDDng baseline \u2014 v\xF9ng \u0111\xE1nh groundstroke.",
    aliases: ["cu\u1ED1i s\xE2n"],
    glossary_version: GLOSSARY_VERSION
  },
  crosscourt: {
    code: "crosscourt",
    term_en: "Crosscourt",
    term_vi: "\u0111\xE1nh ch\xE9o s\xE2n",
    short_description_vi: "G\xF3c ch\xE9o",
    long_description_vi: "\u0110\xE1nh b\xF3ng ch\xE9o qua s\xE2n.",
    aliases: ["cross-court", "ch\xE9o s\xE2n"],
    glossary_version: GLOSSARY_VERSION
  },
  down_the_line: {
    code: "down_the_line",
    term_en: "Down the line",
    term_vi: "\u0111\xE1nh d\u1ECDc \u0111\u01B0\u1EDDng bi\xEAn",
    short_description_vi: "Theo line",
    long_description_vi: "\u0110\xE1nh b\xF3ng d\u1ECDc theo \u0111\u01B0\u1EDDng bi\xEAn.",
    aliases: ["d\u1ECDc line"],
    glossary_version: GLOSSARY_VERSION
  },
  pop_up: {
    code: "pop_up",
    term_en: "Pop-up",
    term_vi: "b\xF3ng b\u1EADt cao",
    short_description_vi: "B\xF3ng qu\xE1 cao d\u1EC5 b\u1ECB attack",
    long_description_vi: "L\u1ED7i pop-up t\u1EA1i kitchen ho\u1EB7c khi dink.",
    aliases: ["pop-up", "popup"],
    glossary_version: GLOSSARY_VERSION
  },
  counterattack: {
    code: "counterattack",
    term_en: "Counterattack",
    term_vi: "ph\u1EA3n c\xF4ng",
    short_description_vi: "Ph\u1EA3n \u0111\xF2n sau block",
    long_description_vi: "Counter sau speed-up ho\u1EB7c attack \u0111\u1ED1i ph\u01B0\u01A1ng.",
    aliases: ["counter-attack", "counter"],
    glossary_version: GLOSSARY_VERSION
  },
  unforced_error: {
    code: "unforced_error",
    term_en: "Unforced error",
    term_vi: "l\u1ED7i kh\xF4ng \xE9p bu\u1ED9c",
    short_description_vi: "L\u1ED7i t\u1EF1 g\xE2y ra",
    long_description_vi: "M\u1EA5t \u0111i\u1EC3m do l\u1ED7i khi kh\xF4ng b\u1ECB \xE9p bu\u1ED9c.",
    aliases: ["l\u1ED7i kh\xF4ng \xE9p bu\u1ED9c"],
    glossary_version: GLOSSARY_VERSION
  },
  shot_selection: {
    code: "shot_selection",
    term_en: "Shot selection",
    term_vi: "l\u1EF1a ch\u1ECDn c\xFA \u0111\xE1nh",
    short_description_vi: "Ch\u1ECDn c\xFA ph\xF9 h\u1EE3p",
    long_description_vi: "Quy\u1EBFt \u0111\u1ECBnh drive/dink/lob theo t\xECnh hu\u1ED1ng.",
    aliases: ["l\u1EF1a ch\u1ECDn c\xFA"],
    glossary_version: GLOSSARY_VERSION
  },
  recovery_position: {
    code: "recovery_position",
    term_en: "Recovery position",
    term_vi: "v\u1ECB tr\xED ph\u1EE5c h\u1ED3i",
    short_description_vi: "V\u1EC1 v\u1ECB tr\xED sau c\xFA \u0111\xE1nh",
    long_description_vi: "Recovery v\u1EC1 ready position sau m\u1ED7i pha.",
    aliases: ["ph\u1EE5c h\u1ED3i v\u1ECB tr\xED"],
    glossary_version: GLOSSARY_VERSION
  },
  dink_soft_game: {
    code: "dink_soft_game",
    term_en: "Dink",
    term_vi: "c\xFA \u0111\xE1nh m\u1EC1m g\u1EA7n v\xF9ng c\u1EA5m v\xF4-l\xEA",
    short_description_vi: "Soft game t\u1EA1i kitchen",
    long_description_vi: "Dink th\u1EA5p qua l\u01B0\u1EDBi, gi\u1EEF nh\u1ECBp v\xE0 ki\u1EC3m so\xE1t t\u1ED1c \u0111\u1ED9 b\xF3ng \u1EDF kitchen.",
    aliases: ["dink", "soft game"],
    glossary_version: GLOSSARY_VERSION
  },
  third_shot: {
    code: "third_shot",
    term_en: "Third shot",
    term_vi: "c\xFA \u0111\xE1nh th\u1EE9 ba",
    short_description_vi: "L\u01B0\u1EE3t \u0111\xE1nh th\u1EE9 ba sau return",
    long_description_vi: "Third shot \u2014 l\u1EF1a ch\u1ECDn drop, drive ho\u1EB7c chi\u1EBFn thu\u1EADt sau return.",
    aliases: ["third shot", "third-shot"],
    glossary_version: GLOSSARY_VERSION
  },
  third_shot_drop: {
    code: "third_shot_drop",
    term_en: "Third-shot drop",
    term_vi: "c\xFA th\u1EA3 b\xF3ng m\u1EC1m \u1EDF l\u01B0\u1EE3t \u0111\xE1nh th\u1EE9 ba",
    short_description_vi: "Drop v\xE0o kitchen",
    long_description_vi: "Third-shot drop \u2014 \u0111\u01B0a b\xF3ng m\u1EC1m v\xE0o kitchen \u0111\u1ED1i ph\u01B0\u01A1ng.",
    aliases: ["third shot drop"],
    glossary_version: GLOSSARY_VERSION
  },
  third_shot_drive: {
    code: "third_shot_drive",
    term_en: "Third-shot drive",
    term_vi: "c\xFA \u0111\xE1nh m\u1EA1nh \u1EDF l\u01B0\u1EE3t \u0111\xE1nh th\u1EE9 ba",
    short_description_vi: "Drive third shot",
    long_description_vi: "Third-shot drive \u2014 t\u1EA5n c\xF4ng sau return khi c\xF3 c\u01A1 h\u1ED9i.",
    aliases: ["third shot drive"],
    glossary_version: GLOSSARY_VERSION
  },
  transition: {
    code: "transition",
    term_en: "Transition",
    term_vi: "chuy\u1EC3n ti\u1EBFp t\u1EEB baseline l\xEAn kitchen",
    short_description_vi: "Di chuy\u1EC3n l\xEAn/l\xF9i \u0111\xFAng th\u1EDDi \u0111i\u1EC3m",
    long_description_vi: "Transition t\u1EEB baseline v\xE0o kitchen v\xE0 x\u1EED l\xFD v\xF9ng chuy\u1EC3n ti\u1EBFp.",
    aliases: ["transition zone", "l\xEAn kitchen"],
    glossary_version: GLOSSARY_VERSION
  },
  transition_zone: {
    code: "transition_zone",
    term_en: "Transition zone",
    term_vi: "v\xF9ng chuy\u1EC3n ti\u1EBFp",
    short_description_vi: "V\xF9ng gi\u1EEFa baseline v\xE0 kitchen",
    long_description_vi: "No-man's land \u2014 v\xF9ng d\u1EC5 b\u1ECB attack n\u1EBFu \u0111\u1EE9ng l\u1EA1i qu\xE1 l\xE2u.",
    aliases: ["no-man's land", "no mans land"],
    glossary_version: GLOSSARY_VERSION
  },
  volley: {
    code: "volley",
    term_en: "Volley",
    term_vi: "c\xFA \u0111\xE1nh volley",
    short_description_vi: "\u0110\xE1nh b\xF3ng tr\xEAn kh\xF4ng",
    long_description_vi: "Volley punch, put-away v\xE0 volley ph\xF2ng th\u1EE7 t\u1EA1i kitchen line.",
    aliases: ["volley punch"],
    glossary_version: GLOSSARY_VERSION
  },
  block_reset: {
    code: "block_reset",
    term_en: "Block",
    term_vi: "ch\u1EB7n b\xF3ng",
    short_description_vi: "Block v\xE0 reset",
    long_description_vi: "Block drive \u0111\u1ED1i ph\u01B0\u01A1ng; Reset (l\xE0m m\u1EC1m b\xF3ng \u0111\u1EC3 \u0111\u01B0a pha b\xF3ng v\u1EC1 tr\u1EA1ng th\xE1i trung h\xF2a).",
    aliases: ["block", "reset"],
    glossary_version: GLOSSARY_VERSION
  },
  reset: {
    code: "reset",
    term_en: "Reset",
    term_vi: "l\xE0m m\u1EC1m b\xF3ng \u0111\u1EC3 \u0111\u01B0a pha b\xF3ng v\u1EC1 tr\u1EA1ng th\xE1i trung h\xF2a",
    short_description_vi: "\u0110\u01B0a rally v\u1EC1 trung t\xEDnh",
    long_description_vi: "Reset sau khi b\u1ECB attack \u0111\u1EC3 l\u1EA5y l\u1EA1i nh\u1ECBp.",
    aliases: [],
    glossary_version: GLOSSARY_VERSION
  },
  footwork: {
    code: "footwork",
    term_en: "Footwork",
    term_vi: "k\u1EF9 n\u0103ng di chuy\u1EC3n ch\xE2n",
    short_description_vi: "Split-step v\xE0 recovery",
    long_description_vi: "Di chuy\u1EC3n ch\xE2n, split-step v\xE0 ph\u1EE5c h\u1ED3i v\u1ECB tr\xED sau m\u1ED7i c\xFA.",
    aliases: ["di chuy\u1EC3n ch\xE2n"],
    glossary_version: GLOSSARY_VERSION
  },
  doubles_positioning: {
    code: "doubles_positioning",
    term_en: "Positioning",
    term_vi: "kh\u1EA3 n\u0103ng gi\u1EEF v\u1ECB tr\xED",
    short_description_vi: "V\u1ECB tr\xED \u0111\xE1nh \u0111\xF4i",
    long_description_vi: "Stagger, che middle/line v\xE0 ph\u1ED1i h\u1EE3p v\u1EDBi \u0111\u1ED3ng \u0111\u1ED9i.",
    aliases: ["positioning", "v\u1ECB tr\xED"],
    glossary_version: GLOSSARY_VERSION
  },
  communication: {
    code: "communication",
    term_en: "Communication",
    term_vi: "giao ti\u1EBFp tr\xEAn s\xE2n",
    short_description_vi: "Mine/yours, switch",
    long_description_vi: "Giao ti\u1EBFp v\u1EDBi \u0111\u1ED3ng \u0111\u1ED9i trong \u0111\xE1nh \u0111\xF4i.",
    aliases: ["giao ti\u1EBFp"],
    glossary_version: GLOSSARY_VERSION
  },
  tactical_decision: {
    code: "tactical_decision",
    term_en: "Tactical decision",
    term_vi: "quy\u1EBFt \u0111\u1ECBnh chi\u1EBFn thu\u1EADt",
    short_description_vi: "Ch\u1ECDn c\xFA \u0111\xE1nh theo t\xECnh hu\u1ED1ng",
    long_description_vi: "L\u1EF1a ch\u1ECDn drive/dink/lob v\xE0 th\u1EDDi \u0111i\u1EC3m t\u1EA5n c\xF4ng/ph\xF2ng th\u1EE7.",
    aliases: ["chi\u1EBFn thu\u1EADt", "tactics"],
    glossary_version: GLOSSARY_VERSION
  },
  consistency: {
    code: "consistency",
    term_en: "Consistency",
    term_vi: "\u0111\u1ED9 \u1ED5n \u0111\u1ECBnh",
    short_description_vi: "Gi\u1EEF nh\u1ECBp v\xE0 \xEDt l\u1ED7i",
    long_description_vi: "Duy tr\xEC rally v\xE0 l\u1ED1i ch\u01A1i \u1ED5n \u0111\u1ECBnh theo th\u1EDDi gian.",
    aliases: ["\u1ED5n \u0111\u1ECBnh"],
    glossary_version: GLOSSARY_VERSION
  },
  pressure_execution: {
    code: "pressure_execution",
    term_en: "Pressure execution",
    term_vi: "th\u1EF1c thi d\u01B0\u1EDBi \xE1p l\u1EF1c",
    short_description_vi: "Gi\u1EEF l\u1ED1i ch\u01A1i khi \u0111i\u1EC3m quan tr\u1ECDng",
    long_description_vi: "Th\u1EF1c hi\u1EC7n k\u1EF9 thu\u1EADt t\u1ED1t trong \u0111i\u1EC3m quy\u1EBFt \u0111\u1ECBnh.",
    aliases: ["\xE1p l\u1EF1c"],
    glossary_version: GLOSSARY_VERSION
  },
  rules: {
    code: "rules",
    term_en: "Rules",
    term_vi: "lu\u1EADt t\xECnh hu\u1ED1ng",
    short_description_vi: "Kitchen/v\xF4i, giao b\xF3ng",
    long_description_vi: "N\u1EAFm v\xE0 \xE1p d\u1EE5ng lu\u1EADt pickleball trong thi \u0111\u1EA5u.",
    aliases: ["lu\u1EADt", "kitchen rule"],
    glossary_version: GLOSSARY_VERSION
  },
  rally_consistency: {
    code: "rally_consistency",
    term_en: "Rally consistency",
    term_vi: "\u0111\u1ED9 \u1ED5n \u0111\u1ECBnh rally",
    short_description_vi: "Gi\u1EEF rally baseline",
    long_description_vi: "Duy tr\xEC rally groundstroke v\u1EDBi \xEDt l\u1ED7i kh\xF4ng \xE9p bu\u1ED9c.",
    aliases: ["rally"],
    glossary_version: GLOSSARY_VERSION
  },
  error_control: {
    code: "error_control",
    term_en: "Error control",
    term_vi: "ki\u1EC3m so\xE1t l\u1ED7i",
    short_description_vi: "H\u1EA1n ch\u1EBF l\u1ED7i kh\xF4ng \xE9p bu\u1ED9c",
    long_description_vi: "Tr\xE1nh pop-up, v\xF4i v\xE0 l\u1ED7i s\u1EDBm trong rally.",
    aliases: ["l\u1ED7i kh\xF4ng \xE9p bu\u1ED9c"],
    glossary_version: GLOSSARY_VERSION
  },
  kitchen: {
    code: "kitchen",
    term_en: "Kitchen",
    term_vi: "v\xF9ng c\u1EA5m v\xF4-l\xEA",
    short_description_vi: "Non-volley zone (NVZ)",
    long_description_vi: "V\xF9ng 7 feet hai b\xEAn l\u01B0\u1EDBi \u2014 kh\xF4ng volley trong v\xF9i.",
    aliases: ["v\xF4i", "NVZ", "non-volley zone"],
    glossary_version: GLOSSARY_VERSION
  },
  poach: {
    code: "poach",
    term_en: "Poach",
    term_vi: "b\u0103ng c\u1EAFt b\xF3ng",
    short_description_vi: "C\u1EAFt b\xF3ng gi\u1EEFa s\xE2n",
    long_description_vi: "\u0110\u1ED3ng \u0111\u1ED9i b\u0103ng sang c\u1EAFt b\xF3ng \u1EDF gi\u1EEFa.",
    aliases: ["b\u0103ng c\u1EAFt"],
    glossary_version: GLOSSARY_VERSION
  },
  stack: {
    code: "stack",
    term_en: "Stack",
    term_vi: "chi\u1EBFn thu\u1EADt x\u1EBFp v\u1ECB tr\xED",
    short_description_vi: "Stacking formation",
    long_description_vi: "X\u1EBFp v\u1ECB tr\xED \u0111\u1EC3 t\u1ED1i \u01B0u tay thu\u1EADn khi return.",
    aliases: ["stacking"],
    glossary_version: GLOSSARY_VERSION
  },
  ernie: {
    code: "ernie",
    term_en: "Erne",
    term_vi: "c\xFA \u0111\xE1nh ngo\xE0i v\xF9ng c\u1EA5m v\xF4-l\xEA s\xE1t l\u01B0\u1EDBi",
    short_description_vi: "Attack t\u1EEB ngo\xE0i kitchen",
    long_description_vi: "Ch\u1EA1y ra ngo\xE0i kitchen \u0111\u1EC3 attack s\xE1t l\u01B0\u1EDBi.",
    aliases: [],
    glossary_version: GLOSSARY_VERSION
  },
  atp: {
    code: "atp",
    term_en: "ATP \u2013 Around the Post",
    term_vi: "\u0111\xE1nh b\xF3ng v\xF2ng ngo\xE0i c\u1ED9t l\u01B0\u1EDBi",
    short_description_vi: "Around the post shot",
    long_description_vi: "\u0110\xE1nh b\xF3ng v\xF2ng qua c\u1ED9t l\u01B0\u1EDBi khi b\xF3ng \u0111i ra ngo\xE0i.",
    aliases: ["around the post"],
    glossary_version: GLOSSARY_VERSION
  },
  lob: {
    code: "lob",
    term_en: "Lob",
    term_vi: "c\xFA lob ph\xF2ng th\u1EE7",
    short_description_vi: "B\xF3ng cao qua \u0111\u1ED1i th\u1EE7",
    long_description_vi: "Lob defensive khi b\u1ECB \xE9p t\u1EA1i kitchen.",
    aliases: [],
    glossary_version: GLOSSARY_VERSION
  },
  speed_up: {
    code: "speed_up",
    term_en: "Speed-up",
    term_vi: "t\u0103ng t\u1ED1c b\xF3ng t\u1EEB kitchen",
    short_description_vi: "\u0110\xE1nh nhanh t\u1EEB dink",
    long_description_vi: "\u0110\u1ED9t ng\u1ED9t t\u0103ng pace t\u1EEB pha dink.",
    aliases: ["speedup"],
    glossary_version: GLOSSARY_VERSION
  },
  put_away: {
    code: "put_away",
    term_en: "Put-away",
    term_vi: "c\xFA k\u1EBFt th\xFAc \u0111i\u1EC3m",
    short_description_vi: "Volley k\u1EBFt th\xFAc pha",
    long_description_vi: "Put-away volley khi b\xF3ng cao \u0111\u1EC3 th\u1EAFng \u0111i\u1EC3m.",
    aliases: ["put away", "putaway"],
    glossary_version: GLOSSARY_VERSION
  },
  foot_fault: {
    code: "foot_fault",
    term_en: "Foot fault",
    term_vi: "l\u1ED7i ch\xE2n khi giao",
    short_description_vi: "Vi ph\u1EA1m v\u1ECB tr\xED giao",
    long_description_vi: "Foot fault \u2014 ch\u1EA1m v\u1EA1ch ho\u1EB7c b\u01B0\u1EDBc qu\xE1 khi giao.",
    aliases: ["foot-fault"],
    glossary_version: GLOSSARY_VERSION
  },
  match_up: {
    code: "match_up",
    term_en: "Match-up",
    term_vi: "c\u1EB7p \u0111\u1EA5u / \u0111\u1ED1i s\u1EE7",
    short_description_vi: "So kh\u1EDBp \u0111\u1ED1i th\u1EE7",
    long_description_vi: "\u0110\u1ECDc match-up \u2014 \u0111i\u1EC3m m\u1EA1nh/y\u1EBFu theo c\u1EB7p \u0111\u1EA5u.",
    aliases: ["match-up", "matchup"],
    glossary_version: GLOSSARY_VERSION
  },
  court_coverage: {
    code: "court_coverage",
    term_en: "Court coverage",
    term_vi: "kh\u1EA3 n\u0103ng bao qu\xE1t s\xE2n",
    short_description_vi: "Singles \u2014 V5-B.1",
    long_description_vi: "Kh\u1EA3 n\u0103ng ph\u1EE7 s\xE2n trong \u0111\xE1nh \u0111\u01A1n.",
    aliases: [],
    glossary_version: GLOSSARY_VERSION
  },
  reliability_score: {
    code: "reliability_score",
    term_en: "Reliability score",
    term_vi: "\u0111i\u1EC3m \u0111\u1ED9 tin c\u1EADy",
    short_description_vi: "0\u2013100",
    long_description_vi: "M\u1EE9c tin c\u1EADy v\xE0o rating d\u1EF1a tr\xEAn b\u1EB1ng ch\u1EE9ng v\xE0 volume.",
    aliases: ["reliability"],
    glossary_version: GLOSSARY_VERSION
  },
  provisional_rating: {
    code: "provisional_rating",
    term_en: "Provisional rating",
    term_vi: "\u0111i\u1EC3m tr\xECnh \u0111\u1ED9 t\u1EA1m t\xEDnh",
    short_description_vi: "Ch\u01B0a \u0111\u1EE7 verified",
    long_description_vi: "Rating t\u1EA1m t\u1EEB questionnaire ho\u1EB7c open track.",
    aliases: ["provisional"],
    glossary_version: GLOSSARY_VERSION
  },
  verified_rating: {
    code: "verified_rating",
    term_en: "Verified rating",
    term_vi: "\u0111i\u1EC3m tr\xECnh \u0111\u1ED9 \u0111\xE3 x\xE1c minh",
    short_description_vi: "Evidence level 4\u20135",
    long_description_vi: "Rating t\u1EEB tr\u1EADn/gi\u1EA3i/HLV \u0111\xE3 x\xE1c th\u1EF1c.",
    aliases: ["verified"],
    glossary_version: GLOSSARY_VERSION
  },
  display_rating: {
    code: "display_rating",
    term_en: "Display rating",
    term_vi: "\u0111i\u1EC3m tr\xECnh \u0111\u1ED9 hi\u1EC3n th\u1ECB",
    short_description_vi: "L\xE0m tr\xF2n 0.1",
    long_description_vi: "Rating c\xF4ng khai sau resolver open/verified.",
    aliases: [],
    glossary_version: GLOSSARY_VERSION
  },
  contradiction: {
    code: "contradiction",
    term_en: "Contradiction",
    term_vi: "m\xE2u thu\u1EABn c\xE2u tr\u1EA3 l\u1EDDi",
    short_description_vi: "Consistency check",
    long_description_vi: "C\xE2u tr\u1EA3 l\u1EDDi kh\xF4ng nh\u1EA5t qu\xE1n gi\u1EEFa c\xE1c domain li\xEAn quan.",
    aliases: ["m\xE2u thu\u1EABn"],
    glossary_version: GLOSSARY_VERSION
  }
});
var GLOSSARY_CODES = Object.freeze(Object.keys(RATING_GLOSSARY));
function getGlossaryEntry(code) {
  return RATING_GLOSSARY[code] ?? null;
}

// src/features/pick-vn-rating-v5/constants/domainCodes.js
var DOMAIN_CODES = Object.freeze({
  SERVE: "serve",
  RETURN: "return",
  GROUNDSTROKE: "groundstroke",
  DINK_SOFT_GAME: "dink_soft_game",
  THIRD_SHOT: "third_shot",
  TRANSITION: "transition",
  VOLLEY: "volley",
  BLOCK_RESET: "block_reset",
  FOOTWORK: "footwork",
  DOUBLES_POSITIONING: "doubles_positioning",
  COMMUNICATION: "communication",
  TACTICAL_DECISION: "tactical_decision",
  CONSISTENCY: "consistency",
  PRESSURE_EXECUTION: "pressure_execution",
  RULES: "rules",
  RALLY_CONSISTENCY: "rally_consistency",
  ERROR_CONTROL: "error_control"
});
var GATE_AUXILIARY_DOMAIN_CODES = Object.freeze([
  DOMAIN_CODES.RALLY_CONSISTENCY,
  DOMAIN_CODES.ERROR_CONTROL
]);
var SINGLES_DOMAIN_CODES = Object.freeze({
  COURT_COVERAGE: "court_coverage",
  PASSING_SHOT: "passing_shot",
  SERVE_PLUS_ONE: "serve_plus_one",
  RETURN_PLUS_ONE: "return_plus_one",
  ENDURANCE: "endurance",
  FULL_COURT_DEFENSE: "full_court_defense"
});
var ALL_KNOWN_DOMAIN_CODES = Object.freeze([
  ...Object.values(DOMAIN_CODES),
  ...Object.values(SINGLES_DOMAIN_CODES)
]);
var DOMAIN_CODE_ALIASES = Object.freeze({
  thirdShot: DOMAIN_CODES.THIRD_SHOT,
  "third-shot": DOMAIN_CODES.THIRD_SHOT,
  dinkSoftGame: DOMAIN_CODES.DINK_SOFT_GAME,
  blockReset: DOMAIN_CODES.BLOCK_RESET,
  doublesPositioning: DOMAIN_CODES.DOUBLES_POSITIONING,
  tacticalDecision: DOMAIN_CODES.TACTICAL_DECISION,
  pressureExecution: DOMAIN_CODES.PRESSURE_EXECUTION,
  rallyConsistency: DOMAIN_CODES.RALLY_CONSISTENCY,
  errorControl: DOMAIN_CODES.ERROR_CONTROL,
  courtCoverage: SINGLES_DOMAIN_CODES.COURT_COVERAGE
});
var LEGACY_SKILL_SUBCODE_ALIASES = Object.freeze({
  third_shot_drop: {
    glossary_code: "third_shot_drop",
    related_domain: DOMAIN_CODES.THIRD_SHOT,
    legacy_compatibility_only: true,
    semantic_normalization_required: true
  },
  third_shot_drive: {
    glossary_code: "third_shot_drive",
    related_domain: DOMAIN_CODES.THIRD_SHOT,
    legacy_compatibility_only: true,
    semantic_normalization_required: true
  }
});
function normalizeDomainCode(code) {
  const raw = String(code ?? "").trim();
  if (!raw) return null;
  if (ALL_KNOWN_DOMAIN_CODES.includes(raw)) return raw;
  return DOMAIN_CODE_ALIASES[raw] ?? null;
}

// src/features/pick-vn-rating-v5/constants/terminology.js
function formatRatingTerm(code, { style = "default", strict = false } = {}) {
  const raw = String(code ?? "").trim().toLowerCase();
  let entry = getGlossaryEntry(raw);
  if (!entry) {
    const normalized = normalizeDomainCode(code);
    if (normalized) entry = getGlossaryEntry(normalized);
  }
  if (!entry) {
    if (strict) {
      throw new Error(`Missing glossary entry for code: ${raw}`);
    }
    return raw;
  }
  if (style === "vi_only") {
    return entry.term_vi;
  }
  if (style === "en_only") {
    return entry.term_en;
  }
  return `${entry.term_en} (${entry.term_vi})`;
}
function formatDomainList(codes, separator = ", ") {
  if (!Array.isArray(codes) || !codes.length) return "\u2014";
  return codes.map((code) => formatRatingTerm(code)).join(separator);
}

// src/features/pick-vn-rating-v5/assessment/coreQuestions.js
var BEHAVIORAL_ANCHOR_LEVELS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]);
function anchors(l0, l1, l2, l3, l4, l5, l6, l7) {
  return Object.freeze([l0, l1, l2, l3, l4, l5, l6, l7]);
}
var CORE_QUESTIONS = Object.freeze([
  {
    id: "core_exp_01",
    domain: DOMAIN_CODES.CONSISTENCY,
    secondaryDomains: [],
    prompt: "B\u1EA1n \u0111\xE3 ch\u01A1i pickleball \u0111\u01B0\u1EE3c bao l\xE2u v\xE0 v\u1EDBi t\u1EA7n su\u1EA5t n\xE0o?",
    anchors: anchors(
      "Ch\u01B0a t\u1EEBng ch\u01A1i ho\u1EB7c m\u1EDBi bi\u1EBFt \u0111\u1EBFn m\xF4n",
      "Bi\u1EBFt lu\u1EADt c\u01A1 b\u1EA3n nh\u01B0ng ch\u01B0a ra s\xE2n th\u01B0\u1EDDng xuy\xEAn",
      "Ch\u01A1i th\u1EED v\xE0i bu\u1ED5i, ch\u01B0a quen nh\u1ECBp {{rally}}",
      "Ch\u01A1i 1\u20132 l\u1EA7n/th\xE1ng, c\xF2n thi\u1EBFu \u1ED5n \u0111\u1ECBnh",
      "Ch\u01A1i 1 l\u1EA7n/tu\u1EA7n, quen c\xE1c t\xECnh hu\u1ED1ng c\u01A1 b\u1EA3n",
      "Ch\u01A1i 2\u20133 l\u1EA7n/tu\u1EA7n, duy tr\xEC \u0111\u01B0\u1EE3c nh\u1ECBp \u0111\u1EA5u",
      "Ch\u01A1i g\u1EA7n nh\u01B0 h\u1EB1ng tu\u1EA7n c\xF3 l\u1ECBch c\u1ED1 \u0111\u1ECBnh",
      "Ch\u01A1i th\u01B0\u1EDDng xuy\xEAn nhi\u1EC1u n\u0103m, coi \u0111\xE2y l\xE0 m\xF4n ch\xEDnh"
    ),
    isCore: true,
    order: 1
  },
  {
    id: "core_exp_02",
    domain: DOMAIN_CODES.PRESSURE_EXECUTION,
    secondaryDomains: [DOMAIN_CODES.CONSISTENCY],
    prompt: "Trong bu\u1ED5i ch\u01A1i th\xF4ng th\u01B0\u1EDDng, b\u1EA1n duy tr\xEC {{rally}} \u0111\u01B0\u1EE3c bao l\xE2u tr\u01B0\u1EDBc khi m\u1EAFc {{unforced_error}}?",
    anchors: anchors(
      "G\u1EA7n nh\u01B0 kh\xF4ng {{rally}} \u0111\u01B0\u1EE3c",
      "{{rally}} 1\u20132 qu\u1EA3 r\u1ED3i l\u1ED7i",
      "{{rally}} 3\u20134 qu\u1EA3 trong t\u1EADp nh\u1EB9",
      "{{rally}} 5\u20136 qu\u1EA3 khi t\u1ED1c \u0111\u1ED9 ch\u1EADm",
      "{{rally}} 8\u201310 qu\u1EA3 trong \u0111\u1EA5u giao l\u01B0u",
      "{{rally}} 10\u201315 qu\u1EA3 \u1EDF nh\u1ECBp trung b\xECnh",
      "{{rally}} d\xE0i ngay c\u1EA3 khi \u0111\u1ED1i th\u1EE7 t\u0103ng \xE1p l\u1EF1c",
      "Gi\u1EEF {{rally}} \u1ED5n \u0111\u1ECBnh v\xE0 ch\u1EE7 \u0111\u1ED9ng thay \u0111\u1ED5i nh\u1ECBp"
    ),
    isCore: true,
    order: 2
  },
  {
    id: "core_srv_01",
    domain: DOMAIN_CODES.SERVE,
    prompt: "Giao b\xF3ng v\xE0o v\xF9ng h\u1EE3p l\u1EC7 (bao g\u1ED3m depth v\xE0 h\u01B0\u1EDBng c\u01A1 b\u1EA3n)?",
    anchors: anchors(
      "Ch\u01B0a giao \u0111\u01B0\u1EE3c v\xE0o s\xE2n",
      "Bi\u1EBFt lu\u1EADt giao nh\u01B0ng th\u01B0\u1EDDng l\u1ED7i {{foot_fault}}/l\u01B0\u1EDBi",
      "Giao v\xE0o s\xE2n khi kh\xF4ng \xE1p l\u1EF1c",
      "Giao v\xE0o s\xE2n \u1ED5n \u0111\u1ECBnh \u1EDF t\u1ED1c \u0111\u1ED9 ch\u1EADm",
      "Giao s\xE2u ho\u1EB7c r\u1ED9ng \u0111\u01B0\u1EE3c m\u1ED9t ph\u1EA7n",
      "Giao \u0111a d\u1EA1ng (s\xE2u, ng\u1EAFn, g\xF3c) trong \u0111\u1EA5u th\u01B0\u1EDDng",
      "Giao c\xF3 ch\u1EE7 \u0111\xEDch theo \u0111\u1ED1i th\u1EE7",
      "Giao \u1ED5n \u0111\u1ECBnh d\u01B0\u1EDBi \xE1p l\u1EF1c, \xEDt b\u1ECB attack ngay"
    ),
    isCore: true,
    order: 3
  },
  {
    id: "core_srv_02",
    domain: DOMAIN_CODES.SERVE,
    prompt: "Giao b\xF3ng th\u1EE9 3 ({{third_shot}}) \u2014 b\u1EA1n ch\u1EE7 \u0111\u1ED9ng giao \u0111\u1EC3 m\u1EDF \u0111i\u1EC3m?",
    anchors: anchors(
      "Ch\u01B0a hi\u1EC3u m\u1EE5c ti\xEAu sau giao",
      "Giao xong kh\xF4ng bi\u1EBFt b\u01B0\u1EDBc ti\u1EBFp theo",
      "Giao xong ch\u1EC9 ph\xF2ng th\u1EE7 th\u1EE5 \u0111\u1ED9ng",
      "Th\u1EC9nh tho\u1EA3ng giao s\xE2u \u0111\u1EC3 l\xF9i \u0111\u1ED1i th\u1EE7",
      "Giao c\xF3 k\u1EBF ho\u1EA1ch {{third_shot_drop}}/{{third_shot_drive}} sau giao",
      "Giao k\u1EBFt h\u1EE3p v\u1ECB tr\xED \u0111\u1ED3ng \u0111\u1ED9i",
      "Giao t\u1EA1o l\u1EE3i th\u1EBF ngay t\u1EEB \u0111\u1EA7u \u0111i\u1EC3m",
      "Giao \u0111a d\u1EA1ng v\xE0 \u0111\u1ECDc \u0111\u01B0\u1EE3c return c\u1EE7a \u0111\u1ED1i th\u1EE7"
    ),
    isCore: true,
    order: 4
  },
  {
    id: "core_ret_01",
    domain: DOMAIN_CODES.RETURN,
    prompt: "Tr\u1EA3 giao b\xF3ng an to\xE0n v\xE0o s\xE2n (kh\xF4ng b\u1ECB attack ngay)?",
    anchors: anchors(
      "Th\u01B0\u1EDDng l\u1ED7i return ho\u1EB7c {{pop_up}}",
      "Return v\xE0o s\xE2n nh\u01B0ng qu\xE1 cao/ng\u1EAFn",
      "Return s\xE2u khi giao ch\u1EADm",
      "Return s\xE2u \u1EDF nh\u1ECBp giao l\u01B0u ch\u1EADm",
      "Return s\xE2u v\xE0 th\u1EA5p ph\u1EA7n l\u1EDBn t\xECnh hu\u1ED1ng",
      "Return ch\u1ECDn g\xF3c ho\u1EB7c t\u1ED1c \u0111\u1ED9 theo server",
      "Return \u1ED5n \u0111\u1ECBnh d\u01B0\u1EDBi giao m\u1EA1nh",
      "Return ch\u1EE7 \u0111\u1ED9ng t\u1EA1o l\u1EE3i th\u1EBF (depth + placement)"
    ),
    isCore: true,
    order: 5
  },
  {
    id: "core_gs_01",
    domain: DOMAIN_CODES.GROUNDSTROKE,
    prompt: "{{forehand}} {{drive}} t\u1EEB {{baseline}} \u2014 ki\u1EC3m so\xE1t h\u01B0\u1EDBng v\xE0 \u0111\u1ED9 s\xE2u?",
    anchors: anchors(
      "Ch\u01B0a \u0111\xE1nh {{forehand}} \u1ED5n \u0111\u1ECBnh",
      "\u0110\xE1nh \u0111\u01B0\u1EE3c nh\u01B0ng th\u01B0\u1EDDng ra ngo\xE0i/l\u01B0\u1EDBi",
      "{{drive}} v\xE0o s\xE2n khi b\xF3ng cao/ch\u1EADm",
      "{{drive}} \u1ED5n \u0111\u1ECBnh \u1EDF t\u1ED1c \u0111\u1ED9 trung b\xECnh",
      "{{drive}} s\xE2u v\xE0 ngang ph\u1EA7n l\u1EDBn t\xECnh hu\u1ED1ng",
      "{{drive}} thay \u0111\u1ED5i g\xF3c c\xF3 ch\u1EE7 \u0111\xEDch",
      "{{drive}} d\u01B0\u1EDBi \xE1p l\u1EF1c {{rally}} nhanh",
      "{{drive}} \u0111a d\u1EA1ng (pace, angle) theo \u0111\u1ED1i th\u1EE7"
    ),
    isCore: true,
    order: 6
  },
  {
    id: "core_gs_02",
    domain: DOMAIN_CODES.GROUNDSTROKE,
    prompt: "{{backhand}} {{drive}} ho\u1EB7c {{backhand}} {{groundstroke}} \u2014 \u0111\u1ED9 \u1ED5n \u0111\u1ECBnh?",
    anchors: anchors(
      "Tr\xE1nh d\xF9ng {{backhand}}",
      "{{backhand}} th\u01B0\u1EDDng l\u1ED7i",
      "{{backhand}} v\xE0o s\xE2n khi b\xF3ng ch\u1EADm",
      "{{backhand}} \u1ED5n \u0111\u1ECBnh \u1EDF t\u1ED1c \u0111\u1ED9 ch\u1EADm",
      "{{backhand}} s\xE2u trong {{rally}} trung b\xECnh",
      "{{backhand}} \u0111\u1ED5i h\u01B0\u1EDBng \u0111\u01B0\u1EE3c",
      "{{backhand}} gi\u1EEF nh\u1ECBp khi b\u1ECB \xE9p",
      "{{backhand}} ch\u1EE7 \u0111\u1ED9ng t\u1EA5n c\xF4ng ho\u1EB7c {{reset}}"
    ),
    isCore: true,
    order: 7
  },
  {
    id: "core_gs_03",
    domain: DOMAIN_CODES.RALLY_CONSISTENCY,
    secondaryDomains: [DOMAIN_CODES.GROUNDSTROKE],
    prompt: "{{rally}} {{groundstroke}} hai b\xEAn {{baseline}} \u2014 gi\u1EEF b\xF3ng trong s\xE2n?",
    anchors: anchors(
      "Kh\xF4ng {{rally}} {{baseline}} \u0111\u01B0\u1EE3c",
      "1\u20132 qu\u1EA3 r\u1ED3i l\u1ED7i",
      "{{rally}} ch\u1EADm \u0111\u01B0\u1EE3c v\xE0i qu\u1EA3",
      "{{rally}} trung b\xECnh nh\u01B0ng hay l\u1ED7i bi\xEAn",
      "{{rally}} \u1ED5n \u0111\u1ECBnh \u1EDF pace trung b\xECnh",
      "{{rally}} v\xE0 chuy\u1EC3n sang t\u1EA5n c\xF4ng",
      "{{rally}} ki\u1EC3m so\xE1t nh\u1ECBp \u0111\u1ED1i th\u1EE7",
      "{{rally}} d\xE0i v\u1EDBi \xEDt {{unforced_error}}"
    ),
    isCore: true,
    order: 8
  },
  {
    id: "core_dink_01",
    domain: DOMAIN_CODES.DINK_SOFT_GAME,
    prompt: "{{dink_soft_game}} v\xE0o {{kitchen}} \u2014 b\xF3ng qua l\u01B0\u1EDBi th\u1EA5p v\xE0 trong s\xE2n?",
    anchors: anchors(
      "Ch\u01B0a bi\u1EBFt dink ho\u1EB7c to\xE0n l\u1ED7i l\u01B0\u1EDBi",
      "Dink th\u1EED nh\u01B0ng {{pop_up}} nhi\u1EC1u",
      "Dink v\xE0o {{kitchen}} khi kh\xF4ng b\u1ECB \xE9p",
      "Dink \u1ED5n \u0111\u1ECBnh v\xE0i pha",
      "Dink {{crosscourt}} ho\u1EB7c straight c\u01A1 b\u1EA3n",
      "Dink gi\u1EEF {{rally}} {{kitchen}} trung b\xECnh",
      "Dink thay \u0111\u1ED5i g\xF3c/pace c\xF3 ch\u1EE7 \u0111\xEDch",
      "Dink \u1ED5n \u0111\u1ECBnh d\u01B0\u1EDBi \xE1p l\u1EF1c {{speed_up}}"
    ),
    isCore: true,
    order: 9
  },
  {
    id: "core_dink_02",
    domain: DOMAIN_CODES.DINK_SOFT_GAME,
    prompt: "{{dink_soft_game}} \u2014 b\u1EA1n ki\u1EC3m so\xE1t \u0111\u01B0\u1EE3c t\u1ED1c \u0111\u1ED9 b\xF3ng \u1EDF {{kitchen}}?",
    anchors: anchors(
      "Kh\xF4ng ch\u01A1i soft game",
      "Ch\u1EC9 \u0111\xE1nh c\u1EE9ng, kh\xF4ng dink",
      "Dink nh\u01B0ng hay b\u1ECB attack",
      "Gi\u1EEF \u0111\u01B0\u1EE3c v\xE0i pha soft khi \u0111\u1ED1i th\u1EE7 ch\u1EADm",
      "Soft game c\xE2n b\u1EB1ng v\u1EDBi {{drive}}",
      "Ch\u1EE7 \u0111\u1ED9ng dink \u0111\u1EC3 m\u1EDF \u0111i\u1EC3m",
      "Soft game khi b\u1ECB \xE9p \u1EDF {{kitchen}}",
      "\u0110i\u1EC1u ch\u1EC9nh soft theo \u0111\u1ED1i th\u1EE7 v\xE0 \u0111\u1ED3ng \u0111\u1ED9i"
    ),
    isCore: true,
    order: 10
  },
  {
    id: "core_dink_03",
    domain: DOMAIN_CODES.ERROR_CONTROL,
    secondaryDomains: [DOMAIN_CODES.DINK_SOFT_GAME],
    prompt: "Khi ch\u01A1i t\u1EA1i {{kitchen}}, b\u1EA1n tr\xE1nh l\u1ED7i {{pop_up}} ho\u1EB7c v\xE0o v\xF4i?",
    anchors: anchors(
      "Th\u01B0\u1EDDng xuy\xEAn {{pop_up}} ho\u1EB7c v\xF4i",
      "L\u1ED7i {{kitchen}} nhi\u1EC1u h\u01A1n gi\u1EEF \u0111\u01B0\u1EE3c",
      "Gi\u1EEF \u0111\u01B0\u1EE3c khi kh\xF4ng b\u1ECB {{speed_up}}",
      "{{pop_up}} th\u1EC9nh tho\u1EA3ng khi b\u1ECB \xE9p",
      "Ki\u1EC3m so\xE1t l\u1ED7i \u1EDF nh\u1ECBp trung b\xECnh",
      "\xCDt {{unforced_error}} \u1EDF {{kitchen}}",
      "{{reset}} \u0111\u01B0\u1EE3c sau khi b\u1ECB attack",
      "Gi\u1EEF b\xF3ng th\u1EA5p ngay c\u1EA3 khi \u0111\u1ED1i th\u1EE7 {{poach}}"
    ),
    isCore: true,
    order: 11
  },
  {
    id: "core_ts_01",
    domain: DOMAIN_CODES.THIRD_SHOT,
    prompt: "{{third_shot}} \u2014 \u0111\u01B0a b\xF3ng v\xE0o {{kitchen}} \u0111\u1ED1i ph\u01B0\u01A1ng?",
    anchors: anchors(
      "Ch\u01B0a bi\u1EBFt {{third_shot_drop}}",
      "Th\u1EED drop nh\u01B0ng th\u01B0\u1EDDng l\u1ED7i l\u01B0\u1EDBi/cao",
      "Drop v\xE0o {{kitchen}} khi kh\xF4ng b\u1ECB \xE9p",
      "Drop \u1ED5n \u0111\u1ECBnh \u1EDF pace ch\u1EADm",
      "Drop s\xE2u {{kitchen}} ph\u1EA7n l\u1EDBn t\xECnh hu\u1ED1ng",
      "Ch\u1ECDn {{third_shot_drop}} ho\u1EB7c {{third_shot_drive}} theo return",
      "Drop d\u01B0\u1EDBi \xE1p l\u1EF1c sau return s\xE2u",
      "Drop \u0111a d\u1EA1ng (height, depth, angle)"
    ),
    isCore: true,
    order: 12
  },
  {
    id: "core_tr_01",
    domain: DOMAIN_CODES.TRANSITION,
    prompt: "{{transition}} t\u1EEB {{baseline}} l\xEAn {{kitchen}} (kh\xF4ng b\u1ECB attack d\u1EC5 d\xE0ng)?",
    anchors: anchors(
      "Kh\xF4ng bi\u1EBFt khi n\xE0o l\xEAn",
      "L\xEAn s\u1EDBm v\xE0 b\u1ECB punish nhi\u1EC1u",
      "L\xEAn \u0111\u01B0\u1EE3c khi \u0111\u1ED1i th\u1EE7 ch\u1EADm",
      "L\xEAn sau {{third_shot}} \u1ED5n \u0111\u1ECBnh",
      "L\xEAn c\xF3 split-step v\xE0 ready",
      "L\xEAn \u0111\xFAng th\u1EDDi \u0111i\u1EC3m ph\u1EA7n l\u1EDBn \u0111i\u1EC3m",
      "L\xEAn d\u01B0\u1EDBi \xE1p l\u1EF1c {{drive}}",
      "L\xEAn linh ho\u1EA1t theo \u0111\u1ED3ng \u0111\u1ED9i v\xE0 {{match_up}}"
    ),
    isCore: true,
    order: 13
  },
  {
    id: "core_tr_02",
    domain: DOMAIN_CODES.TRANSITION,
    prompt: "Khi b\u1ECB \xE9p gi\u1EEFa s\xE2n ({{transition_zone}}), b\u1EA1n x\u1EED l\xFD th\u1EBF n\xE0o?",
    anchors: anchors(
      "\u0110\u1EE9ng gi\u1EEFa s\xE2n v\xE0 th\u01B0\u1EDDng l\u1ED7i",
      "Bi\u1EBFt n\xEAn l\xF9i/ti\u1EBFn nh\u01B0ng hay ch\u1EADm",
      "{{reset}} \u0111\u01B0\u1EE3c khi b\xF3ng ch\u1EADm",
      "Ch\u1ECDn l\xF9i ho\u1EB7c l\xEAn c\u01A1 b\u1EA3n",
      "{{block_reset}} r\u1ED3i v\u1EC1 v\u1ECB tr\xED",
      "\xCDt m\u1EAFc k\u1EB9t \u1EDF {{transition_zone}}",
      "X\u1EED l\xFD nhanh d\u01B0\u1EDBi pace cao",
      "Ch\u1EE7 \u0111\u1ED9ng \u0111i\u1EC1u ch\u1EC9nh theo \u0111\u1ED1i th\u1EE7"
    ),
    isCore: true,
    order: 14
  },
  {
    id: "core_vol_01",
    domain: DOMAIN_CODES.VOLLEY,
    prompt: "{{volley}} punch ho\u1EB7c {{volley}} t\u1EA5n c\xF4ng t\u1EEB {{kitchen}} line?",
    anchors: anchors(
      "Kh\xF4ng {{volley}} \u0111\u01B0\u1EE3c",
      "{{volley}} th\u01B0\u1EDDng ra ngo\xE0i ho\u1EB7c {{pop_up}}",
      "{{volley}} v\xE0o s\xE2n khi b\xF3ng cao",
      "{{volley}} c\u01A1 b\u1EA3n \u1EDF pace ch\u1EADm",
      "{{volley}} {{put_away}} khi b\xF3ng cao",
      "{{volley}} ch\u1ECDn g\xF3c ch\xE2n \u0111\u1ED1i th\u1EE7",
      "{{volley}} d\u01B0\u1EDBi \xE1p l\u1EF1c {{speed_up}}",
      "{{volley}} \u0111a d\u1EA1ng (angle, pace, fake)"
    ),
    isCore: true,
    order: 15
  },
  {
    id: "core_blk_01",
    domain: DOMAIN_CODES.BLOCK_RESET,
    prompt: "Block {{drive}} \u0111\u1ED1i ph\u01B0\u01A1ng \u2014 gi\u1EEF b\xF3ng th\u1EA5p v\xE0 trong s\xE2n?",
    anchors: anchors(
      "Kh\xF4ng block \u0111\u01B0\u1EE3c",
      "Block nh\u01B0ng {{pop_up}} nhi\u1EC1u",
      "Block khi {{drive}} ch\u1EADm",
      "Block \u1ED5n \u0111\u1ECBnh v\xE0i pha",
      "Block r\u1ED3i {{reset}} v\xE0o {{kitchen}}",
      "Block ch\u1EE7 \u0111\u1ED9ng theo h\u01B0\u1EDBng {{drive}}",
      "Block d\u01B0\u1EDBi pace cao",
      "Block + {{reset}} t\u1EA1o l\u1EA1i neutral"
    ),
    isCore: true,
    order: 16
  },
  {
    id: "core_blk_02",
    domain: DOMAIN_CODES.BLOCK_RESET,
    prompt: "{{reset}} b\xF3ng khi b\u1ECB attack \u2014 \u0111\u01B0a {{rally}} v\u1EC1 tr\u1EA1ng th\xE1i trung t\xEDnh?",
    anchors: anchors(
      "Kh\xF4ng {{reset}} \u0111\u01B0\u1EE3c, th\u01B0\u1EDDng l\u1ED7i",
      "{{reset}} th\u1EED nh\u01B0ng hay out",
      "{{reset}} khi attack ch\u1EADm",
      "{{reset}} v\xE0o {{kitchen}} c\u01A1 b\u1EA3n",
      "{{reset}} \u1ED5n \u0111\u1ECBnh sau block",
      "{{reset}} ch\u1ECDn g\xF3c xa \u0111\u1ED1i th\u1EE7",
      "{{reset}} d\u01B0\u1EDBi \xE1p l\u1EF1c {{poach}}",
      "{{reset}} ch\u1EE7 \u0111\u1ED9ng thay \u0111\u1ED5i nh\u1ECBp {{rally}}"
    ),
    isCore: true,
    order: 17
  },
  {
    id: "core_pos_01",
    domain: DOMAIN_CODES.DOUBLES_POSITIONING,
    prompt: "V\u1ECB tr\xED \u0111\u1EE9ng khi \u0111\u1ED3ng \u0111\u1ED9i \u0111ang dink \u2014 b\u1EA1n gi\u1EEF kho\u1EA3ng c\xE1ch v\xE0 che s\xE2n?",
    anchors: anchors(
      "Kh\xF4ng bi\u1EBFt \u0111\u1EE9ng \u0111\xE2u khi \u0111\u1ED3ng \u0111\u1ED9i dink",
      "Hay \u0111\u1EE9ng qu\xE1 g\u1EA7n ho\u1EB7c che khu\u1EA5t",
      "Gi\u1EEF v\u1ECB tr\xED khi kh\xF4ng b\u1ECB {{poach}}",
      "Bi\u1EBFt stagger c\u01A1 b\u1EA3n",
      "Che middle v\xE0 line c\u01A1 b\u1EA3n",
      "\u0110i\u1EC1u ch\u1EC9nh theo tay thu\u1EADn \u0111\u1ED1i th\u1EE7",
      "{{poach}} ho\u1EB7c gi\u1EEF line c\xF3 ch\u1EE7 \u0111\xEDch",
      "Ph\u1ED1i h\u1EE3p di chuy\u1EC3n m\u01B0\u1EE3t v\u1EDBi \u0111\u1ED3ng \u0111\u1ED9i"
    ),
    isCore: true,
    order: 18
  },
  {
    id: "core_pos_02",
    domain: DOMAIN_CODES.COMMUNICATION,
    secondaryDomains: [DOMAIN_CODES.DOUBLES_POSITIONING],
    prompt: "Giao ti\u1EBFp v\u1EDBi \u0111\u1ED3ng \u0111\u1ED9i (mine/yours, switch, {{stack}})?",
    anchors: anchors(
      "Kh\xF4ng giao ti\u1EBFp tr\xEAn s\xE2n",
      "Th\u1EC9nh tho\u1EA3ng g\u1ECDi mine/yours",
      "G\u1ECDi b\xF3ng trong t\xECnh hu\u1ED1ng d\u1EC5",
      "Switch c\u01A1 b\u1EA3n khi c\u1EA7n",
      "{{stack}} ho\u1EB7c formation \u0111\u01A1n gi\u1EA3n",
      "Giao ti\u1EBFp khi b\u1ECB attack",
      "\u0110i\u1EC1u ph\u1ED1i {{poach}} v\xE0 coverage",
      "Giao ti\u1EBFp linh ho\u1EA1t theo {{match_up}}"
    ),
    isCore: true,
    order: 19
  },
  {
    id: "core_tac_01",
    domain: DOMAIN_CODES.TACTICAL_DECISION,
    prompt: "{{shot_selection}} ({{drive}}/{{dink_soft_game}}/{{lob}}/{{ernie}}) theo t\xECnh hu\u1ED1ng?",
    anchors: anchors(
      "\u0110\xE1nh theo th\xF3i quen, kh\xF4ng ch\u1ECDn l\u1ECDc",
      "Bi\u1EBFt c\xE1c l\u1EF1a ch\u1ECDn nh\u01B0ng hay sai",
      "Ch\u1ECDn \u0111\xFAng khi b\xF3ng r\u1EA5t d\u1EC5",
      "Ch\u1ECDn \u1ED5n \u1EDF pace ch\u1EADm",
      "Ch\u1ECDn theo v\u1ECB tr\xED \u0111\u1ED1i th\u1EE7 c\u01A1 b\u1EA3n",
      "K\u1EBFt h\u1EE3p chi\u1EBFn thu\u1EADt theo \u0111i\u1EC3m",
      "\u0110i\u1EC1u ch\u1EC9nh theo \u0111i\u1EC3m s\u1ED1/\xE1p l\u1EF1c",
      "\u0110\u1ECDc {{match_up}} v\xE0 exploit weakness"
    ),
    isCore: true,
    order: 20
  },
  {
    id: "core_tac_02",
    domain: DOMAIN_CODES.TACTICAL_DECISION,
    prompt: "Nh\u1EADn di\u1EC7n th\u1EDDi \u0111i\u1EC3m t\u1EA5n c\xF4ng vs gi\u1EEF {{rally}}?",
    anchors: anchors(
      "Lu\xF4n \u0111\xE1nh c\u1EE9ng ho\u1EB7c lu\xF4n ch\u1EC9 dink",
      "Kh\xF3 nh\u1EADn ra ball t\u1EA5n c\xF4ng",
      "T\u1EA5n c\xF4ng khi b\xF3ng r\u1EA5t cao",
      "Gi\u1EEF {{rally}} khi kh\xF4ng ch\u1EAFc",
      "C\xE2n b\u1EB1ng t\u1EA5n c\xF4ng/ph\xF2ng th\u1EE7",
      "Ch\u1EE7 \u0111\u1ED9ng t\u1EA1o ball t\u1EA5n c\xF4ng",
      "Quy\u1EBFt \u0111\u1ECBnh nhanh d\u01B0\u1EDBi \xE1p l\u1EF1c",
      "\u0110i\u1EC1u ch\u1EC9nh chi\u1EBFn thu\u1EADt theo set"
    ),
    isCore: true,
    order: 21
  },
  {
    id: "core_rules_01",
    domain: DOMAIN_CODES.RULES,
    prompt: "Lu\u1EADt {{kitchen}}/v\xF4i, double bounce, v\xE0 {{serve}} \u2014 b\u1EA1n n\u1EAFm v\xE0 \xE1p d\u1EE5ng?",
    anchors: anchors(
      "Ch\u01B0a n\u1EAFm lu\u1EADt c\u01A1 b\u1EA3n",
      "Bi\u1EBFt lu\u1EADt nh\u01B0ng hay m\u1EAFc l\u1ED7i v\xF4i",
      "\xC1p d\u1EE5ng \u0111\u01B0\u1EE3c khi nh\u1EAFc nh\u1EDF",
      "\xCDt l\u1ED7i {{kitchen}} trong ch\u01A1i ch\u1EADm",
      "N\u1EAFm lu\u1EADt trong \u0111\u1EA5u giao l\u01B0u",
      "\xC1p d\u1EE5ng \u0111\xFAng khi tranh ch\u1EA5p",
      "Gi\u1EA3i th\xEDch lu\u1EADt cho ng\u01B0\u1EDDi m\u1EDBi",
      "N\u1EAFm lu\u1EADt t\xECnh hu\u1ED1ng (let, replay, fault)"
    ),
    isCore: true,
    order: 22
  }
]);
function getCoreQuestionById(id) {
  return CORE_QUESTIONS.find((q2) => q2.id === id) ?? null;
}
function getCoreQuestionIds() {
  return CORE_QUESTIONS.map((q2) => q2.id);
}

// src/features/pick-vn-rating-v5/assessment/adaptiveQuestionBank.js
var ADAPTIVE_ROUTE = Object.freeze({
  FOUNDATION: "foundation",
  MEDIUM: "medium",
  ADVANCED: "advanced",
  CONSISTENCY_CHECK: "consistency_check"
});
function q(id, domain, route, prompt, anchors2, meta = {}) {
  return Object.freeze({
    id,
    domain,
    route,
    prompt,
    anchors: Object.freeze(anchors2),
    isCore: false,
    ...meta
  });
}
var ADAPTIVE_QUESTIONS = Object.freeze([
  q(
    "adp_found_srv_01",
    DOMAIN_CODES.SERVE,
    ADAPTIVE_ROUTE.FOUNDATION,
    "B\u1EA1n c\xF3 giao \u0111\u01B0\u1EE3c b\xF3ng v\xE0o \xF4 giao b\xF3ng \u0111\u1ED1i di\u1EC7n kh\xF4ng?",
    ["Kh\xF4ng", "Th\u1EED nh\u01B0ng l\u1ED7i", "\u0110\u01B0\u1EE3c khi ch\u1EADm", "\u1ED4n \u0111\u1ECBnh ch\u1EADm", "\u1ED4n \u0111\u1ECBnh TB", "S\xE2u/r\u1ED9ng", "C\xF3 k\u1EBF ho\u1EA1ch", "\u0110a d\u1EA1ng"]
  ),
  q(
    "adp_found_ret_01",
    DOMAIN_CODES.RETURN,
    ADAPTIVE_ROUTE.FOUNDATION,
    "Return c\xF3 v\xE0o s\xE2n kh\xF4ng?",
    ["Kh\xF4ng", "Hi\u1EBFm khi", "Khi giao ch\u1EADm", "TB ch\u1EADm", "TB", "S\xE2u", "S\xE2u+th\u1EA5p", "Ch\u1EE7 \u0111\u1ED9ng"]
  ),
  q(
    "adp_found_dink_01",
    DOMAIN_CODES.DINK_SOFT_GAME,
    ADAPTIVE_ROUTE.FOUNDATION,
    "B\u1EA1n c\xF3 bi\u1EBFt {{dink_soft_game}} l\xE0 g\xEC v\xE0 th\u1EED \u0111\u01B0\u1EE3c kh\xF4ng?",
    ["Kh\xF4ng bi\u1EBFt", "Bi\u1EBFt, ch\u01B0a l\xE0m", "Th\u1EED l\u1ED7i nhi\u1EC1u", "V\xE0i qu\u1EA3 OK", "Gi\u1EEF v\xE0i pha", "Cross OK", "\u1ED4n TB", "\u1ED4n \xE1p l\u1EF1c"]
  ),
  q(
    "adp_found_pos_01",
    DOMAIN_CODES.DOUBLES_POSITIONING,
    ADAPTIVE_ROUTE.FOUNDATION,
    "Khi \u0111\xE1nh \u0111\xF4i, b\u1EA1n \u0111\u1EE9ng c\u1EA1nh \u0111\u1ED3ng \u0111\u1ED9i hay l\u1EC7ch stagger?",
    ["Kh\xF4ng bi\u1EBFt", "\u0110\u1EE9ng s\xE1t", "Th\u1EC9nh tho\u1EA3ng stagger", "Stagger c\u01A1 b\u1EA3n", "Che middle", "Theo {{poach}}", "{{stack}} \u0111\u01A1n gi\u1EA3n", "Linh ho\u1EA1t"]
  ),
  q(
    "adp_found_rules_01",
    DOMAIN_CODES.RULES,
    ADAPTIVE_ROUTE.FOUNDATION,
    "B\u1EA1n c\xF3 bi\u1EBFt v\xF9ng {{kitchen}} kh\xF4ng?",
    ["Kh\xF4ng", "Bi\u1EBFt nh\u01B0ng hay v\xE0o", "Nh\u1EAFc m\u1EDBi \u0111\xFAng", "\xCDt v\xF4i ch\u1EADm", "OK giao l\u01B0u", "OK \u0111\u1EA5u", "Gi\u1EA3i th\xEDch \u0111\u01B0\u1EE3c", "Lu\u1EADt t\xECnh hu\u1ED1ng"]
  ),
  q(
    "adp_med_gs_01",
    DOMAIN_CODES.GROUNDSTROKE,
    ADAPTIVE_ROUTE.MEDIUM,
    "{{forehand}} b\u1EA1n \u1ED5n \u0111\u1ECBnh h\u01A1n hay {{backhand}}?",
    ["C\u1EA3 hai y\u1EBFu", "{{forehand}} h\u01A1n", "{{backhand}} h\u01A1n", "T\u01B0\u01A1ng \u0111\u01B0\u01A1ng ch\u1EADm", "TB \u1ED5n", "\u0110\u1ED5i h\u01B0\u1EDBng", "D\u01B0\u1EDBi \xE1p l\u1EF1c", "Theo {{match_up}}"],
    { checksContradiction: ["core_gs_01", "core_gs_02"] }
  ),
  q(
    "adp_med_rally_01",
    DOMAIN_CODES.RALLY_CONSISTENCY,
    ADAPTIVE_ROUTE.MEDIUM,
    "{{rally}} 10 qu\u1EA3 \u2014 b\u1EA1n ho\xE0n th\xE0nh \u0111\u01B0\u1EE3c bao nhi\xEAu l\u1EA7n trong 5 \u0111i\u1EC3m?",
    ["0", "1", "2", "3", "4", "5", "H\u1EA7u h\u1EBFt", "Lu\xF4n"]
  ),
  q(
    "adp_med_err_01",
    DOMAIN_CODES.ERROR_CONTROL,
    ADAPTIVE_ROUTE.MEDIUM,
    "{{unforced_error}} chi\u1EBFm bao nhi\xEAu % \u0111i\u1EC3m thua?",
    [">80%", "60\u201380%", "40\u201360%", "30\u201340%", "20\u201330%", "10\u201320%", "5\u201310%", "<5%"]
  ),
  q(
    "adp_med_ts_01",
    DOMAIN_CODES.THIRD_SHOT,
    ADAPTIVE_ROUTE.MEDIUM,
    "Sau return s\xE2u, b\u1EA1n {{third_shot_drop}} hay {{third_shot_drive}} nhi\u1EC1u h\u01A1n?",
    ["Kh\xF4ng bi\u1EBFt", "To\xE0n l\u1ED7i", "Th\u1EED {{third_shot_drop}}", "Th\u1EED {{third_shot_drive}}", "Ch\u1ECDn l\u1ECDc", "C\xE2n b\u1EB1ng", "Theo \u0111\u1ED1i th\u1EE7", "Ch\u1EE7 \u0111\u1ED9ng"]
  ),
  q(
    "adp_med_tr_01",
    DOMAIN_CODES.TRANSITION,
    ADAPTIVE_ROUTE.MEDIUM,
    "Sau {{third_shot}} t\u1ED1t, b\u1EA1n l\xEAn {{kitchen}} trong bao nhi\xEAu % \u0111i\u1EC3m?",
    ["0%", "<25%", "25\u201340%", "40\u201355%", "55\u201370%", "70\u201385%", ">85%", "Lu\xF4n \u0111\xFAng l\xFAc"]
  ),
  q(
    "adp_adv_dink_01",
    DOMAIN_CODES.DINK_SOFT_GAME,
    ADAPTIVE_ROUTE.ADVANCED,
    "B\u1EA1n dink {{crosscourt}} \u0111\u1EC3 k\xE9o \u0111\u1ED1i th\u1EE7 r\u1EDDi middle?",
    ["Kh\xF4ng", "Th\u1EED l\u1ED7i", "Th\u1EC9nh tho\u1EA3ng", "TB", "Th\u01B0\u1EDDng xuy\xEAn", "Theo {{match_up}}", "D\u01B0\u1EDBi {{speed_up}}", "Ch\u1EE7 \u0111\u1ED9ng setup"]
  ),
  q(
    "adp_adv_reset_01",
    DOMAIN_CODES.BLOCK_RESET,
    ADAPTIVE_ROUTE.ADVANCED,
    "Sau b\u1ECB {{speed_up}}, {{reset}} v\xE0o {{kitchen}} th\xE0nh c\xF4ng?",
    ["Kh\xF4ng", "Hi\u1EBFm", "Ch\u1EADm OK", "TB", "Th\u01B0\u1EDDng", "Ch\u1ECDn g\xF3c", "D\u01B0\u1EDBi {{poach}}", "Ch\u1EE7 \u0111\u1ED9ng"]
  ),
  q(
    "adp_adv_vol_01",
    DOMAIN_CODES.VOLLEY,
    ADAPTIVE_ROUTE.ADVANCED,
    "{{put_away}} {{volley}} khi b\xF3ng cao \u2014 t\u1EF7 l\u1EC7 th\xE0nh c\xF4ng?",
    ["0%", "<25%", "25\u201340%", "40\u201355%", "55\u201370%", "70\u201385%", ">85%", "Ch\u1EE7 \u0111\u1ED9ng setup"]
  ),
  q(
    "adp_adv_tac_01",
    DOMAIN_CODES.TACTICAL_DECISION,
    ADAPTIVE_ROUTE.ADVANCED,
    "B\u1EA1n target y\u1EBFu \u0111i\u1EC3m \u0111\u1ED1i th\u1EE7 ({{backhand}}, middle, deep)?",
    ["Kh\xF4ng", "Ng\u1EABu nhi\xEAn", "Th\u1EC9nh tho\u1EA3ng", "TB", "Th\u01B0\u1EDDng", "Theo set", "D\u01B0\u1EDBi \xE1p l\u1EF1c", "\u0110\u1ECDc {{match_up}}"]
  ),
  q(
    "adp_adv_press_01",
    DOMAIN_CODES.PRESSURE_EXECUTION,
    ADAPTIVE_ROUTE.ADVANCED,
    "\u0110i\u1EC3m quy\u1EBFt \u0111\u1ECBnh (10\u201310+) \u2014 b\u1EA1n gi\u1EEF \u0111\u01B0\u1EE3c l\u1ED1i ch\u01A1i?",
    ["R\u1EA5t kh\xF3", "Th\u01B0\u1EDDng l\u1ED7i", "Ch\u1EADm OK", "TB", "\u1ED4n", "T\u0103ng t\u1EADp trung", "Ch\u1EE7 \u0111\u1ED9ng", "Th\xEDch \xE1p l\u1EF1c"]
  ),
  q(
    "adp_cc_srv_ret_01",
    DOMAIN_CODES.SERVE,
    ADAPTIVE_ROUTE.CONSISTENCY_CHECK,
    "B\u1EA1n v\u1EEBa ch\u1ECDn m\u1EE9c giao b\xF3ng cao \u2014 return c\u1EE7a b\u1EA1n so v\u1EDBi giao?",
    ["Return << giao", "Return < giao", "G\u1EA7n b\u1EB1ng", "Return > giao", "Kh\u1EDBp", "Kh\u1EDBp TB", "Kh\u1EDBp \xE1p l\u1EF1c", "Return m\u1EA1nh h\u01A1n"],
    { checksContradiction: ["core_srv_01", "core_ret_01"] }
  ),
  q(
    "adp_cc_dink_drive_01",
    DOMAIN_CODES.DINK_SOFT_GAME,
    ADAPTIVE_ROUTE.CONSISTENCY_CHECK,
    "B\u1EA1n \u0111\xE1nh {{drive}} m\u1EA1nh nh\u01B0ng dink \u2014 m\u1EE9c n\xE0o ph\u1EA3n \xE1nh \u0111\xFAng h\u01A1n?",
    ["Ch\u1EC9 {{drive}}", "{{drive}} >> dink", "{{drive}} > dink", "C\xE2n b\u1EB1ng", "Dink > {{drive}}", "Dink >> {{drive}}", "Soft game ch\xEDnh", "Ho\xE0n to\xE0n soft"],
    { checksContradiction: ["core_dink_01", "core_gs_01"] }
  ),
  q(
    "adp_cc_exp_rally_01",
    DOMAIN_CODES.CONSISTENCY,
    ADAPTIVE_ROUTE.CONSISTENCY_CHECK,
    "Kinh nghi\u1EC7m d\xE0i nh\u01B0ng {{rally}} ng\u1EAFn \u2014 \u0111i\u1EC1u n\xE0o \u0111\xFAng h\u01A1n?",
    ["Kinh nghi\u1EC7m quan tr\u1ECDng h\u01A1n", "H\u01A1i kinh nghi\u1EC7m", "C\xE2n b\u1EB1ng", "{{rally}} quan tr\u1ECDng h\u01A1n", "{{rally}} d\xE0i h\u01A1n", "{{rally}} >> exp", "Ch\u01B0a \u0111\u1EE7 data", "C\u1EA7n HLV xem"],
    { checksContradiction: ["core_exp_01", "core_exp_02"] }
  ),
  q(
    "adp_adv_foot_01",
    DOMAIN_CODES.FOOTWORK,
    ADAPTIVE_ROUTE.ADVANCED,
    "Split-step v\xE0 {{recovery_position}} sau m\u1ED7i c\xFA?",
    ["Kh\xF4ng", "Th\u1EC9nh tho\u1EA3ng", "Ch\u1EADm OK", "TB", "Th\u01B0\u1EDDng", "Theo {{poach}}", "D\u01B0\u1EDBi pace", "Ch\u1EE7 \u0111\u1ED9ng"]
  ),
  q(
    "adp_med_comm_01",
    DOMAIN_CODES.COMMUNICATION,
    ADAPTIVE_ROUTE.MEDIUM,
    "G\u1ECDi 'mine' khi b\xF3ng gi\u1EEFa hai ng\u01B0\u1EDDi?",
    ["Kh\xF4ng", "Hi\u1EBFm", "Ch\u1EADm", "TB", "Th\u01B0\u1EDDng", "S\u1EDBm", "D\u01B0\u1EDBi attack", "Ch\u1EE7 \u0111\u1ED9ng"]
  ),
  q(
    "adp_adv_stack_01",
    DOMAIN_CODES.DOUBLES_POSITIONING,
    ADAPTIVE_ROUTE.ADVANCED,
    "{{stack}} khi return \u2014 b\u1EA1n v\xE0 \u0111\u1ED3ng \u0111\u1ED9i?",
    ["Kh\xF4ng bi\u1EBFt", "Th\u1EED l\u1ED7i", "C\u01A1 b\u1EA3n", "TB", "Th\u01B0\u1EDDng", "Theo {{match_up}}", "Che middle", "{{poach}} setup"]
  ),
  q(
    "adp_med_vol_blk_01",
    DOMAIN_CODES.VOLLEY,
    ADAPTIVE_ROUTE.MEDIUM,
    "{{volley}} defensive vs punch \u2014 b\u1EA1n m\u1EA1nh h\u01A1n \u1EDF?",
    ["Kh\xF4ng {{volley}}", "Def y\u1EBFu", "Def TB", "C\xE2n b\u1EB1ng", "Punch TB", "Punch m\u1EA1nh", "Ch\u1ECDn l\u1ECDc", "Theo t\xECnh hu\u1ED1ng"]
  ),
  q(
    "adp_found_exp_01",
    DOMAIN_CODES.CONSISTENCY,
    ADAPTIVE_ROUTE.FOUNDATION,
    "Tr\u01B0\u1EDBc pickleball b\u1EA1n ch\u01A1i m\xF4n v\u1EE3t n\xE0o?",
    ["Kh\xF4ng", "Th\u1EC3 thao kh\xE1c", "B\xF3ng b\xE0n", "C\u1EA7u l\xF4ng", "Tennis", "Nhi\u1EC1u m\xF4n", "Chuy\xEAn v\u1EE3t", "Chuy\xEAn pickleball"]
  ),
  q(
    "adp_adv_lob_01",
    DOMAIN_CODES.TACTICAL_DECISION,
    ADAPTIVE_ROUTE.ADVANCED,
    "{{lob}} defensive khi b\u1ECB \xE9p t\u1EA1i {{kitchen}}?",
    ["Kh\xF4ng", "L\u1ED7i nhi\u1EC1u", "Th\u1EC9nh tho\u1EA3ng", "TB", "Th\u01B0\u1EDDng", "Ch\u1ECDn l\u1ECDc", "D\u01B0\u1EDBi {{poach}}", "Ch\u1EE7 \u0111\u1ED9ng"]
  ),
  q(
    "adp_med_serve_depth_01",
    DOMAIN_CODES.SERVE,
    ADAPTIVE_ROUTE.MEDIUM,
    "Giao s\xE2u (g\u1EA7n {{baseline}} \u0111\u1ED1i ph\u01B0\u01A1ng)?",
    ["Kh\xF4ng", "Hi\u1EBFm", "Ch\u1EADm", "TB", "Th\u01B0\u1EDDng", "Theo ng\u01B0\u1EDDi", "D\u01B0\u1EDBi \xE1p l\u1EF1c", "Setup third"]
  ),
  q(
    "adp_adv_ernie_01",
    DOMAIN_CODES.TACTICAL_DECISION,
    ADAPTIVE_ROUTE.ADVANCED,
    "{{ernie}} ho\u1EB7c {{counterattack}} t\u1EEB ngo\xE0i {{kitchen}}?",
    ["Kh\xF4ng bi\u1EBFt", "Th\u1EED l\u1ED7i", "Th\u1EC9nh tho\u1EA3ng", "TB", "Ch\u1ECDn l\u1ECDc", "Th\u01B0\u1EDDng", "D\u01B0\u1EDBi setup", "Ch\u1EE7 \u0111\u1ED9ng"]
  ),
  q(
    "adp_cc_pos_drive_01",
    DOMAIN_CODES.DOUBLES_POSITIONING,
    ADAPTIVE_ROUTE.CONSISTENCY_CHECK,
    "{{drive}} m\u1EA1nh nh\u01B0ng hay m\u1EA5t v\u1ECB tr\xED \u2014 \u0111i\u1EC1u n\xE0o \u0111\xFAng?",
    ["{{drive}} quan tr\u1ECDng h\u01A1n", "H\u01A1i {{drive}}", "C\xE2n b\u1EB1ng", "V\u1ECB tr\xED quan tr\u1ECDng h\u01A1n", "V\u1ECB tr\xED >> {{drive}}", "C\u1EA7n HLV", "Ch\u01B0a r\xF5", "M\xE2u thu\u1EABn"],
    { checksContradiction: ["core_pos_01", "core_gs_01"] }
  ),
  q(
    "adp_med_pressure_dink_01",
    DOMAIN_CODES.DINK_SOFT_GAME,
    ADAPTIVE_ROUTE.MEDIUM,
    "{{speed_up}} t\u1EEB {{kitchen}} \u2014 b\u1EA1n block hay counter?",
    ["Kh\xF4ng bi\u1EBFt", "Th\u01B0\u1EDDng l\u1ED7i", "Block th\u1EED", "TB block", "Counter th\u1EED", "Ch\u1ECDn l\u1ECDc", "D\u01B0\u1EDBi {{poach}}", "Ch\u1EE7 \u0111\u1ED9ng"]
  ),
  q(
    "adp_adv_return_depth_01",
    DOMAIN_CODES.RETURN,
    ADAPTIVE_ROUTE.ADVANCED,
    "Return deep gi\u1EEF \u0111\u1ED1i th\u1EE7 {{baseline}}?",
    ["Kh\xF4ng", "Hi\u1EBFm", "Ch\u1EADm", "TB", "Th\u01B0\u1EDDng", "Theo server", "D\u01B0\u1EDBi giao m\u1EA1nh", "Setup third"]
  ),
  q(
    "adp_med_rules_nvz_01",
    DOMAIN_CODES.RULES,
    ADAPTIVE_ROUTE.MEDIUM,
    "B\xF3ng tr\xEAn line {{kitchen}} \u2014 b\u1EA1n x\u1EED l\xFD \u0111\xFAng lu\u1EADt?",
    ["Kh\xF4ng ch\u1EAFc", "Hay sai", "Nh\u1EAFc m\u1EDBi \u0111\xFAng", "TB", "Th\u01B0\u1EDDng \u0111\xFAng", "Tranh ch\u1EA5p OK", "Gi\u1EA3i th\xEDch", "Tr\u1ECDng t\xE0i level"]
  )
]);
var MAX_ADAPTIVE_QUESTIONS = 8;

// src/features/pick-vn-rating-v5/assessment/criticalGates.js
var CRITICAL_DOMAINS_DOUBLES = Object.freeze([
  DOMAIN_CODES.SERVE,
  DOMAIN_CODES.RETURN,
  DOMAIN_CODES.RALLY_CONSISTENCY,
  DOMAIN_CODES.DINK_SOFT_GAME,
  DOMAIN_CODES.TRANSITION,
  DOMAIN_CODES.BLOCK_RESET,
  DOMAIN_CODES.DOUBLES_POSITIONING,
  DOMAIN_CODES.ERROR_CONTROL
]);
var GATE_THRESHOLDS = Object.freeze({
  rating35: { overall: 3.5, criticalMin: 2.8 },
  rating40: {
    overall: 4,
    requiredDomains: [
      DOMAIN_CODES.DINK_SOFT_GAME,
      DOMAIN_CODES.TRANSITION,
      DOMAIN_CODES.BLOCK_RESET,
      DOMAIN_CODES.DOUBLES_POSITIONING,
      DOMAIN_CODES.CONSISTENCY
    ],
    requiredMin: 3.2
  },
  rating45: { overall: 4.5, provisionalCap: 4.5 },
  rating50: { overall: 5, verificationRequired: true }
});
function applyCriticalGates(ratingBeforeGates, skillVector, options = {}) {
  const gates = [];
  const limitingSkills = [];
  let rating = Number(ratingBeforeGates) || 0;
  const vector = { ...skillVector };
  const hasContradiction = Boolean(options.hasContradiction);
  const hasPressure = Number(vector[DOMAIN_CODES.PRESSURE_EXECUTION] || 0) >= 4;
  if (rating >= GATE_THRESHOLDS.rating35.overall) {
    for (const domain of CRITICAL_DOMAINS_DOUBLES) {
      const value = Number(vector[domain]);
      if (Number.isFinite(value) && value < GATE_THRESHOLDS.rating35.criticalMin) {
        gates.push({
          id: "gate_35_critical_floor",
          domain,
          threshold: GATE_THRESHOLDS.rating35.criticalMin,
          actual: value
        });
        limitingSkills.push(domain);
        rating = Math.min(rating, GATE_THRESHOLDS.rating35.overall);
      }
    }
  }
  if (rating >= GATE_THRESHOLDS.rating40.overall) {
    for (const domain of GATE_THRESHOLDS.rating40.requiredDomains) {
      const value = Number(vector[domain]);
      if (Number.isFinite(value) && value < GATE_THRESHOLDS.rating40.requiredMin) {
        gates.push({
          id: "gate_40_domain_required",
          domain,
          threshold: GATE_THRESHOLDS.rating40.requiredMin,
          actual: value
        });
        limitingSkills.push(domain);
        rating = Math.min(rating, GATE_THRESHOLDS.rating40.overall - 0.1);
      }
    }
    if (hasContradiction) {
      gates.push({ id: "gate_40_contradiction", domain: null });
      rating = Math.min(rating, GATE_THRESHOLDS.rating40.overall - 0.1);
    }
    if (!hasPressure) {
      gates.push({ id: "gate_40_pressure", domain: DOMAIN_CODES.PRESSURE_EXECUTION });
      rating = Math.min(rating, GATE_THRESHOLDS.rating40.overall);
    }
  }
  let verificationRequired = false;
  let statusOverride = null;
  if (rating >= GATE_THRESHOLDS.rating45.overall) {
    rating = Math.min(rating, GATE_THRESHOLDS.rating45.provisionalCap);
    verificationRequired = true;
    statusOverride = "under_review";
    gates.push({ id: "gate_45_cap", cap: GATE_THRESHOLDS.rating45.provisionalCap });
  }
  if (rating >= GATE_THRESHOLDS.rating50.overall) {
    verificationRequired = true;
    gates.push({ id: "gate_50_verification_required" });
  }
  return {
    ratingBeforeGates,
    ratingAfterGates: rating,
    appliedGates: gates,
    limitingSkills: [...new Set(limitingSkills)],
    verificationRequired,
    statusOverride
  };
}

// src/features/pick-vn-rating-v5/assessment/assessmentScoringEngine.js
var ANCHOR_MIN = 0;
var ANCHOR_MAX = 7;
function anchorToSkillMean(anchor) {
  const value = Math.max(ANCHOR_MIN, Math.min(ANCHOR_MAX, Number(anchor) || 0));
  const span = V5_MAX_RATING - V5_MIN_RATING;
  return V5_MIN_RATING + value / ANCHOR_MAX * span;
}
function getQuestionById(id) {
  return getCoreQuestionById(id) ?? ADAPTIVE_QUESTIONS.find((q2) => q2.id === id) ?? null;
}
function accumulateDomainScores(answers) {
  const domainSums = {};
  const domainCounts = {};
  for (const [questionId, anchor] of Object.entries(answers)) {
    const question = getQuestionById(questionId);
    if (!question) continue;
    const skill = anchorToSkillMean(anchor);
    const domains = [question.domain, ...question.secondaryDomains ?? []];
    for (const domain of domains) {
      domainSums[domain] = (domainSums[domain] ?? 0) + skill;
      domainCounts[domain] = (domainCounts[domain] ?? 0) + 1;
    }
  }
  const domainScores = {};
  for (const [domain, sum] of Object.entries(domainSums)) {
    domainScores[domain] = sum / domainCounts[domain];
  }
  return domainScores;
}
function buildSkillVector(domainScores, ratingMode = RATING_MODE.DOUBLES) {
  const weights = getDomainWeights(ratingMode);
  const vector = {};
  for (const domain of Object.keys(weights)) {
    vector[domain] = domainScores[domain] ?? null;
  }
  return vector;
}
function computeWeightedMean(skillVector, ratingMode = RATING_MODE.DOUBLES) {
  const weights = getDomainWeights(ratingMode);
  let sum = 0;
  let weightSum = 0;
  for (const [domain, weight] of Object.entries(weights)) {
    const value = Number(skillVector[domain]);
    if (!Number.isFinite(value)) continue;
    sum += value * weight;
    weightSum += weight;
  }
  if (weightSum <= 0) return V5_MIN_RATING;
  return clampRatingMean(sum / weightSum);
}
function detectContradictions(answers) {
  const flags = [];
  for (const question of ADAPTIVE_QUESTIONS) {
    if (question.route !== ADAPTIVE_ROUTE.CONSISTENCY_CHECK) continue;
    if (answers[question.id] == null) continue;
    const check = Number(answers[question.id]);
    if (check <= 2) {
      flags.push({
        type: "CONTRADICTION",
        questionId: question.id,
        related: question.checksContradiction ?? []
      });
    }
  }
  return flags;
}
function scoreAssessment(answers, options = {}) {
  const ratingMode = options.ratingMode ?? RATING_MODE.DOUBLES;
  const domainScores = accumulateDomainScores(answers);
  const skillVector = buildSkillVector(domainScores, ratingMode);
  const ratingBeforeGates = computeWeightedMean(skillVector, ratingMode);
  const warningFlags = detectContradictions(answers);
  const gateResult = applyCriticalGates(ratingBeforeGates, domainScores, {
    hasContradiction: warningFlags.length > 0
  });
  const answeredCount = Object.keys(answers).length;
  const coverage = answeredCount / Math.max(1, CORE_QUESTIONS.length);
  const initialDeviation = clampDeviation(0.55 - coverage * 0.15 + warningFlags.length * 0.05);
  const confidenceScore = Math.round(Math.max(10, Math.min(85, coverage * 70 - warningFlags.length * 10)));
  const estimatedError = clampRatingMean(initialDeviation * 0.85, 0.35);
  let ratingStatus = V5_RATING_STATUS.SELF_ASSESSED;
  if (gateResult.statusOverride) {
    ratingStatus = gateResult.statusOverride;
  } else if (warningFlags.length) {
    ratingStatus = V5_RATING_STATUS.UNDER_REVIEW;
  }
  const strengths = topSkills(domainScores, 2, "high");
  const limits = topSkills(domainScores, 2, "low");
  return {
    initialMean: gateResult.ratingAfterGates,
    initialDeviation,
    skillVector,
    domainScores,
    overallSkill: gateResult.ratingAfterGates,
    estimatedRating: gateResult.ratingBeforeGates,
    provisionalRating: gateResult.ratingAfterGates,
    provisionalDisplayRating: Math.min(toDisplayRating(gateResult.ratingAfterGates), 4.5),
    confidenceScore,
    estimatedError,
    estimatedRange: {
      low: clampRatingMean(gateResult.ratingAfterGates - estimatedError),
      high: clampRatingMean(gateResult.ratingAfterGates + estimatedError)
    },
    warningFlags,
    appliedGates: gateResult.appliedGates,
    limitingSkills: gateResult.limitingSkills,
    ratingBeforeGates: gateResult.ratingBeforeGates,
    ratingAfterGates: gateResult.ratingAfterGates,
    verificationRequired: gateResult.verificationRequired,
    ratingStatus,
    strengths,
    limits,
    assessmentVersion: V5_VERSION_BUNDLE.assessmentVersion,
    questionBankVersion: V5_VERSION_BUNDLE.questionBankVersion,
    versions: { ...V5_VERSION_BUNDLE },
    explanation: buildExplanation(gateResult.ratingAfterGates, strengths, limits),
    explanationDisplay: buildExplanationDisplay(gateResult.ratingAfterGates, strengths, limits, warningFlags)
  };
}
function clampDeviation(value) {
  return Math.max(0.18, Math.min(0.75, Number(value) || 0.48));
}
function topSkills(domainScores, n, direction) {
  const entries = Object.entries(domainScores).filter(([, v]) => Number.isFinite(v));
  entries.sort((a, b) => direction === "high" ? b[1] - a[1] : a[1] - b[1]);
  return entries.slice(0, n).map(([domain]) => domain);
}
function buildExplanation(rating, strengths, limits) {
  return {
    summary: `Rating t\u1ED5ng: ${rating.toFixed(3)}`,
    strengths: `K\u1EF9 n\u0103ng m\u1EA1nh: ${strengths.join(", ") || "\u2014"}`,
    limits: `K\u1EF9 n\u0103ng gi\u1EDBi h\u1EA1n: ${limits.join(", ") || "\u2014"}`
  };
}
function buildExplanationDisplay(rating, strengths, limits, warningFlags) {
  const provisionalLabel = formatRatingTerm("provisional_rating");
  return {
    summary: `${provisionalLabel}: ${rating.toFixed(1)}`,
    strengths: `K\u1EF9 n\u0103ng m\u1EA1nh: ${formatDomainList(strengths)}`,
    limits: `K\u1EF9 n\u0103ng gi\u1EDBi h\u1EA1n: ${formatDomainList(limits)}`,
    warnings: warningFlags.map(() => formatRatingTerm("contradiction"))
  };
}

// src/features/pick-vn-rating-v5/security/completeAssessmentPayloadGuard.js
var STRICT_COMPLETE_ASSESSMENT_ALLOWED_FIELDS = Object.freeze([
  "assessment_id",
  "answers",
  "rating_mode",
  "assessment_version"
]);
var COMPLETE_ASSESSMENT_FORBIDDEN_FIELDS = Object.freeze([]);
function validateCompleteAssessmentPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, code: "INVALID_PAYLOAD", message: "Payload must be an object." };
  }
  const allowed = new Set(STRICT_COMPLETE_ASSESSMENT_ALLOWED_FIELDS);
  const receivedFields = Object.keys(payload);
  const forbiddenFields = receivedFields.filter((field) => !allowed.has(field));
  if (forbiddenFields.length > 0) {
    return {
      ok: false,
      code: "FORBIDDEN_PAYLOAD_FIELD",
      forbiddenFields,
      message: "Payload ch\u1EE9a tr\u01B0\u1EDDng kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p."
    };
  }
  const assessmentId = payload.assessment_id;
  if (!assessmentId || typeof assessmentId !== "string") {
    return { ok: false, code: "MISSING_ASSESSMENT_ID", message: "assessment_id is required." };
  }
  const answers = payload.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return { ok: false, code: "INVALID_ANSWERS", message: "answers must be an object." };
  }
  const ratingMode = payload.rating_mode ?? "doubles";
  if (ratingMode !== "doubles" && ratingMode !== "singles") {
    return { ok: false, code: "INVALID_MODE", message: "rating_mode must be singles or doubles." };
  }
  return { ok: true, code: "OK", assessmentId, answers, ratingMode };
}

// src/features/pick-vn-rating-v5/constants/derivedMetrics.js
var DERIVED_METRICS_VERSION = GATE_VERSION;
var DERIVED_METRICS = Object.freeze({
  [DOMAIN_CODES.RALLY_CONSISTENCY]: Object.freeze({
    code: DOMAIN_CODES.RALLY_CONSISTENCY,
    type: "derived_metric",
    source_questions: ["core_gs_03", "core_exp_02", "adp_med_rally_01"],
    source_domains: [DOMAIN_CODES.GROUNDSTROKE, DOMAIN_CODES.CONSISTENCY],
    formula: "mean(anchorToSkillMean per question mapped to rally_consistency domain)",
    used_by_gates: true,
    used_by_confidence: false,
    used_by_explanation: true,
    version: DERIVED_METRICS_VERSION
  }),
  [DOMAIN_CODES.ERROR_CONTROL]: Object.freeze({
    code: DOMAIN_CODES.ERROR_CONTROL,
    type: "derived_metric",
    source_questions: ["core_dink_03", "adp_med_err_01"],
    source_domains: [DOMAIN_CODES.DINK_SOFT_GAME, DOMAIN_CODES.ERROR_CONTROL],
    formula: "mean(anchorToSkillMean per question mapped to error_control domain)",
    used_by_gates: true,
    used_by_confidence: true,
    used_by_explanation: true,
    version: DERIVED_METRICS_VERSION
  })
});

// src/features/pick-vn-rating-v5/services/assessmentValidation.js
var ANCHOR_MIN2 = 0;
var ANCHOR_MAX2 = 7;
function validateAnswerAnchors(answers) {
  const issues = [];
  for (const [questionId, anchor] of Object.entries(answers)) {
    const question = getQuestionById(questionId);
    if (!question) {
      issues.push(`unknown question: ${questionId}`);
      continue;
    }
    const value = Number(anchor);
    if (!Number.isInteger(value) || value < ANCHOR_MIN2 || value > ANCHOR_MAX2) {
      issues.push(`invalid anchor for ${questionId}: ${anchor}`);
    }
  }
  return { ok: issues.length === 0, issues };
}
function validateQuestionIds(answers) {
  const issues = [];
  for (const questionId of Object.keys(answers)) {
    if (!getQuestionById(questionId)) {
      issues.push(`invalid question id: ${questionId}`);
    }
    if (DOMAIN_CODE_ALIASES[questionId]) {
      issues.push(`alias used as question id: ${questionId}`);
    }
    if (normalizeDomainCode(questionId) && !questionId.startsWith("core_") && !questionId.startsWith("adp_")) {
      issues.push(`domain code used as question id: ${questionId}`);
    }
  }
  return { ok: issues.length === 0, issues };
}
function validateCoreCoverage(answers) {
  const missing = getCoreQuestionIds().filter((id) => answers[id] == null);
  return { ok: missing.length === 0, missing };
}
function validateAdaptiveBudget(answers) {
  const adaptiveCount = Object.keys(answers).filter((id) => id.startsWith("adp_")).length;
  if (adaptiveCount > MAX_ADAPTIVE_QUESTIONS) {
    return { ok: false, code: "ADAPTIVE_BUDGET_EXCEEDED", adaptiveCount, max: MAX_ADAPTIVE_QUESTIONS };
  }
  return { ok: true, adaptiveCount, max: MAX_ADAPTIVE_QUESTIONS };
}
function validateAssessmentOwnership(assessment, userId) {
  if (!assessment) return { ok: false, code: "ASSESSMENT_NOT_FOUND" };
  if (assessment.player_id !== userId) return { ok: false, code: "FORBIDDEN_OWNER" };
  return { ok: true };
}
function validateAssessmentDraft(assessment) {
  if (!assessment) return { ok: false, code: "ASSESSMENT_NOT_FOUND" };
  if (assessment.assessment_status === "completed") {
    return { ok: false, code: "ALREADY_COMPLETED", completed: true };
  }
  if (assessment.assessment_status !== "draft") {
    return { ok: false, code: "INVALID_STATUS", status: assessment.assessment_status };
  }
  return { ok: true };
}
function validateTenantMatch(assessment, tenantId) {
  if (!assessment || !tenantId) return { ok: false, code: "TENANT_MISMATCH" };
  if (assessment.tenant_id !== tenantId) return { ok: false, code: "TENANT_MISMATCH" };
  return { ok: true };
}
function validateRatingMode(ratingMode) {
  if (ratingMode === RATING_MODE.SINGLES) {
    return { ok: false, code: "SINGLES_NOT_IMPLEMENTED", message: "V5-B.1" };
  }
  if (ratingMode !== RATING_MODE.DOUBLES) {
    return { ok: false, code: "INVALID_MODE" };
  }
  return { ok: true };
}
function validateAnswersForCompletion(answers) {
  const questionCheck = validateQuestionIds(answers);
  if (!questionCheck.ok) return { ok: false, code: "INVALID_QUESTION_ID", issues: questionCheck.issues };
  const anchorCheck = validateAnswerAnchors(answers);
  if (!anchorCheck.ok) return { ok: false, code: "INVALID_ANSWER_ANCHOR", issues: anchorCheck.issues };
  const coreCheck = validateCoreCoverage(answers);
  if (!coreCheck.ok) return { ok: false, code: "MISSING_CORE_QUESTIONS", missing: coreCheck.missing };
  const adaptiveCheck = validateAdaptiveBudget(answers);
  if (!adaptiveCheck.ok) return adaptiveCheck;
  return { ok: true };
}

// src/features/pick-vn-rating-v5/server/activeVersionContract.js
function getActiveVersionContract() {
  return {
    assessmentVersion: V5_VERSION_BUNDLE.assessmentVersion,
    questionBankVersion: V5_VERSION_BUNDLE.questionBankVersion,
    scoringEngineVersion: V5_VERSION_BUNDLE.scoringEngineVersion,
    calibrationVersion: V5_VERSION_BUNDLE.calibrationVersion,
    gateVersion: V5_VERSION_BUNDLE.gateVersion,
    reliabilityVersion: V5_VERSION_BUNDLE.reliabilityVersion,
    glossaryVersion: V5_VERSION_BUNDLE.glossaryVersion,
    systemVersion: V5_VERSION_BUNDLE.systemVersion
  };
}

// src/features/pick-vn-rating-v5/server/scoreAssessmentCompletion.js
function assertNoDerivedMetricDoubleCount(domainScores, weightedDomains = DOUBLES_DOMAIN_WEIGHTS) {
  const issues = [];
  for (const code of Object.keys(DERIVED_METRICS)) {
    if (weightedDomains[code] != null) {
      issues.push(`derived metric ${code} must not appear in domain weights`);
    }
  }
  for (const code of Object.keys(weightedDomains)) {
    if (DERIVED_METRICS[code]) {
      issues.push(`domain weight table contains derived metric ${code}`);
    }
  }
  if (domainScores) {
    for (const code of Object.keys(DERIVED_METRICS)) {
      const sources = DERIVED_METRICS[code].source_domains ?? [];
      const hasWeightedSource = sources.some((s) => weightedDomains[s] != null);
      if (!hasWeightedSource && domainScores[code] != null) {
        issues.push(`derived metric ${code} has scores but no weighted source path`);
      }
    }
  }
  return { ok: issues.length === 0, issues };
}
function buildRatingEvent(assessment, scored, versions) {
  return {
    tenant_id: assessment.tenant_id,
    player_id: assessment.player_id,
    rating_mode: assessment.rating_mode,
    event_type: "assessment_complete",
    source_type: "questionnaire",
    source_id: String(assessment.id),
    verification_status: "confirmed",
    evidence_level: 1,
    pre_rating_mean: null,
    post_rating_mean: scored.ratingAfterGates,
    pre_deviation: null,
    post_deviation: scored.initialDeviation,
    rating_delta: scored.ratingAfterGates - V5_MIN_RATING,
    reliability_before: 0,
    reliability_after: 0,
    engine_version: versions.scoringEngineVersion,
    is_shadow: true,
    metadata: {
      assessmentVersion: versions.assessmentVersion,
      questionBankVersion: versions.questionBankVersion,
      gateVersion: versions.gateVersion,
      trustedRuntime: "pick-vn-rating-v5-trusted-server"
    }
  };
}
function buildShadowProfilePatch(assessment, scored, versions) {
  const displayRating = Math.min(toDisplayRating(scored.ratingAfterGates), 4.5);
  let ratingStatus = V5_RATING_STATUS.SELF_ASSESSED;
  if (scored.verificationRequired || scored.ratingStatus === V5_RATING_STATUS.UNDER_REVIEW) {
    ratingStatus = V5_RATING_STATUS.UNDER_REVIEW;
  } else if (scored.ratingAfterGates > V5_MIN_RATING) {
    ratingStatus = V5_RATING_STATUS.PROVISIONAL;
  }
  return {
    tenant_id: assessment.tenant_id,
    player_id: assessment.player_id,
    rating_mode: assessment.rating_mode,
    is_shadow: true,
    rollout_cohort: assessment.rollout_cohort ?? "v5-shadow-pilot",
    provisional_rating: scored.ratingAfterGates,
    open_rating_mean: scored.ratingAfterGates,
    open_rating_deviation: scored.initialDeviation,
    display_rating: displayRating,
    reliability_score: 0,
    rating_status: ratingStatus,
    evidence_level: 1,
    assessment_count: 1,
    engine_version: versions.systemVersion ?? "pick-vn-rating-v5",
    verified_rating_mean: null,
    verified_rating_deviation: null
  };
}
function buildCompletedAssessmentRow(assessment, answers, scored, versions) {
  return {
    id: assessment.id,
    tenant_id: assessment.tenant_id,
    player_id: assessment.player_id,
    rating_mode: assessment.rating_mode,
    assessment_status: "completed",
    is_shadow: true,
    rollout_cohort: assessment.rollout_cohort ?? "v5-shadow-pilot",
    answers,
    item_scores: scored.domainScores,
    domain_scores: scored.domainScores,
    skill_vector: scored.skillVector,
    overall_skill: scored.ratingAfterGates,
    initial_mean: scored.ratingAfterGates,
    initial_deviation: scored.initialDeviation,
    provisional_rating: scored.ratingAfterGates,
    confidence_score: scored.confidenceScore,
    estimated_error: scored.estimatedError,
    warning_flags: scored.warningFlags,
    applied_gates: scored.appliedGates,
    assessment_version: versions.assessmentVersion,
    question_bank_version: versions.questionBankVersion,
    scoring_engine_version: versions.scoringEngineVersion,
    gate_version: versions.gateVersion,
    calibration_version: versions.calibrationVersion,
    glossary_version: versions.glossaryVersion,
    reliability_version: versions.reliabilityVersion
  };
}
var SERVER_CONTEXT_KEYS = /* @__PURE__ */ new Set([
  "userId",
  "user_id",
  "tenantId",
  "tenant_id",
  "assessment",
  "__test_fault",
  "testFault"
]);
function buildClientPayloadFromInput(input) {
  const payload = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (SERVER_CONTEXT_KEYS.has(key)) continue;
    payload[key] = value;
  }
  return payload;
}
function scoreAssessmentForPersistence(input, assessment) {
  assertTrustedRuntime("scoreAssessmentForPersistence");
  const payloadCheck = validateCompleteAssessmentPayload(buildClientPayloadFromInput(input));
  if (!payloadCheck.ok) return payloadCheck;
  const { assessmentId, answers, ratingMode } = payloadCheck;
  const userId = input.userId ?? input.user_id;
  const tenantId = input.tenantId ?? input.tenant_id;
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };
  if (!tenantId) return { ok: false, code: "TENANT_UNRESOLVED" };
  const modeCheck = validateRatingMode(ratingMode);
  if (!modeCheck.ok) return modeCheck;
  if (!assessment) return { ok: false, code: "ASSESSMENT_NOT_FOUND" };
  const ownerCheck = validateAssessmentOwnership(assessment, userId);
  if (!ownerCheck.ok) return ownerCheck;
  const tenantCheck = validateTenantMatch(assessment, tenantId);
  if (!tenantCheck.ok) return tenantCheck;
  if (assessment.assessment_status === "completed") {
    const versions2 = getActiveVersionContract();
    return {
      ok: true,
      code: "ALREADY_COMPLETED",
      idempotent: true,
      assessmentId,
      response: {
        assessmentId,
        overall_skill: assessment.overall_skill,
        provisional_rating: assessment.provisional_rating,
        provisional_display_rating: assessment.provisional_rating != null ? Math.min(toDisplayRating(Number(assessment.provisional_rating)), 4.5) : null,
        versions: {
          assessmentVersion: assessment.assessment_version,
          questionBankVersion: assessment.question_bank_version,
          scoringEngineVersion: assessment.scoring_engine_version,
          gateVersion: assessment.gate_version,
          calibrationVersion: assessment.calibration_version,
          glossaryVersion: assessment.glossary_version,
          reliabilityVersion: assessment.reliability_version,
          systemVersion: versions2.systemVersion
        }
      }
    };
  }
  const draftCheck = validateAssessmentDraft(assessment);
  if (!draftCheck.ok) return draftCheck;
  const answerCheck = validateAnswersForCompletion(answers);
  if (!answerCheck.ok) return answerCheck;
  const versions = getActiveVersionContract();
  const scored = scoreAssessment(answers, { ratingMode: RATING_MODE.DOUBLES });
  const doubleCountCheck = assertNoDerivedMetricDoubleCount(scored.domainScores);
  if (!doubleCountCheck.ok) {
    return { ok: false, code: "DERIVED_METRIC_DOUBLE_COUNT", issues: doubleCountCheck.issues };
  }
  const provisionalDisplay = Math.min(toDisplayRating(scored.ratingAfterGates), 4.5);
  const derivedMetrics = {};
  for (const code of Object.keys(DERIVED_METRICS)) {
    derivedMetrics[code] = scored.domainScores[code] ?? null;
  }
  return {
    ok: true,
    code: "SCORED",
    assessmentId,
    answers,
    versions,
    response: {
      assessmentId,
      item_scores: scored.domainScores,
      domain_scores: scored.domainScores,
      derived_metrics: derivedMetrics,
      skill_vector: scored.skillVector,
      overall_skill: scored.ratingAfterGates,
      rating_before_gates: scored.ratingBeforeGates,
      rating_after_gates: scored.ratingAfterGates,
      estimated_rating: scored.ratingBeforeGates,
      provisional_rating: scored.ratingAfterGates,
      provisional_display_rating: provisionalDisplay,
      confidence_score: scored.confidenceScore,
      estimated_error: scored.estimatedError,
      warning_flags: scored.warningFlags,
      contradiction_flags: scored.warningFlags,
      applied_gates: scored.appliedGates,
      limiting_skills: scored.limitingSkills,
      verification_required: scored.verificationRequired,
      rating_status: scored.verificationRequired ? V5_RATING_STATUS.UNDER_REVIEW : scored.ratingStatus,
      versions
    },
    persistence: {
      assessment_id: assessmentId,
      player_id: assessment.player_id,
      tenant_id: assessment.tenant_id,
      completed_row: buildCompletedAssessmentRow(assessment, answers, scored, versions),
      rating_event: buildRatingEvent(assessment, scored, versions),
      profile_patch: buildShadowProfilePatch(assessment, scored, versions),
      versions
    }
  };
}

// src/features/pick-vn-rating-v5/config/ratingV5EdgeCorsConfig.js
var RATING_V5_CORS_ENV_KEY = "RATING_V5_CORS_ORIGINS";
var BLOCKED_CORS_MARKERS = [
  "__vercel_preview__",
  "__localhost_qa__"
];
var BLOCKED_CORS_PATTERNS = [
  /^\*$/,
  /^https?:\/\/\*\.vercel\.app$/i,
  /^https?:\/\/\*$/i
];
function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/$/, "");
}
function isBlockedCorsOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;
  if (BLOCKED_CORS_MARKERS.some((marker) => normalized.includes(marker))) {
    return true;
  }
  return BLOCKED_CORS_PATTERNS.some((pattern) => pattern.test(normalized));
}
function parseRatingV5CorsAllowlist(envValue) {
  const raw = String(envValue ?? "").trim();
  if (!raw) return [];
  const origins = raw.split(",").map(normalizeOrigin).filter(Boolean);
  for (const origin of origins) {
    if (isBlockedCorsOrigin(origin)) {
      throw new Error(`rating_v5_cors_blocked_origin:${origin}`);
    }
  }
  return origins;
}
function resolveRatingV5CorsAllowlistFromEnv(env = {}) {
  const fromKey = env[RATING_V5_CORS_ENV_KEY] ?? env.ratingV5CorsOrigins;
  if (typeof fromKey === "string" && fromKey.trim()) {
    return parseRatingV5CorsAllowlist(fromKey);
  }
  if (Array.isArray(env.allowedOrigins)) {
    return parseRatingV5CorsAllowlist(env.allowedOrigins.join(","));
  }
  return [];
}
function isOriginAllowedForRatingV5(origin, allowedOrigins = []) {
  const normalized = normalizeOrigin(origin);
  if (!normalized || isBlockedCorsOrigin(normalized)) {
    return false;
  }
  const list = Array.isArray(allowedOrigins) ? allowedOrigins.map(normalizeOrigin) : [];
  if (list.length === 0) {
    return false;
  }
  return list.includes(normalized);
}

// src/features/pick-vn-rating-v5/server/edgeHttpHelpers.js
var ERROR_MESSAGES = {
  UNAUTHORIZED: "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp h\u1EE3p l\u1EC7.",
  FORBIDDEN: "Kh\xF4ng c\xF3 quy\u1EC1n th\u1EF1c hi\u1EC7n thao t\xE1c n\xE0y.",
  ASSESSMENT_NOT_FOUND: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i \u0111\xE1nh gi\xE1.",
  ASSESSMENT_ALREADY_COMPLETED: "B\xE0i \u0111\xE1nh gi\xE1 \u0111\xE3 ho\xE0n th\xE0nh.",
  INVALID_QUESTION: "C\xE2u h\u1ECFi kh\xF4ng h\u1EE3p l\u1EC7.",
  INVALID_ANSWER: "C\xE2u tr\u1EA3 l\u1EDDi kh\xF4ng h\u1EE3p l\u1EC7.",
  FORBIDDEN_PAYLOAD_FIELD: "Payload ch\u1EE9a tr\u01B0\u1EDDng kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p.",
  VERSION_MISMATCH: "Phi\xEAn b\u1EA3n assessment kh\xF4ng kh\u1EDBp.",
  SINGLES_NOT_IMPLEMENTED: "\u0110\xE1nh gi\xE1 singles ch\u01B0a \u0111\u01B0\u1EE3c tri\u1EC3n khai.",
  PERSISTENCE_FAILED: "Kh\xF4ng th\u1EC3 l\u01B0u k\u1EBFt qu\u1EA3 \u0111\xE1nh gi\xE1.",
  INVALID_JSON: "JSON kh\xF4ng h\u1EE3p l\u1EC7.",
  METHOD_NOT_ALLOWED: "Ph\u01B0\u01A1ng th\u1EE9c kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.",
  TENANT_UNRESOLVED: "Kh\xF4ng x\xE1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c tenant.",
  EDGE_MISCONFIGURED: "Edge runtime ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh.",
  EDGE_RUNTIME_ERROR: "L\u1ED7i x\u1EED l\xFD y\xEAu c\u1EA7u."
};
var SCORE_CODE_MAP = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN_OWNER: "FORBIDDEN",
  TENANT_MISMATCH: "FORBIDDEN",
  ASSESSMENT_NOT_FOUND: "ASSESSMENT_NOT_FOUND",
  ALREADY_COMPLETED: "ASSESSMENT_ALREADY_COMPLETED",
  INVALID_QUESTION_ID: "INVALID_QUESTION",
  INVALID_ANSWER_ANCHOR: "INVALID_ANSWER",
  FORBIDDEN_PAYLOAD_FIELD: "FORBIDDEN_PAYLOAD_FIELD",
  FORBIDDEN_RATING_FIELDS: "FORBIDDEN_PAYLOAD_FIELD",
  UNKNOWN_FIELDS: "FORBIDDEN_PAYLOAD_FIELD",
  INVALID_ANSWERS: "INVALID_ANSWER",
  MISSING_CORE_QUESTIONS: "INVALID_ANSWER",
  ADAPTIVE_BUDGET_EXCEEDED: "INVALID_ANSWER",
  INVALID_MODE: "INVALID_ANSWER",
  SINGLES_NOT_IMPLEMENTED: "SINGLES_NOT_IMPLEMENTED",
  VERSION_MISMATCH: "VERSION_MISMATCH",
  PERSISTENCE_RPC_ERROR: "PERSISTENCE_FAILED",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
  PERSISTENCE_ERROR: "PERSISTENCE_FAILED"
};
function createRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function normalizeErrorCode(code) {
  return SCORE_CODE_MAP[code] ?? code ?? "EDGE_RUNTIME_ERROR";
}
function mapHttpStatus(code) {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
    case "TENANT_UNRESOLVED":
      return 403;
    case "ASSESSMENT_NOT_FOUND":
      return 404;
    case "ASSESSMENT_ALREADY_COMPLETED":
      return 200;
    case "SINGLES_NOT_IMPLEMENTED":
      return 422;
    case "METHOD_NOT_ALLOWED":
      return 405;
    case "PERSISTENCE_FAILED":
    case "EDGE_MISCONFIGURED":
    case "EDGE_RUNTIME_ERROR":
      return 500;
    default:
      return 400;
  }
}
function buildCorsHeaders(origin, allowedOrigins = []) {
  const list = Array.isArray(allowedOrigins) ? allowedOrigins : [];
  const allowed = isOriginAllowedForRatingV5(origin, list);
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rating-v5-staging-fault",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
  if (allowed) {
    headers["Access-Control-Allow-Origin"] = String(origin).trim();
  }
  return { headers, allowed };
}
function buildErrorResponse(code, requestId, extra = {}) {
  const normalized = normalizeErrorCode(code);
  const error = {
    code: normalized,
    message: ERROR_MESSAGES[normalized] ?? ERROR_MESSAGES.EDGE_RUNTIME_ERROR,
    requestId
  };
  if (Array.isArray(extra.fields) && extra.fields.length > 0) {
    error.details = { fields: extra.fields };
  }
  const { fields: _fields, ...safeExtra } = extra;
  return {
    ok: false,
    error,
    request_id: requestId,
    ...safeExtra
  };
}
function buildSuccessResponse(payload, requestId) {
  return {
    ok: true,
    request_id: requestId,
    engine_version: SCORING_ENGINE_VERSION,
    ...payload
  };
}
function sanitizeErrorMessage(message) {
  if (!message) return ERROR_MESSAGES.PERSISTENCE_FAILED;
  const lower = String(message).toLowerCase();
  if (lower.includes("sql") || lower.includes("plpgsql") || lower.includes("relation") || lower.includes("service_role") || lower.includes("jwt") || lower.includes("stack")) {
    return ERROR_MESSAGES.PERSISTENCE_FAILED;
  }
  return ERROR_MESSAGES.PERSISTENCE_FAILED;
}
function logEdgeRequest(meta) {
  const safe = {
    request_id: meta.request_id,
    assessment_id: meta.assessment_id ?? null,
    authenticated_user_id: meta.authenticated_user_id ?? null,
    tenant_id: meta.tenant_id ?? null,
    engine_version: meta.engine_version ?? SCORING_ENGINE_VERSION,
    result_status: meta.result_status,
    duration_ms: meta.duration_ms,
    answer_count: meta.answer_count ?? null
  };
  console.log(JSON.stringify({ type: "rating_v5_edge_request", ...safe }));
}
function isStagingFaultInjectionEnabled(supabaseUrl) {
  const ref = "qyewbxjsiiyufanzcjcq";
  return String(supabaseUrl || "").includes(ref) || false;
}
var STAGING_FAULT_HEADER = "x-rating-v5-staging-fault";

// src/features/pick-vn-rating-v5/server/edgeEntry.js
async function handleCompleteAssessmentHttpRequest(request, env = {}) {
  assertTrustedRuntime("edgeHttp");
  const started = Date.now();
  const requestId = createRequestId();
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigins = resolveRatingV5CorsAllowlistFromEnv(env);
  const { headers: corsHeaders, allowed: corsAllowed } = buildCorsHeaders(origin, allowedOrigins);
  const finish = (payload, status, meta = {}) => {
    logEdgeRequest({
      request_id: requestId,
      assessment_id: meta.assessment_id,
      authenticated_user_id: meta.user_id,
      tenant_id: meta.tenant_id,
      engine_version: meta.engine_version,
      result_status: meta.result_status ?? String(status),
      duration_ms: Date.now() - started,
      answer_count: meta.answer_count
    });
    return jsonResponse(payload, status, corsHeaders);
  };
  if (request.method === "OPTIONS") {
    if (!corsAllowed && origin) {
      return finish(buildErrorResponse("FORBIDDEN", requestId), 403);
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return finish(buildErrorResponse("METHOD_NOT_ALLOWED", requestId), 405);
  }
  if (!corsAllowed && origin) {
    return finish(buildErrorResponse("FORBIDDEN", requestId), 403);
  }
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return finish(buildErrorResponse("UNAUTHORIZED", requestId), 401);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return finish(buildErrorResponse("INVALID_JSON", requestId), 400);
  }
  const payloadCheck = validateCompleteAssessmentPayload(body);
  if (!payloadCheck.ok) {
    const code = normalizeErrorCode(payloadCheck.code);
    return finish(
      buildErrorResponse(code, requestId, {
        fields: payloadCheck.forbiddenFields
      }),
      mapHttpStatus(code),
      { result_status: code }
    );
  }
  const { assessmentId, answers, ratingMode } = payloadCheck;
  const { createSupabaseClients, resolveTenantId, fetchAssessmentRow, supabaseUrl } = env;
  if (!createSupabaseClients) {
    return finish(buildErrorResponse("EDGE_MISCONFIGURED", requestId), 500);
  }
  const clients = createSupabaseClients(authHeader);
  const userResult = await clients.user.auth.getUser();
  const user = userResult.data?.user;
  if (!user) {
    return finish(buildErrorResponse("UNAUTHORIZED", requestId), 401, { user_id: null });
  }
  const tenantId = await resolveTenantId(clients.user, user.id);
  if (!tenantId) {
    return finish(buildErrorResponse("TENANT_UNRESOLVED", requestId), 403, { user_id: user.id });
  }
  const assessment = await fetchAssessmentRow(clients.user, assessmentId);
  const scored = scoreAssessmentForPersistence(
    {
      assessment_id: assessmentId,
      answers,
      rating_mode: ratingMode,
      assessment_version: body.assessment_version,
      userId: user.id,
      tenantId
    },
    assessment
  );
  const answerCount = Object.keys(answers).length;
  const baseMeta = {
    assessment_id: assessmentId,
    user_id: user.id,
    tenant_id: tenantId,
    answer_count: answerCount
  };
  if (!scored.ok) {
    const code = normalizeErrorCode(scored.code);
    const status = mapHttpStatus(code);
    return finish(buildErrorResponse(code, requestId, { code: scored.code }), status, {
      ...baseMeta,
      result_status: code
    });
  }
  if (scored.code === "ALREADY_COMPLETED") {
    return finish(
      buildSuccessResponse(
        {
          code: "ASSESSMENT_ALREADY_COMPLETED",
          idempotent: true,
          ...scored.response
        },
        requestId
      ),
      200,
      { ...baseMeta, result_status: "ASSESSMENT_ALREADY_COMPLETED" }
    );
  }
  const stagingFaultHeader = request.headers.get(STAGING_FAULT_HEADER);
  if (stagingFaultHeader === "after_scoring" && isStagingFaultInjectionEnabled(supabaseUrl)) {
    return finish(buildErrorResponse("PERSISTENCE_FAILED", requestId), 500, {
      ...baseMeta,
      result_status: "STAGING_FAULT_AFTER_SCORING"
    });
  }
  const sqlFault = isStagingFaultInjectionEnabled(supabaseUrl) && stagingFaultHeader ? stagingFaultHeader : null;
  const { data, error } = await clients.service.rpc("rating_v5_service_persist_assessment_completion", {
    p_assessment_id: assessmentId,
    p_payload: scored.persistence,
    p_test_fault: sqlFault
  });
  if (error) {
    const code = normalizeErrorCode(error.message?.includes("test_fault") ? "PERSISTENCE_FAILED" : "PERSISTENCE_FAILED");
    return finish(
      buildErrorResponse(code, requestId, { message: sanitizeErrorMessage(error.message) }),
      mapHttpStatus(code),
      { ...baseMeta, result_status: code }
    );
  }
  if (!data?.ok) {
    const code = normalizeErrorCode(data?.code ?? "PERSISTENCE_FAILED");
    return finish(
      buildErrorResponse(code, requestId),
      mapHttpStatus(code),
      { ...baseMeta, result_status: code }
    );
  }
  return finish(
    buildSuccessResponse(
      {
        code: data.code === "ALREADY_COMPLETED" ? "ASSESSMENT_ALREADY_COMPLETED" : "COMPLETED",
        idempotent: data.idempotent ?? false,
        ...scored.response,
        profileId: data.profileId ?? data.profile_id,
        shadow: true
      },
      requestId
    ),
    200,
    { ...baseMeta, result_status: "COMPLETED" }
  );
}
function jsonResponse(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
export {
  handleCompleteAssessmentHttpRequest
};
