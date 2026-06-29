import { useCallback, useState } from "react";

export function usePresentationMode() {
  const [presentationMode, setPresentationMode] = useState(false);
  const togglePresentationMode = useCallback(() => {
    setPresentationMode((value) => !value);
  }, []);

  return { presentationMode, togglePresentationMode, setPresentationMode };
}
