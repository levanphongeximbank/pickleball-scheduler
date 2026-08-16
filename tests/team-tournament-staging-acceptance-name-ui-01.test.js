/**
 * TEAM-TOURNAMENT-STAGING-ACCEPTANCE name UI + canonical rename wiring
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { createCloudTournamentRepository } from "../src/features/tournament/repositories/cloudTournamentRepository.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import {
  hydrateTeamTournamentNameDraft,
  renameTeamTournamentDisplayName,
  sanitizeTeamTournamentRenameError,
  TEAM_TOURNAMENT_RENAME_GENERIC_ERROR,
} from "../src/features/team-tournament/services/teamTournamentRenameService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const TENANT_ID = "venue-staging-a";
const TOURNAMENT_ID = "3ad588d5-1395-437b-baed-e0d45b561069";
const CURRENT_NAME = "Giải đồng đội 15/8/2026";

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function sliceFn(src, startToken, endToken) {
  const start = src.indexOf(startToken);
  const end = src.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0, `missing ${startToken}`);
  assert.ok(end > start, `missing ${endToken} after ${startToken}`);
  return src.slice(start, end);
}

describe("team-tournament-staging-acceptance-name-ui-01", () => {
  it("1 hydrates current tournament.name into the Tên giải draft", () => {
    assert.equal(hydrateTeamTournamentNameDraft({ name: CURRENT_NAME }), CURRENT_NAME);
    assert.equal(hydrateTeamTournamentNameDraft(null), "");

    const panel = readSrc("src/components/tournament/team/TeamFormatVenueSetupPanel.jsx");
    assert.match(panel, /label="Tên giải"/);
    assert.match(panel, /value=\{nameDraft\}/);
    assert.match(panel, /hydrateTeamTournamentNameDraft\(tournament\)/);
  });

  it("2 non-manager cannot rename", async () => {
    let calls = 0;
    const result = await renameTeamTournamentDisplayName(
      {
        canManage: false,
        clubId: CLUB_ID,
        tenantId: TENANT_ID,
        tournamentId: TOURNAMENT_ID,
        name: "Tên mới",
      },
      {
        updateTournamentCommand: async () => {
          calls += 1;
          return { ok: true, tournament: { name: "Tên mới" } };
        },
      }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "FORBIDDEN");
    assert.equal(calls, 0);

    const panel = readSrc("src/components/tournament/team/TeamFormatVenueSetupPanel.jsx");
    const saveName = sliceFn(
      panel,
      "async function handleSaveName()",
      "async function handleSave()"
    );
    assert.match(saveName, /if \(!canManage\) return;/);
    assert.match(panel, /disabled=\{!canManage \|\| nameBusy\}/);
  });

  it("3 Owner rename calls exactly one canonical service with { name }", async () => {
    const calls = [];
    const result = await renameTeamTournamentDisplayName(
      {
        canManage: true,
        clubId: CLUB_ID,
        tenantId: TENANT_ID,
        tournamentId: TOURNAMENT_ID,
        name: "  Tên mới  ",
      },
      {
        updateTournamentCommand: async (scope, tournamentId, patch, options) => {
          calls.push({ scope, tournamentId, patch, options });
          return {
            ok: true,
            tournament: { id: tournamentId, name: "Tên mới" },
          };
        },
      }
    );
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].patch, { name: "Tên mới" });
    assert.equal(calls[0].tournamentId, TOURNAMENT_ID);
    assert.equal(calls[0].scope.id, CLUB_ID);
    assert.equal(calls[0].scope.tenantId, TENANT_ID);
  });

  it("4-6 UI and rename service never write canonical_tournaments or team_tournaments", () => {
    const panel = readSrc("src/components/tournament/team/TeamFormatVenueSetupPanel.jsx");
    const service = readSrc(
      "src/features/team-tournament/services/teamTournamentRenameService.js"
    );
    const setup = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
    for (const src of [panel, service, setup]) {
      assert.doesNotMatch(src, /\.from\(\s*["']canonical_tournaments["']\s*\)/);
      assert.doesNotMatch(src, /\.from\(\s*["']team_tournaments["']\s*\)/);
    }
    assert.doesNotMatch(panel, /rpcTeamTournamentRename/);
    assert.match(service, /updateTournamentCommand/);
    assert.doesNotMatch(service, /rpcTeamTournamentRename/);
  });

  it("7 successful rename updates the rendered name from the returned tournament", () => {
    const panel = readSrc("src/components/tournament/team/TeamFormatVenueSetupPanel.jsx");
    const saveName = sliceFn(
      panel,
      "async function handleSaveName()",
      "async function handleSave()"
    );
    assert.match(saveName, /result\.tournament\?\.name/);
    assert.match(saveName, /setNameDraft\(savedName\)/);
    assert.match(saveName, /onMessage\?\.\("Đã lưu tên giải\."\)/);
    const setup = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
    assert.match(setup, /renameTournamentFn=\{saveTournamentDisplayName\}/);
    assert.match(
      sliceFn(setup, "async function saveTournamentDisplayName", "async function handleSaveDraft"),
      /reload\(\{ silent: true \}\)/
    );
  });

  it("8 repository name patch uses team_tournament_rename once for Team Tournament", async () => {
    const calls = [];
    let currentName = CURRENT_NAME;
    const row = {
      id: TOURNAMENT_ID,
      tenant_id: TENANT_ID,
      club_id: CLUB_ID,
      name: currentName,
      mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
      status: "draft",
      payload: { id: TOURNAMENT_ID, mode: TOURNAMENT_MODE.TEAM_TOURNAMENT },
      engine_v4: {},
    };
    const repo = createCloudTournamentRepository({
      rpc: async (name, args) => {
        calls.push({ name, args });
        if (name === "canonical_tournament_get") {
          return { ok: true, tournament: { ...row, name: currentName } };
        }
        if (name === "team_tournament_rename") {
          currentName = String(args.p_name);
          return {
            ok: true,
            data: { canonicalName: currentName, headerName: currentName },
          };
        }
        if (name === "canonical_tournament_update") {
          return {
            ok: true,
            tournament: { ...row, name: currentName, payload: row.payload },
          };
        }
        return { ok: false, code: "UNKNOWN_RPC", error: name };
      },
    });

    const result = await repo.update(
      { id: CLUB_ID, tenantId: TENANT_ID },
      TOURNAMENT_ID,
      { name: "Tên mới" },
      { tenantId: TENANT_ID }
    );
    assert.equal(result.ok, true, result.error);
    assert.equal(result.tournament.name, "Tên mới");
    const renameCalls = calls.filter((item) => item.name === "team_tournament_rename");
    assert.equal(renameCalls.length, 1);
    assert.equal(renameCalls[0].args.p_tournament_id, TOURNAMENT_ID);
    assert.equal(renameCalls[0].args.p_name, "Tên mới");
    const updateCalls = calls.filter((item) => item.name === "canonical_tournament_update");
    assert.equal(updateCalls.length, 1);
    assert.equal(
      Object.prototype.hasOwnProperty.call(updateCalls[0].args.p_patch, "name"),
      false
    );
  });

  it("9 Format & Venue config save remains independent from rename", () => {
    const panel = readSrc("src/components/tournament/team/TeamFormatVenueSetupPanel.jsx");
    const saveName = sliceFn(
      panel,
      "async function handleSaveName()",
      "async function handleSave()"
    );
    const saveFormat = sliceFn(panel, "async function handleSave()", "return (");
    assert.doesNotMatch(saveName, /onSave/);
    assert.doesNotMatch(saveName, /mergeFormatVenueIntoSettings|persistFormatVenueSetup/);
    assert.doesNotMatch(saveFormat, /renameTournamentFn|handleSaveName|nameDraft/);
    assert.match(saveFormat, /onSave\?\.\(config\)/);
  });

  it("sanitize strips SQL/Supabase leakage from rename errors", () => {
    assert.equal(
      sanitizeTeamTournamentRenameError({
        ok: false,
        error: 'relation "canonical_tournaments" does not exist SQLSTATE 42P01',
      }),
      TEAM_TOURNAMENT_RENAME_GENERIC_ERROR
    );
    assert.equal(
      sanitizeTeamTournamentRenameError({
        ok: false,
        error: "Bạn không có quyền đổi tên giải.",
      }),
      "Bạn không có quyền đổi tên giải."
    );
  });
});
