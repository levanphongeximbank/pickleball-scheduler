import test from "node:test";
import assert from "node:assert/strict";

import {
  exitAppFullscreen,
  isAppFullscreen,
  requestAppFullscreen,
} from "../src/components/tournament/animation/shared/browserFullscreen.js";

function createFullscreenDocument() {
  const listeners = new Map();
  let fullscreenElement = null;

  const document = {
    fullscreenElement: null,
    get webkitFullscreenElement() {
      return fullscreenElement;
    },
    addEventListener(name, handler) {
      if (!listeners.has(name)) {
        listeners.set(name, new Set());
      }
      listeners.get(name).add(handler);
    },
    removeEventListener(name, handler) {
      listeners.get(name)?.delete(handler);
    },
    exitFullscreen: async () => {
      fullscreenElement = null;
      document.fullscreenElement = null;
    },
  };

  const element = {
    requestFullscreen: async () => {
      fullscreenElement = element;
      document.fullscreenElement = element;
    },
  };

  return { document, element, listeners, getFullscreenElement: () => fullscreenElement };
}

test("browser fullscreen — request and exit", async () => {
  const env = createFullscreenDocument();
  const originalDocument = global.document;

  global.document = env.document;

  try {
    assert.equal(isAppFullscreen(), false);

    const enter = await requestAppFullscreen(env.element);
    assert.equal(enter.ok, true);
    assert.equal(isAppFullscreen(), true);

    const leave = await exitAppFullscreen();
    assert.equal(leave.ok, true);
    assert.equal(isAppFullscreen(), false);
  } finally {
    global.document = originalDocument;
  }
});

test("browser fullscreen — unsupported returns reason", async () => {
  const originalDocument = global.document;

  global.document = {
    fullscreenElement: null,
    webkitFullscreenElement: null,
    mozFullScreenElement: null,
    msFullscreenElement: null,
  };

  try {
    const result = await requestAppFullscreen({});
    assert.equal(result.ok, false);
    assert.equal(result.reason, "unsupported");
  } finally {
    global.document = originalDocument;
  }
});
