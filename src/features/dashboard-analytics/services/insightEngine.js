/**
 * Rule-based operational insights — thay thế AI tạm thời (Sprint 8).
 */
export function generateOperationalInsights(payload, sections = {}) {
  const insights = [];
  const { summary, topCourts, peakHours, isMock } = payload;

  if (sections.courts !== false && topCourts?.length > 1) {
    const avgUtil =
      topCourts.reduce((sum, court) => sum + court.utilization, 0) / topCourts.length;
    const underused = topCourts.filter((court) => court.utilization < avgUtil * 0.65);

    underused.slice(0, 2).forEach((court) => {
      const gap = Math.round(avgUtil - court.utilization);
      insights.push({
        type: "court",
        severity: "warning",
        text: `${court.name} có tỷ lệ sử dụng thấp hơn trung bình ${gap}%.`,
        action: "Xem xét khuyến mãi hoặc điều chỉnh giá cho sân này.",
      });
    });

    const topCourt = topCourts.find((court) => court.isTopPerformer);
    if (topCourt) {
      insights.push({
        type: "court",
        severity: "success",
        text: `${topCourt.name} là sân hiệu quả nhất với ${topCourt.utilization}% công suất.`,
        action: "Duy trì lịch bảo trì định kỳ để giữ chất lượng sân.",
      });
    }
  }

  if (sections.peakHours !== false && peakHours?.busiest?.length) {
    const topSlot = peakHours.busiest[0];
    insights.push({
      type: "peak",
      severity: "info",
      text: `Khung giờ ${topSlot.label} đang là giờ cao điểm (${topSlot.severity}).`,
      action: "Gợi ý tăng giá hoặc bổ sung nhân viên trong khung giờ này.",
    });

    const quietSlot = peakHours.quietest?.[0];
    if (quietSlot) {
      insights.push({
        type: "promo",
        severity: "info",
        text: `Khung giờ ${quietSlot.label} còn nhiều slot trống.`,
        action: "Gợi ý khuyến mãi giờ thấp điểm để tăng lấp đầy.",
      });
    }
  }

  if (sections.revenue !== false && summary?.revenue?.trendPercent > 10) {
    insights.push({
      type: "revenue",
      severity: "success",
      text: `Doanh thu tăng ${summary.revenue.trendPercent}% so với kỳ trước.`,
      action: "Phân tích nguồn doanh thu để nhân rộng chiến lược hiệu quả.",
    });
  }

  if (sections.customers !== false && summary?.customers?.trendPercent > 5) {
    insights.push({
      type: "customer",
      severity: "success",
      text: `Khách hàng mới tăng ${summary.customers.trendPercent}% so với kỳ trước.`,
      action: "Tăng cường chăm sóc khách mới để cải thiện tỷ lệ quay lại.",
    });
  }

  if (sections.clubs !== false && summary?.clubs?.mostActive) {
    insights.push({
      type: "club",
      severity: "info",
      text: `${summary.clubs.mostActive} có hoạt động nổi bật trong kỳ đã chọn.`,
      action: "Hợp tác tổ chức giải nội bộ để giữ nhịp chơi.",
    });
  }

  if (peakHours?.busiestWeekday && peakHours?.quietestWeekday) {
    insights.push({
      type: "weekday",
      severity: "info",
      text: `${peakHours.busiestWeekday.weekday} là ngày doanh thu cao nhất, ${peakHours.quietestWeekday.weekday} thấp hơn.`,
      action: "Cân đối lịch giải đấu / event theo ngày trong tuần.",
    });
  }

  if (isMock) {
    insights.unshift({
      type: "demo",
      severity: "warning",
      text: "Đang hiển thị dữ liệu demo — chưa có đủ dữ liệu thật trong hệ thống.",
      action: "Thêm booking, người chơi và phiên xếp sân để xem số liệu thực tế.",
    });
  }

  return insights.slice(0, 8);
}
