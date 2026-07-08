/** Mock data for Public Portal — structured for future API replacement. */

export const PUBLIC_STATS = [
  { label: "CLB", value: "120+", icon: "groups" },
  { label: "Sân pickleball", value: "680+", icon: "court" },
  { label: "Vận động viên", value: "15.000+", icon: "players" },
  { label: "Giải đấu", value: "560+", icon: "trophy" },
  { label: "Trận đấu", value: "210.000+", icon: "match" },
  { label: "Đánh giá trung bình", value: "4.8", icon: "star" },
];

export const MOCK_SCHEDULE = [
  { time: "08:00", court: "Sân 1", match: "Nguyễn A / Trần B vs Lê C / Phạm D", group: "Bảng A" },
  { time: "09:30", court: "Sân 2", match: "Hoàng E / Vũ F vs Bùi G / Đặng H", group: "Bảng B" },
  { time: "11:00", court: "Sân 3", match: "Smash Kings vs Dink Masters", group: "Bảng C" },
  { time: "14:00", court: "Sân 1", match: "Pickle Pro vs Net Ninjas", group: "Bảng D" },
];

export const MOCK_RESULTS = [
  { match: "Team Alpha vs Team Beta", score: "11 - 8, 11 - 6", winner: "Team Alpha" },
  { match: "Smash Club vs Green Court", score: "9 - 11, 11 - 7, 11 - 5", winner: "Green Court" },
  { match: "Hà Nội A vs Sài Gòn B", score: "11 - 4, 11 - 3", winner: "Hà Nội A" },
];

export const MOCK_UPCOMING_EVENTS = [
  { day: "15", month: "TH5", title: "VPT Open Hà Nội 2026", city: "Hà Nội" },
  { day: "22", month: "TH5", title: "Pickleball Phong trào TP.HCM", city: "TP.HCM" },
  { day: "01", month: "TH6", title: "VPL Team Challenge Đà Nẵng", city: "Đà Nẵng" },
  { day: "10", month: "TH6", title: "VPT Southern Series Cần Thơ", city: "Cần Thơ" },
];

export const ECOSYSTEM_ITEMS = [
  {
    id: "vpt",
    code: "VPT",
    title: "Vietnam Pickleball Tour",
    subtitle: "Hệ thống giải cá nhân nhiều chặng",
    description:
      "Chuỗi giải đấu cá nhân chuyên nghiệp trên khắp Việt Nam, tích lũy điểm xuyên suốt mùa giải.",
    color: "#10B981",
    path: "/tournaments?type=vpt",
  },
  {
    id: "vpl",
    code: "VPL",
    title: "Vietnam Pickleball League",
    subtitle: "Giải đồng đội / CLB",
    description:
      "Giải đấu theo đội và CLB, kết nối cộng đồng pickleball qua các trận đấu đồng đội hấp dẫn.",
    color: "#3B82F6",
    path: "/tournaments?type=vpl",
  },
  {
    id: "vpr",
    code: "VPR",
    title: "Vietnam Pickleball Ranking",
    subtitle: "Bảng xếp hạng quốc gia",
    description:
      "Hệ thống xếp hạng VPR cập nhật liên tục theo kết quả thi đấu chính thức trên toàn quốc.",
    color: "#F59E0B",
    path: "/rankings",
  },
  {
    id: "vpc",
    code: "VPC",
    title: "Vietnam Pickleball Championship",
    subtitle: "Giải vô địch cuối năm",
    description:
      "Sự kiện đỉnh cao quy tụ những VĐV và đội xuất sắc nhất để tranh ngôi vô địch quốc gia.",
    color: "#8B5CF6",
    path: "/tournaments?type=vpc",
  },
];

export const MOCK_TOURNAMENTS = [
  {
    id: "t1",
    name: "VPT Open Hà Nội 2026",
    type: "vpt",
    typeLabel: "VPT",
    status: "upcoming",
    statusLabel: "Sắp diễn ra",
    location: "Hà Nội",
    date: "15/03/2026",
    participants: 128,
    participantLabel: "VĐV",
    image: null,
  },
  {
    id: "t2",
    name: "VPL Team Challenge Đà Nẵng",
    type: "vpl",
    typeLabel: "VPL",
    status: "live",
    statusLabel: "Đang diễn ra",
    location: "Đà Nẵng",
    date: "01–05/03/2026",
    participants: 24,
    participantLabel: "đội",
    image: null,
  },
  {
    id: "t3",
    name: "Pickleball Phong trào TP.HCM",
    type: "community",
    typeLabel: "Phong trào",
    status: "live",
    statusLabel: "Đang diễn ra",
    location: "TP.HCM",
    date: "28/02/2026",
    participants: 64,
    participantLabel: "VĐV",
    image: null,
  },
  {
    id: "t4",
    name: "VPC Championship Finals 2025",
    type: "vpc",
    typeLabel: "VPC",
    status: "finished",
    statusLabel: "Đã kết thúc",
    location: "Nha Trang",
    date: "20/12/2025",
    participants: 32,
    participantLabel: "VĐV",
    image: null,
  },
  {
    id: "t5",
    name: "CLB Pickle Pro Internal Cup",
    type: "internal",
    typeLabel: "Nội bộ CLB",
    status: "upcoming",
    statusLabel: "Sắp diễn ra",
    location: "Hải Phòng",
    date: "22/03/2026",
    participants: 48,
    participantLabel: "VĐV",
    image: null,
  },
  {
    id: "t6",
    name: "VPT Southern Series — Cần Thơ",
    type: "vpt",
    typeLabel: "VPT",
    status: "upcoming",
    statusLabel: "Sắp diễn ra",
    location: "Cần Thơ",
    date: "10/04/2026",
    participants: 96,
    participantLabel: "VĐV",
    image: null,
  },
];

export const MOCK_LIVE_SCORES = [
  {
    id: "ls1",
    court: "Court 1",
    teamA: "Smash Kings",
    teamB: "Dink Masters",
    scoreA: 9,
    scoreB: 7,
    status: "LIVE",
  },
  {
    id: "ls2",
    court: "Court 2",
    teamA: "Pickle Pro A",
    teamB: "Net Ninjas",
    scoreA: 5,
    scoreB: 6,
    status: "LIVE",
  },
  {
    id: "ls3",
    court: "Court 3",
    teamA: "Green Aces",
    teamB: "Baseline Bros",
    scoreA: 11,
    scoreB: 8,
    status: "LIVE",
  },
];

export const MOCK_CLUBS = [
  {
    id: "c1",
    name: "CLB Pickle Pro Hà Nội",
    city: "Hà Nội",
    members: 186,
    tournaments: 24,
    logo: null,
    image: null,
  },
  {
    id: "c2",
    name: "Smash Club Đà Nẵng",
    city: "Đà Nẵng",
    members: 142,
    tournaments: 18,
    logo: null,
    image: null,
  },
  {
    id: "c3",
    name: "Dink Master Sài Gòn",
    city: "TP.HCM",
    members: 210,
    tournaments: 31,
    logo: null,
    image: null,
  },
  {
    id: "c4",
    name: "Green Court Nha Trang",
    city: "Nha Trang",
    members: 98,
    tournaments: 12,
    logo: null,
    image: null,
  },
  {
    id: "c5",
    name: "Baseline Bros Cần Thơ",
    city: "Cần Thơ",
    members: 76,
    tournaments: 9,
    logo: null,
    image: null,
  },
  {
    id: "c6",
    name: "Net Ninjas Hải Phòng",
    city: "Hải Phòng",
    members: 115,
    tournaments: 15,
    logo: null,
    image: null,
  },
];

export const MOCK_COURTS = [
  {
    id: "ct1",
    name: "Green Court Center",
    address: "123 Nguyễn Văn Cừ, Q.5, TP.HCM",
    courtCount: 8,
    openHours: "06:00 – 22:00",
    amenities: ["Đèn LED", "Nhà vệ sinh", "Căng tin", "Bãi xe"],
    image: null,
    rating: 4.8,
    pricePerHour: "120.000đ/giờ",
  },
  {
    id: "ct2",
    name: "Pickleball Arena Hà Nội",
    address: "45 Láng Hạ, Ba Đình, Hà Nội",
    courtCount: 12,
    openHours: "05:30 – 23:00",
    amenities: ["Pro shop", "Phòng thay đồ", "Huấn luyện viên"],
    image: null,
    rating: 4.9,
    pricePerHour: "150.000đ/giờ",
  },
  {
    id: "ct3",
    name: "Smash Zone Đà Nẵng",
    address: "78 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng",
    courtCount: 6,
    openHours: "06:00 – 21:00",
    amenities: ["Đèn LED", "Căng tin", "Wifi"],
    image: null,
    rating: 4.6,
    pricePerHour: "100.000đ/giờ",
  },
  {
    id: "ct4",
    name: "Dink Court Nha Trang",
    address: "12 Trần Phú, Nha Trang",
    courtCount: 4,
    openHours: "07:00 – 20:00",
    amenities: ["Đèn LED", "Bãi xe"],
    image: null,
    rating: 4.5,
    pricePerHour: "90.000đ/giờ",
  },
];

export const MOCK_NEWS = [
  {
    id: "n1",
    title: "VPT 2026 chính thức khởi động tại 5 thành phố",
    excerpt: "Chuỗi giải VPT mùa giải 2026 quy tụ hơn 2.000 VĐV trên khắp cả nước.",
    category: "Tin tức",
    date: "28/02/2026",
    type: "article",
    image: null,
  },
  {
    id: "n2",
    title: "Pickleball Việt Nam đạt 15.000 VĐV đăng ký trên PICK_VN",
    excerpt: "Cộng đồng pickleball Việt Nam tiếp tục tăng trưởng mạnh mẽ.",
    category: "Phong trào",
    date: "25/02/2026",
    type: "article",
    image: null,
  },
  {
    id: "n3",
    title: "Highlights: VPC Championship Finals 2025",
    excerpt: "Tổng hợp những khoảnh khắc đẹp nhất từ chung kết VPC 2025.",
    category: "Video",
    date: "20/12/2025",
    type: "video",
    image: null,
  },
  {
    id: "n4",
    title: "Hướng dẫn đăng ký giải đấu trên PICK_VN",
    excerpt: "Từng bước đăng ký tham gia giải đấu cho VĐV và ban tổ chức.",
    category: "Hướng dẫn",
    date: "15/02/2026",
    type: "article",
    image: null,
  },
];

export const MOCK_SPONSORS = [
  { id: "s1", name: "Pickle Gear VN", logo: null },
  { id: "s2", name: "Sport Court Pro", logo: null },
  { id: "s3", name: "Vietnam Sports Media", logo: null },
  { id: "s4", name: "Green Court Solutions", logo: null },
  { id: "s5", name: "Smash Equipment", logo: null },
  { id: "s6", name: "Dink Academy", logo: null },
];

export const MOCK_RANKINGS = [
  { rank: 1, name: "Nguyễn Văn An", region: "Hà Nội", points: 2450, change: 2 },
  { rank: 2, name: "Trần Thị Bình", region: "TP.HCM", points: 2380, change: -1 },
  { rank: 3, name: "Lê Hoàng Cường", region: "Đà Nẵng", points: 2310, change: 1 },
  { rank: 4, name: "Phạm Minh Đức", region: "Hà Nội", points: 2250, change: 0 },
  { rank: 5, name: "Hoàng Thị Em", region: "Cần Thơ", points: 2190, change: 3 },
  { rank: 6, name: "Vũ Quốc Huy", region: "TP.HCM", points: 2140, change: -2 },
  { rank: 7, name: "Đặng Lan Hương", region: "Hải Phòng", points: 2080, change: 1 },
  { rank: 8, name: "Bùi Văn Khánh", region: "Nha Trang", points: 2020, change: 0 },
  { rank: 9, name: "Ngô Thị Lan", region: "Hà Nội", points: 1980, change: 2 },
  { rank: 10, name: "Đinh Quốc Bảo", region: "Đà Nẵng", points: 1940, change: -1 },
];

export const RANKING_CATEGORIES = [
  { id: "men_single", label: "Nam đơn" },
  { id: "women_single", label: "Nữ đơn" },
  { id: "men_double", label: "Đôi nam" },
  { id: "women_double", label: "Đôi nữ" },
  { id: "mixed_double", label: "Đôi nam nữ" },
  { id: "team", label: "Đồng đội" },
];

export const VIETNAM_REGIONS = [
  "Tất cả",
  "Hà Nội",
  "TP.HCM",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "Nha Trang",
  "Huế",
  "Bình Dương",
];

export const TOURNAMENT_STATUS_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "upcoming", label: "Sắp diễn ra" },
  { id: "live", label: "Đang diễn ra" },
  { id: "finished", label: "Đã kết thúc" },
];

export const TOURNAMENT_TYPE_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "vpt", label: "VPT" },
  { id: "vpl", label: "VPL" },
  { id: "vpc", label: "VPC" },
  { id: "community", label: "Phong trào" },
  { id: "internal", label: "Nội bộ CLB" },
];
