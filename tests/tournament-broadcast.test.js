import test from "node:test";
import assert from "node:assert/strict";

import {
  getActiveDestinations,
  isBroadcastConfigured,
  loadBroadcastConfig,
  saveBroadcastConfig,
} from "../src/features/tournament-broadcast/services/broadcastConfigStorage.js";

test("broadcast config — save and load per tournament", () => {
  const storage = {};
  const originalGetItem = global.localStorage?.getItem;
  const originalSetItem = global.localStorage?.setItem;

  global.localStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => {
      storage[key] = value;
    },
  };

  try {
    const config = {
      autoBroadcastOnFlow: true,
      saveLocalVod: true,
      destinations: {
        youtube: {
          enabled: true,
          rtmpUrl: "rtmp://a.rtmp.youtube.com/live2",
          streamKey: "secret-key",
        },
        facebook: { enabled: false, rtmpUrl: "", streamKey: "" },
      },
    };

    const saved = saveBroadcastConfig("tour-1", config);
    assert.equal(saved.ok, true);

    const loaded = loadBroadcastConfig("tour-1");
    assert.equal(loaded.autoBroadcastOnFlow, true);
    assert.equal(loaded.destinations.youtube.streamKey, "secret-key");
    assert.equal(isBroadcastConfigured(loaded), true);
    assert.equal(getActiveDestinations(loaded).length, 1);
  } finally {
    global.localStorage.getItem = originalGetItem;
    global.localStorage.setItem = originalSetItem;
  }
});

test("broadcast config — VOD cloud defaults", () => {
  const config = loadBroadcastConfig("missing");
  assert.equal(config.autoBroadcastOnFlow, true);
  assert.equal(config.saveCloudVod, true);
  assert.equal(config.saveLocalVod, false);
  assert.equal(isBroadcastConfigured(config), false);
});

test("broadcast config — inactive destinations ignored", () => {
  const config = loadBroadcastConfig("missing");
  assert.equal(isBroadcastConfigured(config), false);
  assert.equal(getActiveDestinations(config).length, 0);
});

test("broadcast VOD path — club and tournament folders", async () => {
  const { buildBroadcastVodPath } = await import(
    "../src/features/tournament-broadcast/services/broadcastVodService.js"
  );

  const path = buildBroadcastVodPath({
    clubId: "club-abc",
    tournamentId: "tour-123",
    timestamp: new Date("2026-07-06T10:00:00.000Z"),
  });

  assert.match(path, /^club-abc\/tour-123\/trinh-chieu-/);
  assert.ok(path.endsWith(".webm"));
});
