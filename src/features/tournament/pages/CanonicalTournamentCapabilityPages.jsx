import { useSearchParams } from "react-router-dom";

import CanonicalTournamentPicker from "../components/CanonicalTournamentPicker.jsx";
import {
  TOURNAMENT_ROUTES,
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
import {
  resolveOrganizeDestination,
  resolveResultsDestination,
} from "./canonicalTournamentHubDestinations.js";

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
  const [searchParams] = useSearchParams();
  const intent = searchParams.get("intent") || "";
  return (
    <CanonicalTournamentPicker
      title="Tổ chức & điều hành"
      description="Chọn giải để mở Engine 4.0, hạt giống hoặc Director Mode."
      filter={(tournament) =>
        isEngineTournament(tournament) ||
        isDirectorTournament(tournament) ||
        isTeamTournament(tournament) ||
        isSchedulableTournament(tournament)
      }
      resolvePath={(tournament) => resolveOrganizeDestination(tournament, intent)}
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
      description="Chọn giải để xem xếp hạng Engine hoặc bảng đồng đội."
      filter={(tournament) =>
        isEngineTournament(tournament) ||
        isTeamTournament(tournament) ||
        isIndividualTournament(tournament)
      }
      resolvePath={(tournament) => resolveResultsDestination(tournament)}
      emptyHint="Chưa có giải để xem kết quả."
    />
  );
}
