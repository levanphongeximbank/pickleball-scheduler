import CourtCalendarShell from "./calendar/CourtCalendarShell.jsx";

/** @deprecated Use CourtCalendarShell — kept for backward compatibility */
export default function CourtCalendarMonthView(props) {
  return <CourtCalendarShell {...props} initialView="month" />;
}
