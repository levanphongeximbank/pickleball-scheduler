export default function RefereeConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  onConfirm,
  onCancel,
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rv5-confirm-title"
      data-testid="referee-confirmation-dialog"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1300,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          maxWidth: 360,
          width: "100%",
        }}
      >
        <h2 id="rv5-confirm-title" style={{ margin: "0 0 8px", fontSize: "1rem" }}>
          {title}
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="rv5-btn rv5-btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rv5-btn rv5-btn-warning"
            onClick={onConfirm}
            data-testid="referee-confirm-action"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
