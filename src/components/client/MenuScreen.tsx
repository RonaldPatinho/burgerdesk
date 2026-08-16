"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button, Chip, Feedback } from "@/components/ui";
import type { Category, CategoryId, Product, Promotion } from "@/domain/models";
import { ClientBottomNav } from "./ClientBottomNav";
import { ClientDesktopTopbar } from "./ClientDesktopTopbar";
import { DesktopProductExplorer } from "./DesktopProductExplorer";
import { DesktopOrderPanel } from "./DesktopOrderPanel";
import { MobileProductCarousel } from "./MobileProductCarousel";
import { ClientHeader } from "./ClientHeader";
import styles from "./MenuScreen.module.css";

type CategoryFilter = "all" | CategoryId;
export interface MenuScreenProps {
  categories: readonly Category[];
  initialProducts: readonly Product[];
  promotions: readonly Promotion[];
  initialCategory?: CategoryId | null;
}

const categoryLabels: Record<string, string> = {
  combos: "Combos",
  clasicas: "Clásicas",
  especiales: "Especiales",
  bebidas: "Bebidas",
  burgers: "Burgers",
  papas: "Papas",
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .trim();
}

export function MenuScreen({
  categories,
  initialProducts,
  initialCategory = null,
}: MenuScreenProps) {
  const resolvedInitialCategory: CategoryFilter =
    initialCategory &&
    initialProducts.some((product) => product.categoryIds.includes(initialCategory))
      ? initialCategory
      : "all";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>(resolvedInitialCategory);
  const normalizedSearch = normalizeSearch(search);
  const products = useMemo(
    () =>
      initialProducts.filter((product) => {
        if (category !== "all" && !product.categoryIds.includes(category)) {
          return false;
        }

        if (!normalizedSearch) return true;

        return normalizeSearch(
          `${product.name} ${product.summary} ${product.detailDescription ?? ""}`,
        ).includes(normalizedSearch);
      }),
    [category, initialProducts, normalizedSearch],
  );
  const categoryIsInDefaultFilters =
    category === "all" || categories.some((item) => item.id === category);
  const contextualCategoryLabel =
    category !== "all" && !categoryIsInDefaultFilters
      ? (categoryLabels[category] ?? category)
      : null;

  function resetFilters() {
    setSearch("");
    setCategory("all");
  }

  function selectCategory(nextCategory: CategoryFilter) {
    setCategory(nextCategory);
  }

  return (
    <div className={styles.page}>
      <ClientHeader homeLink />
      <ClientDesktopTopbar
        title="Menú"
        subtitle="Elige, personaliza y paga sin filas"
      />
      <main id="contenido-principal" className={styles.main}>
        <div className={styles.desktopOverview}>
          <div className={styles.desktopContentGrid}>
            <DesktopProductExplorer
              categories={categories}
              products={initialProducts}
              title="Todos los sabores"
              subtitle="Encuentra tu antojo más rápido"
            />
            <DesktopOrderPanel products={initialProducts} />
          </div>
        </div>
        <header className={styles.heading}>
          <h1>Menú</h1>
          <p>Explora todos los sabores de BurgerDesk</p>
        </header>

        <div className={styles.searchField}>
          <label className={styles.searchLabel} htmlFor="buscar-productos">
            Buscar productos
          </label>
          <Search aria-hidden="true" />
          <input
            id="buscar-productos"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar hamburguesas, combos..."
            autoComplete="off"
            aria-controls="resultados-menu"
          />
        </div>

        <div className={styles.filters} aria-label="Filtrar por categoría">
          <Chip selected={category === "all"} onClick={() => selectCategory("all")}>
            Todas
          </Chip>
          {contextualCategoryLabel ? (
            <Chip selected onClick={() => selectCategory(category)}>
              {contextualCategoryLabel}
            </Chip>
          ) : null}
          {categories.map((item) => (
            <Chip
              key={item.id}
              selected={category === item.id}
              onClick={() => selectCategory(item.id)}
            >
              {item.name}
            </Chip>
          ))}
          <span className={styles.resultCount} role="status" aria-live="polite">
            {products.length} prod.
          </span>
        </div>

        <section
          id="resultados-menu"
          className={styles.results}
          aria-label="Productos del menú"
        >
          {products.length === 0 ? (
            <Feedback
              variant="empty"
              title="No encontramos productos"
              description="Prueba otra búsqueda o vuelve a todas las categorías."
              action={
                <Button fullWidth variant="secondary" onClick={resetFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : null}
          {products.length > 0 ? (
            <MobileProductCarousel
              products={products}
              ariaLabel="Productos del menú"
              itemsPerPage={4}
            />
          ) : null}
        </section>
      </main>
      <ClientBottomNav active="menu" />
    </div>
  );
}
