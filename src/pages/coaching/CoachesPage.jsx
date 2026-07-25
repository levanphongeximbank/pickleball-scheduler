import CoachingEntityPage from "./CoachingEntityPage.jsx";

export default function CoachesPage() {
  return (
    <CoachingEntityPage
      title="Huấn luyện viên"
      description="Quản lý HLV và chuyên môn."
      collection="coaches"
      columns={[
        { key: "name", label: "Tên" },
        { key: "phone", label: "Điện thoại" },
        { key: "specialty", label: "Chuyên môn" },
        { key: "status", label: "Trạng thái" },
      ]}
      fields={[
        { key: "name", label: "Tên HLV", required: true },
        { key: "phone", label: "Điện thoại" },
        { key: "email", label: "Email" },
        { key: "specialty", label: "Chuyên môn" },
        { key: "status", label: "Trạng thái (active/inactive)" },
        { key: "notes", label: "Ghi chú", multiline: true },
      ]}
    />
  );
}
