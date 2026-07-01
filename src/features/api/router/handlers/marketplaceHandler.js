import { API_SCOPES } from "../../constants/apiScopes.js";
import { listProducts } from "../../../marketplace/services/marketplaceProductService.js";
import { listOrders, createOrder } from "../../../marketplace/services/marketplaceOrderService.js";

export const marketplaceRoutes = [
  {
    method: "GET",
    path: "/marketplace/products",
    scope: API_SCOPES.MARKETPLACE_READ,
    handler: (ctx) => ({
      items: listProducts({ tenantId: ctx.auth?.tenantId, activeOnly: true }),
    }),
  },
  {
    method: "GET",
    path: "/marketplace/orders",
    scope: API_SCOPES.MARKETPLACE_READ,
    handler: (ctx) => ({
      items: listOrders({ tenantId: ctx.auth?.tenantId }),
    }),
  },
  {
    method: "POST",
    path: "/marketplace/orders",
    scope: API_SCOPES.MARKETPLACE_WRITE,
    handler: async (ctx) => {
      const result = await createOrder({
        tenantId: ctx.auth?.tenantId,
        buyerUserId: ctx.body?.buyerUserId,
        productId: ctx.body?.productId,
        quantity: ctx.body?.quantity,
        provider: ctx.body?.provider,
      });
      if (!result.ok) {
        throw Object.assign(new Error(result.error), { statusCode: 400 });
      }
      return result;
    },
  },
];
