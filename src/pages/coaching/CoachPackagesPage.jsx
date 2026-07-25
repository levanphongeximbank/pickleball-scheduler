import CoachingEntityPage from "./CoachingEntityPage.jsx";

export default function CoachPackagesPage() {
  return (
    <CoachingEntityPage
      title="Gói học"
      description="Gói buổi, thời hạn và giá."
      collection="packages"
      columns={[
        { key: "name", label: "Tên gói" },
        { key: "sessions", label: "Số buổi" },
        { key: "durationDays", label: "Thời hạn (ngày)" },
        {
          key: "price",
          label: "Giá",
          render: (row) =>
            row.price ? `${Number(row.price).toLocaleString("vi-VN")} đ` : "—",
        },
      ]}
      fields={[
        { key: "name", label: "Tên gói", required: true },
        { key: "sessions", label: "Số buổi", type: "number" },
        { key: "durationDays", label: "Thời hạn (ngày)", type: "number" },
        { key: "price", label: "Giá (VND)", type: "number" },
        { key: "description", label: "Mô tả", multiline: true },
      ]}
    />
  );
}
