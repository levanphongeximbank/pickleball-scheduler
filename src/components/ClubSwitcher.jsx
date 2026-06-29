import {

  FormControl,

  InputLabel,

  MenuItem,

  Select,

  Stack,

} from "@mui/material";



import { useClub } from "../context/ClubContext.jsx";

import { useAuth } from "../context/AuthContext.jsx";



export default function ClubSwitcher({ size = "small", minWidth = 180 }) {

  const { clubs, activeClubId, switchClub } = useClub();

  const { rbacEnabled, isAuthenticated, canAccessClub } = useAuth();



  const visibleClubs =

    rbacEnabled && isAuthenticated

      ? clubs.filter((club) =>

          canAccessClub(club.id, { venueId: club.venueId || null })

        )

      : clubs;



  if (rbacEnabled && isAuthenticated && visibleClubs.length === 0) {

    return null;

  }



  const value = visibleClubs.some((club) => club.id === activeClubId)

    ? activeClubId

    : visibleClubs[0]?.id || activeClubId;



  return (

    <FormControl size={size} sx={{ minWidth }}>

      <InputLabel id="header-club-label">CLB</InputLabel>

      <Select

        labelId="header-club-label"

        value={value}

        label="CLB"

        onChange={(event) => switchClub(event.target.value)}

        sx={{

          bgcolor: "rgba(255,255,255,0.12)",

          color: "common.white",

          ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },

          ".MuiSvgIcon-root": { color: "common.white" },

        }}

      >

        {visibleClubs.map((club) => (

          <MenuItem key={club.id} value={club.id}>

            {club.name}

          </MenuItem>

        ))}

      </Select>

    </FormControl>

  );

}



export function ClubSwitcherRow() {

  return (

    <Stack direction="row" spacing={1} sx={{ ml: "auto", alignItems: "center" }}>

      <ClubSwitcher />

    </Stack>

  );

}

