import { useCallback, useEffect, useState } from "react";

import {
  exitAppFullscreen,
  isAppFullscreen,
  requestAppFullscreen,
  subscribeFullscreenChange,
} from "./browserFullscreen.js";

export function useBrowserFullscreen() {
  const [active, setActive] = useState(() => isAppFullscreen());

  useEffect(() => subscribeFullscreenChange(() => setActive(isAppFullscreen())), []);

  const enter = useCallback(async (target) => {
    const result = await requestAppFullscreen(target);
    setActive(isAppFullscreen());
    return result;
  }, []);

  const exit = useCallback(async () => {
    const result = await exitAppFullscreen();
    setActive(isAppFullscreen());
    return result;
  }, []);

  return { active, enter, exit };
}
