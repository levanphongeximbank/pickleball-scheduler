export const DEMO_PLAYER_COUNT = 60;

const HO = [
  "Nguyễn",
  "Trần",
  "Lê",
  "Phạm",
  "Hoàng",
  "Huỳnh",
  "Phan",
  "Vũ",
  "Võ",
  "Đặng",
  "Bùi",
  "Đỗ",
  "Hồ",
  "Ngô",
  "Dương",
  "Lý",
];

const TEN_NAM = [
  "An",
  "Bình",
  "Cường",
  "Dũng",
  "Hải",
  "Hùng",
  "Khánh",
  "Long",
  "Minh",
  "Nam",
  "Phong",
  "Quân",
  "Sơn",
  "Thành",
  "Tuấn",
  "Việt",
  "Đạt",
  "Huy",
  "Khoa",
  "Tài",
];

const TEN_NU = [
  "An",
  "Chi",
  "Dung",
  "Giang",
  "Hà",
  "Hương",
  "Lan",
  "Linh",
  "Mai",
  "My",
  "Ngọc",
  "Nhi",
  "Phương",
  "Quỳnh",
  "Thảo",
  "Trang",
  "Uyên",
  "Vy",
  "Yến",
  "Hạnh",
];

const LEVELS = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5];

function buildDemoPlayers(count = DEMO_PLAYER_COUNT) {
  const players = [];

  for (let index = 0; index < count; index += 1) {
    const gender = index % 3 === 0 ? "Nữ" : "Nam";
    const ho = HO[index % HO.length];
    const tenList = gender === "Nữ" ? TEN_NU : TEN_NAM;
    const ten = tenList[Math.floor(index / HO.length) % tenList.length];
    const level = LEVELS[index % LEVELS.length];
    const suffix = index >= HO.length * TEN_NAM.length ? ` ${index + 1}` : "";

    players.push({
      id: index + 1,
      name: `${ho} ${ten}${suffix}`.trim(),
      level,
      gender,
      phone: `09${String(10000000 + index).slice(-8)}`,
      active: true,
    });
  }

  return players;
}

const samplePlayers = buildDemoPlayers();

export { buildDemoPlayers };
export default samplePlayers;
