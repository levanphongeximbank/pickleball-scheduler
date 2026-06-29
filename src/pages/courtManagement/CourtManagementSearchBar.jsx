import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Box,
  Button,
  Card,
  CardContent,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { loadCustomersForClub } from "../../domain/clubStorage.js";
import { searchCourtManagementData } from "../../domain/courtManagementSearch.js";

export default function CourtManagementSearchBar({ clubId, bookings = [] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const customers = useMemo(() => loadCustomersForClub(clubId), [clubId, bookings]);

  const results = useMemo(() => {
    if (!query.trim()) {
      return { bookings: [], customers: [] };
    }

    return searchCourtManagementData(bookings, customers, query);
  }, [bookings, customers, query]);

  const hasResults = results.bookings.length > 0 || results.customers.length > 0;

  const goToBookings = () => {
    navigate(`/court-management/bookings?q=${encodeURIComponent(query.trim())}`);
    setQuery("");
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <TextField
            label="Tìm booking / khách / mã / SĐT"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            fullWidth
            size="small"
          />

          {query.trim() && (
            <Box>
              {!hasResults ? (
                <Typography variant="body2" color="text.secondary">
                  Không tìm thấy kết quả.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {results.bookings.map((booking) => (
                    <ListItemButton key={booking.id} onClick={goToBookings}>
                      <ListItemText
                        primary={`${booking.customerName} · ${booking.courtName}`}
                        secondary={`${booking.date} ${booking.startTime} · ${booking.bookingCode}`}
                      />
                    </ListItemButton>
                  ))}
                  {results.customers.map((customer) => (
                    <ListItemButton
                      key={customer.id}
                      onClick={() => {
                        navigate(
                          `/court-management/customers?q=${encodeURIComponent(customer.name)}`
                        );
                        setQuery("");
                      }}
                    >
                      <ListItemText
                        primary={customer.name}
                        secondary={customer.phone || "Chưa có SĐT"}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}

              {results.bookings.length > 0 && (
                <Button size="small" onClick={goToBookings} sx={{ mt: 1 }}>
                  Xem tất cả booking khớp
                </Button>
              )}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
