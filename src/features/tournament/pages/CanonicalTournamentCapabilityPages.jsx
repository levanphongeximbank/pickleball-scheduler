import CanonicalTournamentPicker from "../components/CanonicalTournamentPicker.jsx";
import {
  TOURNAMENT_ROUTES,
  directorPath,
  engineTabPath,
  individualPlayerRegistrationPath,
  isDirectorTournament,
  isEngineTournament,
  isIndividualTournament,
  isRegisterableTournament,
  isSchedulableTournament,
  isTeamTournament,
  teamTournamentPath,
  TEAM_TAB_QUERY,
} from "../../../config/tournamentRoutes.js";
import { getTournamentSetupPath } from "../../../utils/tournamentNavigation.js";

export function CanonicalTournamentRegisterPage() {
  return (
    <CanonicalTournamentPicker
      title="Đăng ký"
      description="Chọn giải cá nhân để VĐV đăng ký. BTC duyệt trên màn hình setup giải."
      filter={(tournament) =>
        isIndividualTournament(tournament) && isRegisterableTournament(tournament)
      }
      resolvePath={(tournament) => individualPlayerRegistrationPath(tournament.id)}
      emptyHint="Chưa có giải cá nhân ở trạng thái Nháp / Đang đăng ký."
    />
  );
}

export function CanonicalTournamentRosterPage() {
  return (
    <CanonicalTournamentPicker
      title="VĐV / Đội"
      description="Chọn giải để quản lý danh sách vận động viên hoặc đội."
      filter={(tournament) =>
        isTeamTournament(tournament) || isIndividualTournament(tournament)
      }
      resolvePath={(tournament) =>
        isTeamTournament(tournament)
          ? teamTournamentPath(tournament.id, TEAM_TAB_QUERY.teams)
          : individualPlayerRegistrationPath(tournament.id)
      }
      emptyHint="Chưa có giải phù hợp. Tạo giải từ mục Tạo giải."
    />
  );
}

export function CanonicalTournamentOrganizePage() {
  return (
    <CanonicalTournamentPicker
      title="Tổ chức & điều hành"
      description="Chọn giải để mở setup, Engine 4.0 hoặc điều hành sân."
      filter={(tournament) =>
        isEngineTournament(tournament) ||
        isDirectorTournament(tournament) ||
        isTeamTournament(tournament) ||
        isSchedulableTournament(tournament)
      }
      resolvePath={(tournament) => {
        if (isTeamTournament(tournament)) {
          return teamTournamentPath(tournament.id, TEAM_TAB_QUERY.matchups);
        }
        if (isEngineTournament(tournament)) {
          return engineTabPath(tournament.id, "engine");
        }
        if (isDirectorTournament(tournament)) {
          return directorPath(tournament.id);
        }
        return getTournamentSetupPath(tournament);
      }}
      emptyHint="Chưa có giải để tổ chức."
    />
  );
}

export function CanonicalTournamentOperationsPage() {
  return (
    <CanonicalTournamentPicker
      title="Vận hành giải"
      description="Chọn giải để phân công trọng tài, xuất bản lịch hoặc xử lý rút lui."
      filter={(tournament) =>
        isIndividualTournament(tournament) || isTeamTournament(tournament)
      }
      resolvePath={(tournament) =>
        isTeamTournament(tournament)
          ? teamTournamentPath(tournament.id, TEAM_TAB_QUERY.standings)
          : TOURNAMENT_ROUTES.refereeAssign
      }
      emptyHint="Chưa có giải để vận hành."
    />
  );
}

export function CanonicalTournamentResultsPage() {
  return (
    <CanonicalTournamentPicker
      title="Kết quả"
      description="Chọn giải để xem xếp hạng, kết quả và nhật ký vận hành."
      filter={(tournament) =>
        isEngineTournament(tournament) ||
        isTeamTournament(tournament) ||
        isIndividualTournament(tournament)
      }
      resolvePath={(tournament) => {
        if (isTeamTournament(tournament)) {
          return teamTournamentPath(tournament.id, TEAM_TAB_QUERY.standings);
        }
        if (isEngineTournament(tournament)) {
          return engineTabPath(tournament.id, "ranking");
        }
        return getTournamentSetupPath(tournament);
      }}
      emptyHint="Chưa có giải để xem kết quả."
    />
  );
}
