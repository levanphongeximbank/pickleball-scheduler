export default function StatusBadge({ label, tone = "default" }) {
  if (!label) {
    return null;
  }

  const className =
    tone === "active"
      ? "tournament-status-badge tournament-status-badge--active"
      : tone === "success"
        ? "tournament-status-badge tournament-status-badge--success"
        : "tournament-status-badge";

  return <span className={className}>{label}</span>;
}
