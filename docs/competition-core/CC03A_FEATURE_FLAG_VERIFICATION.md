# CC-03A-V — Feature Flag Verification

**Phase:** CC-03A-V | **Date:** 2026-07-12

---

## 1. Tên flag hiện tại vs canonical đề xuất

| | Tên |
|---|-----|
| **Canonical đề xuất (sau)** | `VITE_COMPETITION_CORE_RULES_V2_ENABLED` |
| **Implementation hiện tại** | `VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED` |
| **Helper** | `isConstraintsV2Enabled(envSource)` |
| **Key constant** | `COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2` |

**Quyết định CC-03A-V:** Không đổi tên trong phase này. Chuẩn hóa tên `RULES_V2` đề xuất ở CC-03B hoặc release note riêng.

---

## 2. Hành vi đã xác nhận

| # | Kiểm tra | Kết quả |
|---|----------|---------|
| 1 | Mặc định (env rỗng `{}`) | `false` ✅ |
| 2 | Missing key | `false` ✅ |
| 3 | Invalid value (`enabled`) | `false` ✅ |
| 4 | Sub-flag cần master `VITE_COMPETITION_CORE_ENABLED=true` | ✅ |
| 5 | Production env | **Không chỉnh** ✅ |
| 6 | Flag OFF → `evaluateCanonicalRules` feasible=true, enabled=false | ✅ |

---

## 3. Lưu ý parseEnvBoolean

`parseEnvBoolean("yes")` và `"on"` → **true** (thiết kế CC-01 `envReader.js`).

Chỉ `"true"`, `"1"`, `"yes"`, `"on"` được coi là bật; chuỗi khác (`enabled`, `maybe`) → false.

`readEnvBoolean(name, undefined)` fallback sang `import.meta.env` — test verification dùng `{}` explicit để tránh phụ thuộc môi trường Vite.

---

## 4. Production

| Environment | Flag state |
|-------------|------------|
| Production | **OFF** (không deploy, không đổi env) |
| Staging | OFF (default) |
| Local | OFF (default) |

---

## 5. Tests

- `tests/competition-core-feature-flags.test.js`
- `tests/competition-core-rules-engine-verification.test.js` (flag section)

**Verdict:** PASS — hành vi flag đúng spec CC-03A-V; tên alias deferred.
