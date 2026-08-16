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
import styles from "./MobileProductCarousel.module.css";

export interface MobileProductCarouselProps {
  products: readonly Product[];
  ariaLabel?: string;
  itemsPerPage?: number;
}

const DEFAULT_PRODUCTS_PER_PAGE = 2;

export function MobileProductCarousel({
  products,
  ariaLabel = "Productos",
  itemsPerPage = DEFAULT_PRODUCTS_PER_PAGE,
}: MobileProductCarouselProps) {
  const productSignature = products.map((product) => product.id).join("|");
  const carouselSignature = `${itemsPerPage}:${productSignature}`;
  const [pageState, setPageState] = useState({
    signature: carouselSignature,
    page: 0,
  });
  const pages = useMemo(
    () => paginateItems(products, itemsPerPage),
    [itemsPerPage, products],
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
    <div className={styles.carousel} aria-label={ariaLabel}>
      <div className={styles.viewport} aria-live="polite">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {pageCount > 1 ? (
        <div className={styles.controls}>
          <button
            className={styles.arrow}
            type="button"
            onClick={previousPage}
            aria-label="Ver productos anteriores"
          >
            <ChevronLeft aria-hidden="true" />
          </button>

          <div className={styles.dots} aria-label="Páginas de productos">
            {pages.map((_, index) => (
              <button
                key={index}
                className={styles.dot}
                type="button"
                data-active={index === safePage || undefined}
                onClick={() => setPage(index)}
                aria-label={`Ir a la página ${index + 1} de ${pageCount}`}
                aria-current={index === safePage ? "page" : undefined}
              />
            ))}
          </div>

          <button
            className={styles.arrow}
            type="button"
            onClick={nextPage}
            aria-label="Ver más productos"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
