export function searchCourtManagementData(bookings = [], customers = [], query = "") {
  const keyword = query.trim().toLowerCase();

  if (!keyword) {
    return { bookings: [], customers: [] };
  }

  const bookingResults = bookings
    .filter((booking) => {
      return (
        booking.customerName?.toLowerCase().includes(keyword) ||
        booking.customerPhone?.includes(keyword) ||
        booking.bookingCode?.toLowerCase().includes(keyword) ||
        booking.courtName?.toLowerCase().includes(keyword)
      );
    })
    .slice(0, 8);

  const customerResults = customers
    .filter((customer) => {
      return (
        customer.name.toLowerCase().includes(keyword) ||
        (customer.phone && customer.phone.includes(keyword))
      );
    })
    .slice(0, 8);

  return {
    bookings: bookingResults,
    customers: customerResults,
  };
}
