import CoachingEntityPage from "./CoachingEntityPage.jsx";
import { deleteClass, listClasses, saveClass } from "../../features/coaching/index.js";

export default function ClassesPage() {
  return (
    <CoachingEntityPage
      title="Lớp học"
      description="Nhóm lớp, cấp độ và HLV phụ trách."
      listFn={listClasses}
      saveFn={saveClass}
      deleteFn={deleteClass}
      columns={[
        { key: "name", label: "Tên lớp" },
        { key: "level", label: "Cấp độ" },
        { key: "coachName", label: "HLV" },
        { key: "capacity", label: "Sĩ số tối đa" },
      ]}
      fields={[
        { key: "name", label: "Tên lớp", required: true },
        { key: "level", label: "Cấp độ" },
        { key: "coachName", label: "HLV phụ trách" },
        { key: "capacity", label: "Sĩ số tối đa", type: "number" },
        { key: "scheduleNote", label: "Lịch học (mô tả)", multiline: true },
      ]}
    />
  );
}
