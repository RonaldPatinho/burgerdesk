"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Chip, Feedback } from "@/components/ui";
import type { Category, CategoryId, Product } from "@/domain/models";
import { ProductCard } from "./ProductCard";
import styles from "./DesktopProductExplorer.module.css";

type CategoryFilter = "all" | CategoryId;

export interface DesktopProductExplorerProps {
  categories: readonly Category[];
  products: readonly Product[];
  title: string;
  subtitle: string;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .trim();
}

export function DesktopProductExplorer({
  categories,
  products,
  title,
  subtitle,
}: DesktopProductExplorerProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);

    return products.filter((product) => {
      if (category !== "all" && !product.categoryIds.includes(category)) {
        return false;
      }

      if (!normalizedSearch) return true;

      return normalizeSearch(
        `${product.name} ${product.summary} ${product.detailDescription ?? ""}`,
      ).includes(normalizedSearch);
    });
  }, [category, products, search]);

  return (
    <section className={styles.explorer} id="productos-menu" aria-labelledby="desktop-products-title">
      <div className={styles.headingRow}>
        <div className={styles.heading}>
          <h2 id="desktop-products-title">{title}</h2>
          <p>{subtitle}</p>
        </div>

        <div className={styles.searchField}>
          <label className={styles.searchLabel} htmlFor="buscar-productos-desktop">
            Buscar en el menú
          </label>
          <Search aria-hidden="true" />
          <input
            id="buscar-productos-desktop"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar en el menú..."
            autoComplete="off"
            aria-controls="desktop-product-results"
          />
        </div>
      </div>

      <div className={styles.filters} aria-label="Filtrar productos por categoría">
        <Chip selected={category === "all"} onClick={() => setCategory("all")}>
          Todos
        </Chip>
        {categories.map((item) => (
          <Chip
            key={item.id}
            selected={category === item.id}
            onClick={() => setCategory(item.id)}
          >
            {item.name}
          </Chip>
        ))}
        <span className={styles.count} role="status" aria-live="polite">
          {filteredProducts.length} productos
        </span>
      </div>

      <div id="desktop-product-results" className={styles.results}>
        {filteredProducts.length > 0 ? (
          <div className={styles.grid}>
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <Feedback
            variant="empty"
            title="No encontramos productos"
            description="Prueba otra búsqueda o selecciona una categoría diferente."
          />
        )}
      </div>
    </section>
  );
}
