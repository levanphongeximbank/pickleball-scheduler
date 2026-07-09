import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ANIMATION_MODES } from "../src/components/tournament/animation/animationUtils.js";
import {
  EFFECT_PRELUDE_PRESETS,
  EFFECT_PRELUDE_SCOPE,
  buildEffectPreludeContext,
  buildEffectPreludeParticipants,
  buildPreludeSubline,
  getEffectPreludePresetKey,
  getPreludeMessageAtProgress,
  getPreludeProgressPercent,
  hasEffectPrelude,
  resolveEffectPreludePreset,
} from "../src/components/tournament/animation/shared/effectPreludeConfig.js";

describe("effect prelude config", () => {
  it("defines presets for tournament animation modes and court scheduling", () => {
    assert.ok(EFFECT_PRELUDE_PRESETS[ANIMATION_MODES.PAIRING_REVEAL]);
    assert.ok(EFFECT_PRELUDE_PRESETS[ANIMATION_MODES.SNAKE_GROUP]);
    assert.ok(EFFECT_PRELUDE_PRESETS[ANIMATION_MODES.RANDOM_DRAW]);
    assert.ok(EFFECT_PRELUDE_PRESETS[ANIMATION_MODES.GROUP_MATCH_PAIRING]);
    assert.ok(EFFECT_PRELUDE_PRESETS[ANIMATION_MODES.BRACKET_REVEAL]);
    assert.ok(EFFECT_PRELUDE_PRESETS[ANIMATION_MODES.DAILY_FAIR_MATCH]);
    assert.ok(EFFECT_PRELUDE_PRESETS[EFFECT_PRELUDE_SCOPE.COURT_SCHEDULING]);
  });

  it("detects prelude support by animation mode", () => {
    assert.equal(getEffectPreludePresetKey(ANIMATION_MODES.PAIRING_REVEAL), ANIMATION_MODES.PAIRING_REVEAL);
    assert.equal(hasEffectPrelude(ANIMATION_MODES.PAIRING_REVEAL), true);
    assert.equal(hasEffectPrelude("unknown_mode"), false);
  });

  it("builds dynamic subline for pairing reveal", () => {
    const subline = buildPreludeSubline(ANIMATION_MODES.PAIRING_REVEAL, {
      playerCount: 24,
      courtCount: 6,
    });

    assert.match(subline, /24 VĐV/);
    assert.match(subline, /6 sân/);
  });

  it("builds context and participants from animation payload", () => {
    const payload = {
      waitingPlayers: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }],
      groups: [{ id: "g1" }, { id: "g2" }],
      matchCount: 8,
      courts: [{ id: "c1" }],
    };

    const context = buildEffectPreludeContext(payload);
    assert.equal(context.playerCount, 2);
    assert.equal(context.groupCount, 2);
    assert.equal(context.matchCount, 8);
    assert.equal(context.courtCount, 1);

    const participants = buildEffectPreludeParticipants(payload);
    assert.equal(participants.length, 2);
    assert.equal(participants[0].name, "A");
  });

  it("rotates prelude messages by progress percent", () => {
    const messages = EFFECT_PRELUDE_PRESETS[ANIMATION_MODES.PAIRING_REVEAL].messages;

    assert.equal(getPreludeMessageAtProgress(messages, 0).badge, "Đang phân tích");
    assert.equal(getPreludeMessageAtProgress(messages, 40).badge, "Đánh giá độ cân bằng");
    assert.equal(getPreludeMessageAtProgress(messages, 90).badge, "Tối ưu ghép cặp");
  });

  it("computes progress percent from countdown", () => {
    assert.equal(getPreludeProgressPercent(10, 10), 0);
    assert.equal(getPreludeProgressPercent(10, 5), 50);
    assert.equal(getPreludeProgressPercent(10, 0), 100);
  });

  it("resolves preset with duration and subline", () => {
    const preset = resolveEffectPreludePreset(ANIMATION_MODES.GROUP_MATCH_PAIRING, {
      matchCount: 12,
    });

    assert.equal(preset.durationSec, 6);
    assert.equal(preset.headline, "AI đang ghép trận đấu");
    assert.match(preset.subline, /12 trận/);
    assert.equal(preset.activeFlowStepKey, "match_pairing");
  });

  it("marks daily fair match preset to skip analyze phase after prelude", () => {
    const preset = resolveEffectPreludePreset(ANIMATION_MODES.DAILY_FAIR_MATCH, {});
    assert.equal(preset.skipDailyAnalyzePhase, true);
    assert.equal(preset.durationSec, 5);
  });
});
