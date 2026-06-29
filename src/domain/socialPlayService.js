export function socialPlayToBookingPayload(event, courtId, courtName) {
  return {
    bookingType: "social_play",
    courtId,
    courtName,
    customerName: event.title,
    customerType: "event",
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    totalAmount: event.feePerPlayer * event.maxPlayers,
    bookingStatus: "confirmed",
    note: `Social Play · tối đa ${event.maxPlayers} người · ${event.feePerPlayer.toLocaleString("vi-VN")} đ/người · ${event.note || ""}`.trim(),
  };
}

export function createSocialPlayEvent(input = {}) {
  return {
    id: input.id || `social-${Date.now()}`,
    title: input.title || "Social Play",
    date: input.date || "",
    startTime: input.startTime || "",
    endTime: input.endTime || "",
    courtIds: Array.isArray(input.courtIds) ? input.courtIds : [],
    maxPlayers: Number(input.maxPlayers) || 16,
    feePerPlayer: Number(input.feePerPlayer) || 0,
    status: input.status || "confirmed",
    note: input.note || "",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function createSocialPlayBookings(event, clubId, courts = [], createBookingFn) {
  const results = {
    ok: true,
    created: [],
    failed: [],
    message: "",
  };

  if (!event.courtIds.length) {
    return { ok: false, message: "Chọn ít nhất một sân.", created: [], failed: [] };
  }

  event.courtIds.forEach((courtId) => {
    const court = courts.find((item) => item.id === courtId);
    const payload = socialPlayToBookingPayload(
      event,
      courtId,
      court?.name || `Sân ${courtId}`
    );

    const result = createBookingFn(payload, clubId);

    if (result.ok) {
      results.created.push(result.booking);
      return;
    }

    results.failed.push({
      courtId,
      message: result.message,
    });
  });

  if (results.created.length === 0) {
    results.ok = false;
    results.message = results.failed[0]?.message || "Không tạo được booking Social Play.";
    return results;
  }

  results.message = `Đã khóa ${results.created.length} sân cho Social Play.`;
  if (results.failed.length > 0) {
    results.ok = false;
    results.message += ` ${results.failed.length} sân bị trùng lịch.`;
  }

  return results;
}
