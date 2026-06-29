export const SESSION_TEMPLATES = [
  {
    id: "friendly-review",
    label: "Giao luu (Review)",
    description: "1 phuong an tot nhat va xem truoc truoc khi ap dung.",
    mode: "review",
    topCandidates: 3,
    autoSelectAllCourts: false,
  },
  {
    id: "training-compare",
    label: "Tap luyen (So sanh)",
    description: "Tao nhieu phuong an de so sanh do can bang.",
    mode: "review",
    topCandidates: 5,
    autoSelectAllCourts: true,
  },
  {
    id: "quick-auto",
    label: "Nhanh (Auto-apply)",
    description: "Xep nhanh va ap dung ngay, bo qua man hinh preview.",
    mode: "auto",
    topCandidates: 2,
    autoSelectAllCourts: false,
  },
  {
    id: "tournament-premium",
    label: "Giai dau (Premium)",
    description: "Tao nhieu lua chon hon, uu tien score tong.",
    mode: "review",
    topCandidates: 6,
    autoSelectAllCourts: true,
  },
];

export function getTemplateById(templateId) {
  return SESSION_TEMPLATES.find((template) => template.id === templateId) || SESSION_TEMPLATES[0];
}
