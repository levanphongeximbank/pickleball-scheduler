/**
 * G2-H F5 — format-settings Groups 1–6 navigation preservation.
 * URL ?section= is presentation authority. Zero Tournament / competitionRules mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  FORMAT_SETTINGS_SECTION,
  FORMAT_SETTINGS_SECTION_DEFAULT,
  FORMAT_SETTINGS_SECTION_IDS,
  FORMAT_SETTINGS_SECTION_QUERY_KEY,
  applyFormatSettingsSectionSearchParams,
  readFormatSettingsSectionQuery,
  resolveFormatSettingsSection,
} from "../src/features/tournament/experience-a1/components/formatSettingsSectionNavigation.js";

function src(path) {
  return readFileSync(path, "utf8");
}

const PANEL =
  "src/features/tournament/experience-a1/components/OfficialContentFormatSettingsPanel.jsx";
const NAV =
  "src/features/tournament/experience-a1/components/formatSettingsSectionNavigation.js";
const SETTINGS_PAGE =
  "src/features/tournament/experience-a1/pages/IndividualSettingsPage.jsx";

describe("official-open-settings-format-section-f5-navigation-01", () => {
  it("owner case: eventId + tab=format + section=structure remounts as Group 2", () => {
    const before = new URLSearchParams(
      "eventId=ev-doi-nam&tab=format&section=structure"
    );
    const resolved = resolveFormatSettingsSection(
      readFormatSettingsSectionQuery(before)
    );
    assert.equal(resolved.sectionId, FORMAT_SETTINGS_SECTION.STRUCTURE);
    assert.equal(resolved.source, "url");
    assert.equal(resolved.valid, true);
    assert.equal(before.get("eventId"), "ev-doi-nam");
    assert.equal(before.get("tab"), "format");
    assert.equal(before.get(FORMAT_SETTINGS_SECTION_QUERY_KEY), "structure");
  });

  it("F5 matrix: Groups 1–6 restore from URL section", () => {
    const matrix = [
      [FORMAT_SETTINGS_SECTION.CONTENT_REGISTRATION, "1"],
      [FORMAT_SETTINGS_SECTION.STRUCTURE, "2"],
      [FORMAT_SETTINGS_SECTION.MATCH_RULES, "3"],
      [FORMAT_SETTINGS_SECTION.RANKING, "4"],
      [FORMAT_SETTINGS_SECTION.OPS, "5"],
      [FORMAT_SETTINGS_SECTION.OPS_INFRA, "6"],
    ];
    for (const [sectionId] of matrix) {
      const params = new URLSearchParams(
        `eventId=ev1&tab=format&section=${sectionId}`
      );
      const resolved = resolveFormatSettingsSection(
        readFormatSettingsSectionQuery(params)
      );
      assert.equal(resolved.sectionId, sectionId, `section=${sectionId}`);
      assert.equal(resolved.source, "url");
      assert.equal(params.get("eventId"), "ev1");
      assert.equal(params.get("tab"), "format");
    }
  });

  it("clicking Group updates section while preserving eventId and tab=format", () => {
    const current = new URLSearchParams("eventId=ev-doi-nam&tab=format");
    const next = applyFormatSettingsSectionSearchParams(
      current,
      FORMAT_SETTINGS_SECTION.STRUCTURE
    );
    assert.equal(next.get(FORMAT_SETTINGS_SECTION_QUERY_KEY), "structure");
    assert.equal(next.get("eventId"), "ev-doi-nam");
    assert.equal(next.get("tab"), "format");
  });

  it("Group 3 restores; invalid section fails safe; legacy URL defaults Group 3", () => {
    const group3 = resolveFormatSettingsSection(
      readFormatSettingsSectionQuery(
        new URLSearchParams("eventId=ev1&tab=format&section=match-rules")
      )
    );
    assert.equal(group3.sectionId, FORMAT_SETTINGS_SECTION.MATCH_RULES);
    assert.equal(group3.source, "url");

    const invalid = resolveFormatSettingsSection("not-a-real-group");
    assert.equal(invalid.sectionId, FORMAT_SETTINGS_SECTION_DEFAULT);
    assert.equal(invalid.valid, false);
    assert.equal(invalid.normalized, true);
    assert.equal(invalid.source, "fallback");

    const legacy = resolveFormatSettingsSection(
      readFormatSettingsSectionQuery(new URLSearchParams("eventId=ev1&tab=format"))
    );
    assert.equal(legacy.sectionId, FORMAT_SETTINGS_SECTION.MATCH_RULES);
    assert.equal(legacy.source, "default");
    assert.equal(legacy.valid, true);
  });

  it("change-end alias maps to match-rules; all section ids are stable semantics", () => {
    const aliased = resolveFormatSettingsSection("change-end");
    assert.equal(aliased.sectionId, FORMAT_SETTINGS_SECTION.MATCH_RULES);
    assert.equal(aliased.source, "alias");
    assert.equal(aliased.normalized, true);
    assert.deepEqual([...FORMAT_SETTINGS_SECTION_IDS], [
      "content-registration",
      "structure",
      "match-rules",
      "ranking",
      "ops",
      "ops-infra",
    ]);
  });

  it("Back/Forward history is URL section projection (replace:false), not mutation", () => {
    const g2 = applyFormatSettingsSectionSearchParams(
      "eventId=ev1&tab=format",
      FORMAT_SETTINGS_SECTION.STRUCTURE
    );
    const g3 = applyFormatSettingsSectionSearchParams(
      g2,
      FORMAT_SETTINGS_SECTION.MATCH_RULES
    );
    assert.equal(readFormatSettingsSectionQuery(g2), "structure");
    assert.equal(readFormatSettingsSectionQuery(g3), "match-rules");
    assert.equal(g3.get("eventId"), "ev1");
    assert.equal(g3.get("tab"), "format");

    const panel = src(PANEL);
    assert.match(panel, /useSearchParams/);
    assert.match(panel, /applyFormatSettingsSectionSearchParams/);
    assert.match(panel, /replace:\s*false/);
    assert.doesNotMatch(panel, /useState\(["']match-rules["']\)/);
    assert.doesNotMatch(panel, /localStorage/);
  });

  it("navigation wiring causes zero canonical / competitionRules mutation surface", () => {
    const panel = src(PANEL);
    const nav = src(NAV);
    const settingsPage = src(SETTINGS_PAGE);

    const setActiveIdx = panel.indexOf("const setActiveGroup = (sectionId) =>");
    assert.ok(setActiveIdx >= 0, "setActiveGroup present");
    const setActiveBlock = panel.slice(setActiveIdx, setActiveIdx + 180);
    assert.match(setActiveBlock, /applyFormatSettingsSectionSearchParams/);
    assert.match(setActiveBlock, /setSearchParams\(next,\s*\{\s*replace:\s*false\s*\}\)/);
    assert.doesNotMatch(setActiveBlock, /\bsetDraft\b/);
    assert.doesNotMatch(setActiveBlock, /onSaveDraft|onUpdate|persistTournament|\.update\(/);

    assert.match(nav, /Does not persist into Tournament/);
    assert.doesNotMatch(nav, /localStorage\.(getItem|setItem|removeItem)/);
    assert.doesNotMatch(nav, /events\[\]\.competitionRules\s*=/);
    assert.doesNotMatch(nav, /settings\.officialCompetition/);
    assert.doesNotMatch(panel, /localStorage\.(getItem|setItem|removeItem)/);

    // Content authority path for format save remains event-scoped; nav helper is separate.
    assert.match(settingsPage, /contentRules/);
    assert.match(panel, /data-testid=\{`content-settings-nav-\$\{g\.id\}`\}/);
  });

  it("switching section does not rewrite competitionRules keys in search params", () => {
    const current = new URLSearchParams(
      "eventId=ev-explicit&tab=format&section=structure"
    );
    const next = applyFormatSettingsSectionSearchParams(
      current,
      FORMAT_SETTINGS_SECTION.OPS_INFRA
    );
    assert.equal(next.get("eventId"), "ev-explicit");
    assert.equal(next.get("tab"), "format");
    assert.equal(next.get("section"), "ops-infra");
    assert.equal(next.get("competitionRules"), null);
    assert.equal(next.toString().includes("competitionRules"), false);
  });
});
