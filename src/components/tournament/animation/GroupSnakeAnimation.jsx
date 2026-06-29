import TournamentDrawBoard from "./TournamentDrawBoard.jsx";

export default function GroupSnakeAnimation(props) {
  return (
    <TournamentDrawBoard
      drawType="snake"
      title="Chia bảng Snake"
      subtitle="Professional Draw Board — thứ tự snake từ engine"
      {...props}
    />
  );
}
