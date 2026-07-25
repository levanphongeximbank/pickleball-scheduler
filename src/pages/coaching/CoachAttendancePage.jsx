import CoachingEntityPage from "./CoachingEntityPage.jsx";

export default function CoachAttendancePage() {
  return (
    <CoachingEntityPage
      title="Điểm danh"
      description="Theo dõi có mặt / vắng theo buổi học."
      collection="attendance"
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
