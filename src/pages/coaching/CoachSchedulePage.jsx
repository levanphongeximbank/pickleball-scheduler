import CoachingEntityPage from "./CoachingEntityPage.jsx";
import { deleteScheduleEntry, listSchedule, saveScheduleEntry } from "../../features/coaching/index.js";

export default function CoachSchedulePage() {
  return (
    <CoachingEntityPage
      title="Lịch huấn luyện"
      description="Ca dạy theo ngày, sân và lớp."
      listFn={listSchedule}
      saveFn={saveScheduleEntry}
      deleteFn={deleteScheduleEntry}
      columns={[
        { key: "date", label: "Ngày" },
        { key: "startTime", label: "Bắt đầu" },
        { key: "endTime", label: "Kết thúc" },
        { key: "className", label: "Lớp" },
        { key: "coachName", label: "HLV" },
        { key: "courtName", label: "Sân" },
      ]}
      fields={[
        { key: "date", label: "Ngày (YYYY-MM-DD)", required: true },
        { key: "startTime", label: "Giờ bắt đầu (HH:mm)", required: true },
        { key: "endTime", label: "Giờ kết thúc (HH:mm)", required: true },
        { key: "className", label: "Lớp" },
        { key: "coachName", label: "HLV" },
        { key: "courtName", label: "Sân" },
        { key: "notes", label: "Ghi chú", multiline: true },
      ]}
    />
  );
}
