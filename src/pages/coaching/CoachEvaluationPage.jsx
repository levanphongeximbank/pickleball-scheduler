import CoachingEntityPage from "./CoachingEntityPage.jsx";
import { deleteEvaluation, listEvaluations, saveEvaluation } from "../../features/coaching/index.js";

export default function CoachEvaluationPage() {
  return (
    <CoachingEntityPage
      title="Đánh giá học viên"
      description="Nhận xét kỹ thuật và tiến bộ."
      listFn={listEvaluations}
      saveFn={saveEvaluation}
      deleteFn={deleteEvaluation}
      columns={[
        { key: "date", label: "Ngày" },
        { key: "studentName", label: "Học viên" },
        { key: "coachName", label: "HLV" },
        { key: "rating", label: "Điểm" },
      ]}
      fields={[
        { key: "date", label: "Ngày (YYYY-MM-DD)", required: true },
        { key: "studentName", label: "Học viên", required: true },
        { key: "coachName", label: "HLV" },
        { key: "rating", label: "Điểm (1-10)", type: "number" },
        { key: "summary", label: "Nhận xét", multiline: true, required: true },
      ]}
    />
  );
}
