const DOC_EL = typeof document !== "undefined" ? document.documentElement : null;

function getFullscreenElement() {
  if (typeof document === "undefined") {
    return null;
  }

  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

export function isAppFullscreen() {
  return Boolean(getFullscreenElement());
}

export async function requestAppFullscreen(target = DOC_EL) {
  if (!target) {
    return { ok: false, reason: "no-document" };
  }

  if (isAppFullscreen()) {
    return { ok: true };
  }

  const request =
    target.requestFullscreen?.bind(target) ||
    target.webkitRequestFullscreen?.bind(target) ||
    target.mozRequestFullScreen?.bind(target) ||
    target.msRequestFullscreen?.bind(target);

  if (!request) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    await request();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.message || "denied" };
  }
}

export async function exitAppFullscreen() {
  if (typeof document === "undefined" || !isAppFullscreen()) {
    return { ok: true };
  }

  const exit =
    document.exitFullscreen?.bind(document) ||
    document.webkitExitFullscreen?.bind(document) ||
    document.mozCancelFullScreen?.bind(document) ||
    document.msExitFullscreen?.bind(document);

  if (!exit) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    await exit();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.message || "failed" };
  }
}

export function subscribeFullscreenChange(listener) {
  if (typeof document === "undefined") {
    return () => {};
  }

  const events = [
    "fullscreenchange",
    "webkitfullscreenchange",
    "mozfullscreenchange",
    "MSFullscreenChange",
  ];

  events.forEach((eventName) => document.addEventListener(eventName, listener));
  return () => {
    events.forEach((eventName) => document.removeEventListener(eventName, listener));
  };
}
