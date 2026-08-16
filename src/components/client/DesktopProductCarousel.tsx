"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/domain/models";
import { ProductCard } from "./ProductCard";
import {
  nextCarouselPage,
  paginateItems,
  previousCarouselPage,
  resolveCarouselPage,
} from "./product-carousel-pagination";
import styles from "./DesktopProductCarousel.module.css";

export interface DesktopProductCarouselProps {
  products: readonly Product[];
  resetKey: string;
  ariaLabel?: string;
}

const PRODUCTS_PER_PAGE = 6;

export function DesktopProductCarousel({
  products,
  resetKey,
  ariaLabel = "Productos",
}: DesktopProductCarouselProps) {
  const productSignature = products.map((product) => product.id).join("|");
  const carouselSignature = `${resetKey}:${productSignature}`;
  const [pageState, setPageState] = useState({
    signature: carouselSignature,
    page: 0,
  });
  const pages = useMemo(
    () => paginateItems(products, PRODUCTS_PER_PAGE),
    [products],
  );

  const pageCount = pages.length;
  const safePage = resolveCarouselPage(
    pageState,
    carouselSignature,
    pageCount,
  );
  const visibleProducts = pages[safePage] ?? [];

  function setPage(page: number) {
    setPageState({ signature: carouselSignature, page });
  }

  function previousPage() {
    if (pageCount <= 1) return;
    setPage(previousCarouselPage(safePage, pageCount));
  }

  function nextPage() {
    if (pageCount <= 1) return;
    setPage(nextCarouselPage(safePage, pageCount));
  }

  return (
    <section className={styles.carousel} aria-label={ariaLabel}>
      <div className={styles.viewport}>
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <p className={styles.pageStatus} role="status" aria-live="polite">
        {pageCount > 0 ? `Página ${safePage + 1} de ${pageCount}` : ""}
      </p>

      {pageCount > 1 ? (
        <nav className={styles.controls} aria-label="Páginas de productos">
          <button
            className={styles.arrow}
            type="button"
            onClick={previousPage}
            aria-label="Página anterior de productos"
          >
            <ChevronLeft aria-hidden="true" />
          </button>

          <div className={styles.dots}>
            {pages.map((_, index) => (
              <button
                key={index}
                className={styles.dot}
                type="button"
                data-active={index === safePage || undefined}
                onClick={() => setPage(index)}
                aria-label={`Ir a la página ${index + 1} de productos`}
                aria-current={index === safePage ? "page" : undefined}
              />
            ))}
          </div>

          <button
            className={styles.arrow}
            type="button"
            onClick={nextPage}
            aria-label="Página siguiente de productos"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </section>
  );
}
