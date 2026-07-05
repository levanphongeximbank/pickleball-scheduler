import CoachingEntityPage from "./CoachingEntityPage.jsx";
import { deleteCoach, listCoaches, saveCoach } from "../../features/coaching/index.js";

export default function CoachesPage() {
  return (
    <CoachingEntityPage
      title="Huấn luyện viên"
      description="Quản lý HLV và chuyên môn."
      listFn={listCoaches}
      saveFn={saveCoach}
      deleteFn={deleteCoach}
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
