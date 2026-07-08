import CourtCalendarShell from "./calendar/CourtCalendarShell.jsx";

/** @deprecated Use CourtCalendarShell — kept for backward compatibility */
export default function CourtCalendarWeekView(props) {
  return <CourtCalendarShell {...props} initialView="week" />;
}
