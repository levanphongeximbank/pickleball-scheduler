import { COURT_END } from "../constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../constants/courtSides.js";
import { MATCH_EVENT_TYPE } from "../constants/eventTypes.js";
import { MATCH_TYPE } from "../constants/matchTypes.js";
import { SCORING_FORMAT } from "../constants/scoringFormats.js";
import {
  RULE_SET_ID,
  SCORING_SYSTEM,
  SCORING_VARIANT,
} from "../constants/scoringStrategy.js";

const PLAYER_NAMES = {
  A: "Nguyễn Văn A",
  B: "Trần Văn B",
  C: "Lê Văn C",
  D: "Phạm Văn D",
  P1: "Nguyễn Văn P1",
  P2: "Trần Văn P2",
};

export function getPlayerDisplayName(playerId) {
  return PLAYER_NAMES[playerId] || playerId;
}

function doublesBase(overrides = {}) {
  return {
    matchId: "proto-doubles-1",
    matchType: MATCH_TYPE.DOUBLES,
    scoringFormat: SCORING_FORMAT.SIDE_OUT,
    pointsToWin: 11,
    winBy: 2,
    teams: {
      teamA: {
        teamId: "team-a",
        teamName: "Đội A",
        courtEnd: COURT_END.NEAR_END,
        players: [
          { playerId: "A", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT },
          { playerId: "B", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT },
        ],
      },
      teamB: {
        teamId: "team-b",
        teamName: "Đội B",
        courtEnd: COURT_END.FAR_END,
        players: [
          { playerId: "C", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT },
          { playerId: "D", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT },
        ],
      },
    },
    firstServingTeamId: "team-a",
    firstServingPlayerId: "A",
    ...overrides,
  };
}

function usapRallyDoublesBase(overrides = {}) {
  return doublesBase({
    matchId: "proto-usap-rally-doubles",
    scoringFormat: SCORING_FORMAT.RALLY,
    scoringSystem: SCORING_SYSTEM.RALLY,
    scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
    ruleSetId: RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1,
    pointsToWin: 11,
    winBy: 2,
    freezeRule: "NONE",
    serverNumberRule: "NONE",
    ...overrides,
  });
}

export const REFEREE_V5_FIXTURES = [
  {
    id: "doubles-side-out-0-0-2",
    label: "Doubles side-out — 0–0–2",
    meta: {
      tournamentName: "Giải Prototype V5",
      eventName: "Bán kết đôi nam",
      matchCode: "BK-01",
      courtName: "Sân 3",
    },
    config: doublesBase(),
    preEvents: [],
  },
  {
    id: "doubles-server-1",
    label: "Doubles — Server 1 active",
    meta: {
      tournamentName: "Giải Prototype V5",
      eventName: "Bán kết đôi nam",
      matchCode: "BK-02",
      courtName: "Sân 1",
    },
    config: doublesBase(),
    preEvents: [MATCH_EVENT_TYPE.START_MATCH],
  },
  {
    id: "doubles-server-2",
    label: "Doubles — Server 2 active",
    meta: {
      tournamentName: "Giải Prototype V5",
      eventName: "Bán kết đôi nam",
      matchCode: "BK-03",
      courtName: "Sân 2",
    },
    config: doublesBase(),
    preEvents: [
      MATCH_EVENT_TYPE.START_MATCH,
      MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    ],
  },
  {
    id: "singles-even",
    label: "Singles — even score",
    meta: {
      tournamentName: "Giải Prototype V5",
      eventName: "Đơn nam",
      matchCode: "DN-01",
      courtName: "Sân 4",
    },
    config: {
      matchId: "proto-singles-even",
      matchType: MATCH_TYPE.SINGLES,
      scoringFormat: SCORING_FORMAT.SIDE_OUT,
      pointsToWin: 11,
      winBy: 2,
      teams: {
        teamA: {
          teamId: "team-a",
          teamName: "Đội A",
          courtEnd: COURT_END.NEAR_END,
          players: [{ playerId: "P1", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT }],
        },
        teamB: {
          teamId: "team-b",
          teamName: "Đội B",
          courtEnd: COURT_END.FAR_END,
          players: [{ playerId: "P2", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT }],
        },
      },
      firstServingTeamId: "team-a",
      firstServingPlayerId: "P1",
    },
    preEvents: [MATCH_EVENT_TYPE.START_MATCH],
  },
  {
    id: "singles-odd",
    label: "Singles — odd score",
    meta: {
      tournamentName: "Giải Prototype V5",
      eventName: "Đơn nam",
      matchCode: "DN-02",
      courtName: "Sân 5",
    },
    config: {
      matchId: "proto-singles-odd",
      matchType: MATCH_TYPE.SINGLES,
      scoringFormat: SCORING_FORMAT.SIDE_OUT,
      pointsToWin: 11,
      winBy: 2,
      teams: {
        teamA: {
          teamId: "team-a",
          teamName: "Đội A",
          courtEnd: COURT_END.NEAR_END,
          players: [{ playerId: "P1", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT }],
        },
        teamB: {
          teamId: "team-b",
          teamName: "Đội B",
          courtEnd: COURT_END.FAR_END,
          players: [{ playerId: "P2", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT }],
        },
      },
      firstServingTeamId: "team-a",
      firstServingPlayerId: "P1",
    },
    preEvents: [
      MATCH_EVENT_TYPE.START_MATCH,
      MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    ],
  },
  {
    id: "doubles-usap-rally",
    label: "Doubles — USAP 2026 Rally",
    meta: {
      tournamentName: "Giải Prototype V5",
      eventName: "USAP Rally đôi nam",
      matchCode: "UR-01",
      courtName: "Sân 8",
    },
    config: usapRallyDoublesBase(),
    preEvents: [MATCH_EVENT_TYPE.START_MATCH],
  },
  {
    id: "near-end-serving",
    label: "Near-end serving",
    meta: {
      tournamentName: "Giải Prototype V5",
      eventName: "Vòng bảng",
      matchCode: "VB-01",
      courtName: "Sân 6",
    },
    config: doublesBase({ firstServingTeamId: "team-a", firstServingPlayerId: "A" }),
    preEvents: [MATCH_EVENT_TYPE.START_MATCH],
  },
  {
    id: "far-end-serving",
    label: "Far-end serving",
    meta: {
      tournamentName: "Giải Prototype V5",
      eventName: "Vòng bảng",
      matchCode: "VB-02",
      courtName: "Sân 7",
    },
    config: doublesBase({
      firstServingTeamId: "team-b",
      firstServingPlayerId: "D",
    }),
    preEvents: [MATCH_EVENT_TYPE.START_MATCH],
  },
];

export function getFixtureById(fixtureId) {
  return REFEREE_V5_FIXTURES.find((item) => item.id === fixtureId) || REFEREE_V5_FIXTURES[0];
}
