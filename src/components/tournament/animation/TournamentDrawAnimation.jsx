import TournamentDrawBoard from "./TournamentDrawBoard.jsx";

export default function TournamentDrawAnimation(props) {
  return (
    <TournamentDrawBoard
      drawType="random"
      title="Bốc thăm chia bảng"
      subtitle="Professional Draw Board — kết quả random từ engine"
      {...props}
    />
  );
}
