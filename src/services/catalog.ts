import { promotions, stores } from "../data/provisional";
import type {
  CatalogPlacement,
  Category,
  Product,
  ProductId,
  Promotion,
  StoreLocation,
} from "../domain/models";
import {
  getCatalogProduct,
  listCatalogCategories,
  listCatalogProducts,
  listFeaturedCatalogProducts,
} from "../server/catalog/repository";
import type { CatalogService, ProductQuery } from "./contracts";

export class MySqlCatalogService implements CatalogService {
  async listCategories(
    placement?: CatalogPlacement,
  ): Promise<readonly Category[]> {
    return listCatalogCategories(placement);
  }

  async listProducts(query: ProductQuery = {}): Promise<readonly Product[]> {
    return listCatalogProducts(query);
  }

  async getProduct(productId: ProductId): Promise<Product | null> {
    return getCatalogProduct(productId);
  }

  async listFeaturedProducts(): Promise<readonly Product[]> {
    return listFeaturedCatalogProducts();
  }

  async listPromotions(): Promise<readonly Promotion[]> {
    const currentProducts = await listCatalogProducts({ availableOnly: true });
    const availableProductIds = new Set(
      currentProducts.map((product) => product.id),
    );
    return promotions.filter((promotion) =>
      availableProductIds.has(promotion.productId),
    );
  }

  async listStores(): Promise<readonly StoreLocation[]> {
    return stores;
  }
}

export const catalogService = new MySqlCatalogService();
