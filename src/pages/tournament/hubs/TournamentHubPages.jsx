import TournamentPickerHub from "./TournamentPickerHub.jsx";
import {
  TOURNAMENT_ROUTES,
  directorPath,
  engineTabPath,
  isDirectorTournament,
  isEngineTournament,
  isRegisterableTournament,
  isSchedulableTournament,
  isTeamTournament,
  teamTournamentPath,
  TEAM_TAB_QUERY,
} from "../../../config/tournamentRoutes.js";
import { getTournamentSetupPath } from "../../../utils/tournamentNavigation.js";

export function TournamentRegisterHub() {
  return (
    <TournamentPickerHub
      title="Đăng ký VĐV"
      description="Chọn giải để mở màn hình đăng ký vận động viên / cặp đấu."
      filter={isRegisterableTournament}
      resolvePath={(tournament) => getTournamentSetupPath(tournament)}
      emptyHint="Chưa có giải ở trạng thái Nháp / Đăng ký / Sẵn sàng."
    />
  );
}

export function TournamentTeamsHub() {
  return (
    <TournamentPickerHub
      title="Danh sách đội"
      description="Chọn giải đồng đội để quản lý danh sách đội và roster."
      filter={isTeamTournament}
      resolvePath={(tournament) => teamTournamentPath(tournament.id, TEAM_TAB_QUERY.teams)}
      emptyHint="Chưa có giải đồng đội. Tạo giải từ Loại giải → Đồng đội."
    />
  );
}

export function TournamentTeamPresetsHub() {
  return (
    <TournamentPickerHub
      title="Đội có sẵn"
      description="Mở giải đồng đội để xem và tái sử dụng đội đã có trong hệ thống."
      filter={isTeamTournament}
      resolvePath={(tournament) => teamTournamentPath(tournament.id, TEAM_TAB_QUERY.teams)}
      emptyHint="Chưa có giải đồng đội để quản lý đội có sẵn."
    />
  );
}

export function TournamentTeamBuildManualHub() {
  return (
    <TournamentPickerHub
      title="Chia đội thủ công"
      description="Chọn giải đồng đội để ghép trận / đội hình thủ công."
      filter={isTeamTournament}
      resolvePath={(tournament) => teamTournamentPath(tournament.id, TEAM_TAB_QUERY.matchups)}
    />
  );
}

export function TournamentTeamBuildRandomHub() {
  return (
    <TournamentPickerHub
      title="Bốc thăm tự động"
      description="Chọn giải đồng đội để bốc thăm cặp đấu tự động."
      filter={isTeamTournament}
      resolvePath={(tournament) =>
        `${teamTournamentPath(tournament.id, TEAM_TAB_QUERY.matchups)}&random=1`
      }
    />
  );
}

export function TournamentTeamBuildDraftHub() {
  return (
    <TournamentPickerHub
      title="Draft đội"
      description="Chọn giải đồng đội để draft / chọn đội hình theo lượt."
      filter={isTeamTournament}
      resolvePath={(tournament) =>
        `${teamTournamentPath(tournament.id, TEAM_TAB_QUERY.matchups)}&draft=1`
      }
    />
  );
}

export function TournamentTeamEligibilityHub() {
  return (
    <TournamentPickerHub
      title="Kiểm tra điều kiện tham gia"
      description="Chọn giải đồng đội để đối chiếu roster với quy tắc tuổi, giới tính và trình độ."
      filter={isTeamTournament}
      resolvePath={(tournament) =>
        `/tournament/eligibility/check?tournamentId=${encodeURIComponent(tournament.id)}`
      }
      emptyHint="Chưa có giải đồng đội. Tạo giải từ Loại giải → Đồng đội."
    />
  );
}

export function TournamentScheduleHub() {
  return (
    <TournamentPickerHub
      title="Lịch thi đấu"
      description="Chọn giải để mở lịch thi đấu (Tournament Engine)."
      filter={isSchedulableTournament}
      resolvePath={(tournament) =>
        isEngineTournament(tournament)
          ? engineTabPath(tournament.id, "schedule")
          : TOURNAMENT_ROUTES.director
      }
    />
  );
}

export function TournamentMatchReportsHub() {
  return (
    <TournamentPickerHub
      title="Biên bản trận đấu"
      description="Chọn giải để xem nhật ký / log vận hành trận đấu."
      filter={isEngineTournament}
      resolvePath={(tournament) => engineTabPath(tournament.id, "logs")}
      emptyHint="Chưa có giải nội bộ/chính thức để xem biên bản."
    />
  );
}

export function TournamentConfigFormatHub() {
  return (
    <TournamentPickerHub
      title="Thể thức thi đấu"
      description="Chọn giải để cấu hình thể thức trong Tournament Engine."
      filter={isEngineTournament}
      resolvePath={(tournament) => engineTabPath(tournament.id, "setup")}
    />
  );
}

export function TournamentConfigSettingsHub() {
  return (
    <TournamentPickerHub
      title="Cài đặt giải"
      description="Chọn giải để mở màn hình setup chi tiết."
      filter={(tournament) => Boolean(tournament?.id)}
      resolvePath={(tournament) => getTournamentSetupPath(tournament)}
    />
  );
}

export function TournamentDirectorHub() {
  return (
    <TournamentPickerHub
      title="Điều phối giải (Director)"
      description="Chọn giải đang diễn ra để vào Director Mode."
      filter={isDirectorTournament}
      resolvePath={(tournament) => directorPath(tournament.id)}
      emptyHint="Chưa có giải active phù hợp. Dùng Điều phối sân (/court-engine) cho xếp sân CLB."
    />
  );
}

export function TournamentScoreboardHub() {
  return (
    <TournamentPickerHub
      title="Bảng điểm"
      description="Chọn giải để xem bảng điểm / xếp hạng trong Engine."
      filter={isEngineTournament}
      resolvePath={(tournament) => engineTabPath(tournament.id, "ranking")}
    />
  );
}
