import CoachingEntityPage from "./CoachingEntityPage.jsx";

export default function StudentsPage() {
  return (
    <CoachingEntityPage
      title="Học viên"
      description="Danh sách học viên và liên hệ phụ huynh."
      collection="students"
      columns={[
        { key: "name", label: "Tên" },
        { key: "level", label: "Trình độ" },
        { key: "phone", label: "Liên hệ" },
        { key: "packageName", label: "Gói học" },
      ]}
      fields={[
        { key: "name", label: "Tên học viên", required: true },
        { key: "level", label: "Trình độ" },
        { key: "phone", label: "SĐT phụ huynh" },
        { key: "packageName", label: "Gói học" },
        { key: "notes", label: "Ghi chú", multiline: true },
      ]}
    />
  );
}
