import {
  createMarketplaceProduct,
  PRODUCT_STATUS,
} from "../models/marketplaceModels.js";
import {
  loadMarketplaceProducts,
  saveMarketplaceProducts,
} from "../storage/marketplaceStorage.js";

export function listProducts({ tenantId = null, activeOnly = true } = {}) {
  let products = loadMarketplaceProducts();
  if (activeOnly) {
    products = products.filter((p) => p.status === PRODUCT_STATUS.ACTIVE);
  }
  if (tenantId) {
    products = products.filter((p) => !p.tenantId || p.tenantId === tenantId);
  }
  return products;
}

export function getProduct(productId) {
  return loadMarketplaceProducts().find((p) => p.id === productId) || null;
}

export function createProduct(input = {}) {
  const name = String(input.name || "").trim();
  if (!name) {
    return { ok: false, error: "Tên sản phẩm không được để trống." };
  }
  const product = createMarketplaceProduct(input);
  const products = loadMarketplaceProducts();
  products.unshift(product);
  saveMarketplaceProducts(products);
  return { ok: true, product };
}

export function updateProduct(productId, patch = {}) {
  const products = loadMarketplaceProducts();
  const index = products.findIndex((p) => p.id === productId);
  if (index < 0) {
    return { ok: false, error: "Sản phẩm không tồn tại." };
  }
  products[index] = {
    ...products[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveMarketplaceProducts(products);
  return { ok: true, product: products[index] };
}

export function setProductStatus(productId, status) {
  return updateProduct(productId, { status });
}

export function seedDefaultProducts() {
  const existing = loadMarketplaceProducts();
  if (existing.length > 0) return existing;

  const defaults = [
    {
      name: "Gói tổ chức giải đấu",
      category: "tournament_package",
      price: 990000,
      billingType: "one_time",
      status: PRODUCT_STATUS.ACTIVE,
    },
    {
      name: "Gói quản lý CLB",
      category: "club_management",
      price: 490000,
      billingType: "monthly",
      status: PRODUCT_STATUS.ACTIVE,
    },
    {
      name: "Gói AI Tournament",
      category: "ai_tournament",
      price: 1490000,
      billingType: "monthly",
      status: PRODUCT_STATUS.ACTIVE,
    },
    {
      name: "Gói SMS/Zalo Notification",
      category: "notification_sms_zalo",
      price: 290000,
      billingType: "monthly",
      status: PRODUCT_STATUS.ACTIVE,
    },
  ];

  const products = defaults.map((item) => createMarketplaceProduct(item));
  saveMarketplaceProducts(products);
  return products;
}
