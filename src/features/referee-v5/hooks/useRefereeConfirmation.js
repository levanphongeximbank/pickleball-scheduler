import { useState } from "react";

export function useRefereeConfirmation() {
  const [pending, setPending] = useState(null);

  const requestConfirm = (options, action) => {
    setPending({ ...options, action });
  };

  const dialogProps = pending
    ? {
        open: true,
        title: pending.title,
        message: pending.message,
        confirmLabel: pending.confirmLabel,
        onConfirm: () => {
          pending.action?.();
          setPending(null);
        },
        onCancel: () => setPending(null),
      }
    : { open: false };

  return { requestConfirm, dialogProps };
}
