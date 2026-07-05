import CoachingEntityPage from "./CoachingEntityPage.jsx";
import { deleteAttendance, listAttendance, saveAttendance } from "../../features/coaching/index.js";

export default function CoachAttendancePage() {
  return (
    <CoachingEntityPage
      title="Điểm danh"
      description="Theo dõi có mặt / vắng theo buổi học."
      listFn={listAttendance}
      saveFn={saveAttendance}
      deleteFn={deleteAttendance}
      columns={[
        { key: "date", label: "Ngày" },
        { key: "className", label: "Lớp" },
        { key: "studentName", label: "Học viên" },
        { key: "status", label: "Trạng thái" },
      ]}
      fields={[
        { key: "date", label: "Ngày (YYYY-MM-DD)", required: true },
        { key: "className", label: "Lớp", required: true },
        { key: "studentName", label: "Học viên", required: true },
        { key: "status", label: "Trạng thái (present/absent/late)" },
        { key: "notes", label: "Ghi chú", multiline: true },
      ]}
    />
  );
}
