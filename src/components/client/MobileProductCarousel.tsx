"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/domain/models";
import { ProductCard } from "./ProductCard";
import styles from "./MobileProductCarousel.module.css";

export interface MobileProductCarouselProps {
  products: readonly Product[];
  ariaLabel?: string;
}

const PRODUCTS_PER_PAGE = 2;

export function MobileProductCarousel({
  products,
  ariaLabel = "Productos",
}: MobileProductCarouselProps) {
  const productSignature = products.map((product) => product.id).join("|");
  const [pageState, setPageState] = useState({
    productSignature,
    page: 0,
  });
  const pages = useMemo(() => {
    const result: Product[][] = [];

    for (let index = 0; index < products.length; index += PRODUCTS_PER_PAGE) {
      result.push(products.slice(index, index + PRODUCTS_PER_PAGE));
    }

    return result;
  }, [products]);

  const pageCount = pages.length;
  const currentPage =
    pageState.productSignature === productSignature ? pageState.page : 0;
  const safePage =
    pageCount === 0 ? 0 : Math.min(currentPage, pageCount - 1);
  const visibleProducts = pages[safePage] ?? [];

  function setPage(page: number) {
    setPageState({ productSignature, page });
  }

  function previousPage() {
    if (pageCount <= 1) return;
    setPage((safePage - 1 + pageCount) % pageCount);
  }

  function nextPage() {
    if (pageCount <= 1) return;
    setPage((safePage + 1) % pageCount);
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
