import {
  categories,
  featuredProductIds,
  orders,
  products,
  promotions,
  provisionalClient,
  stores,
} from "../data/provisional";
import type {
  CatalogPlacement,
  Category,
  ClientProfile,
  ClientProfileStats,
  Order,
  Product,
  ProductId,
  Promotion,
  StoreLocation,
} from "../domain/models";
import { calculateOrderPricing } from "../domain/pricing";
import type {
  CatalogService,
  ClientService,
  OrderRepository,
  ProductQuery,
} from "./contracts";

const catalogCategories: readonly Category[] = categories;
const catalogProducts: readonly Product[] = products;

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .trim();
}

export class ProvisionalCatalogService implements CatalogService {
  async listCategories(
    placement?: CatalogPlacement,
  ): Promise<readonly Category[]> {
    return catalogCategories
      .filter(
        (category) =>
          category.active &&
          (!placement || category.placements.includes(placement)),
      )
      .slice()
      .sort((left, right) => left.order - right.order);
  }

  async listProducts(query: ProductQuery = {}): Promise<readonly Product[]> {
    const search = query.search ? normalizeSearch(query.search) : "";

    return catalogProducts.filter((product) => {
      if (query.availableOnly && !product.available) {
        return false;
      }

      if (query.categoryId && !product.categoryIds.includes(query.categoryId)) {
        return false;
      }

      if (search) {
        const searchableText = normalizeSearch(
          `${product.name} ${product.summary} ${product.detailDescription ?? ""}`,
        );

        if (!searchableText.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }

  async getProduct(productId: ProductId): Promise<Product | null> {
    return catalogProducts.find((product) => product.id === productId) ?? null;
  }

  async listFeaturedProducts(): Promise<readonly Product[]> {
    return featuredProductIds.flatMap((productId) => {
      const product = catalogProducts.find(
        (candidate) => candidate.id === productId,
      );
      return product ? [product] : [];
    });
  }

  async listPromotions(): Promise<readonly Promotion[]> {
    return promotions;
  }

  async listStores(): Promise<readonly StoreLocation[]> {
    return stores;
  }
}

export class ProvisionalClientReadService
  implements Pick<ClientService, "getProfile" | "getProfileStats">
{
  async getProfile(clientId: string): Promise<ClientProfile | null> {
    return clientId === provisionalClient.id ? provisionalClient : null;
  }

  async getProfileStats(clientId: string): Promise<ClientProfileStats | null> {
    if (clientId !== provisionalClient.id) {
      return null;
    }

    const recentOrdersTotalCop = orders
      .filter((order) => order.clientId === clientId)
      .reduce(
        (total, order) => total + calculateOrderPricing(order).totalCop,
        0,
      );

    return {
      reportedOrderCount: provisionalClient.reportedOrderCount,
      favoriteCount: provisionalClient.favoriteProductIds.length,
      recentOrdersTotalCop,
    };
  }
}

export class ProvisionalOrderRepository
  implements Pick<OrderRepository, "listByClient" | "getById">
{
  async listByClient(clientId: string): Promise<readonly Order[]> {
    return orders.filter((order) => order.clientId === clientId);
  }

  async getById(orderId: string): Promise<Order | null> {
    return orders.find((order) => order.id === orderId) ?? null;
  }
}

export const provisionalCatalogService = new ProvisionalCatalogService();
export const provisionalClientService = new ProvisionalClientReadService();
export const provisionalOrderRepository = new ProvisionalOrderRepository();
