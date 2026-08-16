"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button, Chip, Feedback } from "@/components/ui";
import type { Category, CategoryId, Product, Promotion } from "@/domain/models";
import { provisionalCatalogService } from "@/services/provisional";
import { ClientBottomNav } from "./ClientBottomNav";
import { ClientDesktopTopbar } from "./ClientDesktopTopbar";
import { DesktopProductExplorer } from "./DesktopProductExplorer";
import { DesktopOrderPanel } from "./DesktopOrderPanel";
import { MobileProductCarousel } from "./MobileProductCarousel";
import { ClientHeader } from "./ClientHeader";
import styles from "./MenuScreen.module.css";

type CategoryFilter = "all" | CategoryId;
type ResultsStatus = "ready" | "loading" | "error";

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
  const initialVisibleProducts =
    resolvedInitialCategory === "all"
      ? initialProducts
      : initialProducts.filter((product) =>
          product.categoryIds.includes(resolvedInitialCategory),
        );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>(resolvedInitialCategory);
  const [products, setProducts] = useState<readonly Product[]>(initialVisibleProducts);
  const [status, setStatus] = useState<ResultsStatus>("ready");
  const [retryToken, setRetryToken] = useState(0);
  const categoryIsInDefaultFilters =
    category === "all" || categories.some((item) => item.id === category);
  const contextualCategoryLabel =
    category !== "all" && !categoryIsInDefaultFilters
      ? (categoryLabels[category] ?? category)
      : null;

  useEffect(() => {
    let active = true;

    void provisionalCatalogService
      .listProducts({
        categoryId: category === "all" ? undefined : category,
        search,
      })
      .then((results) => {
        if (!active) return;
        setProducts(results);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [category, retryToken, search]);

  function resetFilters() {
    setStatus("loading");
    setSearch("");
    setCategory("all");
  }

  function selectCategory(nextCategory: CategoryFilter) {
    setStatus("loading");
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
            onChange={(event) => {
              setStatus("loading");
              setSearch(event.target.value);
            }}
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
          aria-busy={status === "loading" || undefined}
        >
          {status === "loading" ? (
            <Feedback
              variant="loading"
              title="Buscando productos"
              description="Actualizando el menú provisional."
            />
          ) : null}
          {status === "error" ? (
            <Feedback
              variant="error"
              title="No pudimos cargar el menú"
              description="Intenta consultar nuevamente los datos provisionales."
              action={
                <Button
                  fullWidth
                  onClick={() => {
                    setStatus("loading");
                    setRetryToken((value) => value + 1);
                  }}
                >
                  Reintentar
                </Button>
              }
            />
          ) : null}
          {status === "ready" && products.length === 0 ? (
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
          {status === "ready" && products.length > 0 ? (
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
