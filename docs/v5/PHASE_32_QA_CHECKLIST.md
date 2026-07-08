# Phase 32 — Court Cluster Location QA Checklist

**Mục tiêu:** Cụm sân do Super Admin / Kỹ thuật viên quản lý; chủ sân chỉ vận hành sân trên cụm được gán.

**Tiên quyết**

- [ ] `VITE_COURT_CLUSTERS_ENABLED=true`
- [ ] `VITE_RBAC_ENABLED=true`
- [ ] Phase 23 SQL đã apply (`court_clusters`, `user_cluster_assignments`)
- [ ] Phase 32 SQL đã apply (`address`, `google_maps_url`, RLS platform-only)
- [ ] Verify: `npm run verify:phase32-court-clusters-staging`

**Env local / Preview**

```env
VITE_COURT_CLUSTERS_ENABLED=true
VITE_RBAC_ENABLED=true
```

---

## A. Super Admin

| # | Bước | Kỳ vọng |
|---|------|---------|
| A1 | Menu **Quản trị → Cụm sân** | Vào được `/admin/court-clusters` |
| A2 | Chọn tổ chức (dropdown) | Danh sách cụm đổi theo tenant |
| A3 | **Thêm cụm sân** — tên, địa chỉ, link Google Maps | Tạo thành công |
| A4 | Nút **Chỉ đường** (icon) trên bảng | Mở tab Google Maps |
| A5 | **Sửa** cụm — đổi địa chỉ / link | Lưu OK |
| A6 | **Gán chủ sân** — chọn user + cụm | Assignment lưu local |
| A7 | Cột **Số sân** | Read-only; tăng khi chủ sân thêm sân |

## B. Kỹ thuật viên hệ thống

| # | Bước | Kỳ vọng |
|---|------|---------|
| B1 | Menu **Kỹ thuật hệ thống → Cụm sân** | Vào được, không cần menu Quản trị chủ sân |
| B2 | Tạo / sửa / xóa cụm | Giống Super Admin |
| B3 | Không có `cluster.manage` trên DB | Route 403 / menu ẩn |

## C. Chủ sân (VENUE_OWNER)

| # | Bước | Kỳ vọng |
|---|------|---------|
| C1 | Sidebar | **Không** có mục Cụm sân |
| C2 | Truy cập trực tiếp `/admin/court-clusters` | 403 hoặc cảnh báo không có quyền |
| C3 | Header **Cụm sân** (nếu ≥2 cụm được gán) | Thấy địa chỉ + nút Chỉ đường |
| C4 | Trang **Sân** | Banner cụm + Chỉ đường (nếu có link) |
| C5 | **Thêm sân** | Sân gắn `clusterId` active; số sân cụm tự tăng |

## D. Chủ sân chỉ 1 cụm được gán

| # | Bước | Kỳ vọng |
|---|------|---------|
| D1 | Switcher cụm | Ẩn (chỉ 1 cụm) hoặc chỉ thấy 1 cụm |
| D2 | Không thấy cụm khác trong org | Đúng scope assignment |

## E. Link Google Maps

| # | Input | Kỳ vọng |
|---|-------|---------|
| E1 | `https://www.google.com/maps/dir/?api=1&destination=...` | Hợp lệ |
| E2 | `javascript:alert(1)` | Từ chối khi lưu |
| E3 | Để trống link | Cho phép; nút Chỉ đường disabled |

---

## Rollback

```sql
-- Khôi phục RLS Phase 23 (nếu cần) — xem PHASE_23_COURT_CLUSTERS.sql
```

## Liên quan

- [`COURT_CLUSTER_SPEC.md`](./COURT_CLUSTER_SPEC.md)
- [`PHASE_32_COURT_CLUSTER_LOCATION.sql`](./PHASE_32_COURT_CLUSTER_LOCATION.sql)
- [`../RBAC-MATRIX.md`](../RBAC-MATRIX.md)
