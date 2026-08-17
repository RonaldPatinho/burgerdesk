"use client";

import Link from "next/link";
import {
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { AdminProduct } from "@/domain/admin-products";
import { formatCop } from "@/domain/currency";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { AdminProductCard } from "./AdminProductCard";
import {
  nextCarouselPage,
  paginateItems,
  previousCarouselPage,
  resolveCarouselPage,
} from "@/components/client/product-carousel-pagination";
import styles from "./AdminProductsScreen.module.css";

type PendingAction = "availability" | "archive" | "restore";

const DESKTOP_CAROUSEL_QUERY = "(min-width: 64rem)";

function subscribeDesktopCarousel(callback: () => void) {
  const media = window.matchMedia(DESKTOP_CAROUSEL_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getDesktopCarouselSnapshot() {
  return window.matchMedia(DESKTOP_CAROUSEL_QUERY).matches;
}

function getDesktopCarouselServerSnapshot() {
  return false;
}

function isAdminProduct(value: unknown): value is AdminProduct {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "updatedAt" in value &&
    typeof value.updatedAt === "string"
  );
}

async function readActionResponse(response: Response): Promise<AdminProduct> {
  const value = (await response.json().catch(() => null)) as unknown;
  const product =
    typeof value === "object" && value !== null && "product" in value
      ? value.product
      : null;
  if (response.ok && isAdminProduct(product)) return product;
  const message =
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
      ? value.message
      : "No fue posible actualizar el producto.";
  throw new Error(message);
}

export function AdminProductsScreen({
  products,
  archivedProducts,
  categoryNames,
  search,
}: {
  products: readonly AdminProduct[];
  archivedProducts: readonly AdminProduct[];
  categoryNames: Readonly<Record<string, string>>;
  search: string;
}) {
  const pendingRef = useRef<string | null>(null);
  const [pending, setPending] = useState<{
    productId: string;
    action: PendingAction;
  } | null>(null);
  const [overrides, setOverrides] = useState<
    Readonly<Record<string, AdminProduct>>
  >({});
  const [archivedIds, setArchivedIds] = useState<readonly string[]>([]);
  const [newlyArchivedProducts, setNewlyArchivedProducts] = useState<
    readonly AdminProduct[]
  >([]);
  const [restoredProducts, setRestoredProducts] = useState<readonly AdminProduct[]>([]);
  const [restoredIds, setRestoredIds] = useState<readonly string[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null);
  const [archiveLibraryOpen, setArchiveLibraryOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    error: boolean;
  } | null>(null);

  const visibleProducts = useMemo(
    () =>
      [...products, ...restoredProducts]
        .filter((product) => !archivedIds.includes(product.id))
        .map((product) => overrides[product.id] ?? product),
    [archivedIds, overrides, products, restoredProducts],
  );
  const visibleArchivedProducts = useMemo(() => {
    const byId = new Map<string, AdminProduct>();
    for (const product of [...archivedProducts, ...newlyArchivedProducts]) {
      if (!restoredIds.includes(product.id)) {
        byId.set(product.id, overrides[product.id] ?? product);
      }
    }
    return [...byId.values()];
  }, [archivedProducts, newlyArchivedProducts, overrides, restoredIds]);
  const isDesktopCarousel = useSyncExternalStore(
    subscribeDesktopCarousel,
    getDesktopCarouselSnapshot,
    getDesktopCarouselServerSnapshot,
  );
  const productsPerPage = isDesktopCarousel ? 4 : 2;
  const productSignature = visibleProducts.map((product) => product.id).join("|");
  const carouselSignature = `${productsPerPage}:${productSignature}`;
  const [pageState, setPageState] = useState({
    signature: carouselSignature,
    page: 0,
  });
  const pages = useMemo(
    () => paginateItems(visibleProducts, productsPerPage),
    [productsPerPage, visibleProducts],
  );
  const page = resolveCarouselPage(
    pageState,
    carouselSignature,
    pages.length,
  );
  const pageProducts = pages[page] ?? [];

  async function changeAvailability(product: AdminProduct) {
    if (pendingRef.current) return;
    pendingRef.current = product.id;
    setPending({ productId: product.id, action: "availability" });
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/administrador/products/${encodeURIComponent(product.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedUpdatedAt: product.updatedAt,
            available: !product.available,
          }),
        },
      );
      const updated = await readActionResponse(response);
      setOverrides((current) => ({ ...current, [updated.id]: updated }));
      setFeedback({
        message: `${updated.name} ahora está ${updated.available ? "disponible" : "fuera de venta"}.`,
        error: false,
      });
    } catch (error: unknown) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "No fue posible cambiar la disponibilidad.",
        error: true,
      });
    } finally {
      pendingRef.current = null;
      setPending(null);
    }
  }

  async function confirmArchive() {
    const product = archiveTarget;
    if (!product || pendingRef.current) return;
    pendingRef.current = product.id;
    setPending({ productId: product.id, action: "archive" });
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/administrador/products/${encodeURIComponent(product.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedUpdatedAt: product.updatedAt }),
        },
      );
      const archived = await readActionResponse(response);
      setArchivedIds((current) =>
        current.includes(archived.id) ? current : [...current, archived.id],
      );
      setRestoredIds((current) => current.filter((id) => id !== archived.id));
      setRestoredProducts((current) =>
        current.filter((item) => item.id !== archived.id),
      );
      setNewlyArchivedProducts((current) => [
        ...current.filter((item) => item.id !== archived.id),
        archived,
      ]);
      setArchiveTarget(null);
      setFeedback({
        message: `${archived.name} fue archivado y salió del menú público.`,
        error: false,
      });
    } catch (error: unknown) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "No fue posible archivar el producto.",
        error: true,
      });
    } finally {
      pendingRef.current = null;
      setPending(null);
    }
  }

  async function restoreProduct(product: AdminProduct) {
    if (pendingRef.current) return;
    pendingRef.current = product.id;
    setPending({ productId: product.id, action: "restore" });
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/administrador/products/${encodeURIComponent(product.id)}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedUpdatedAt: product.updatedAt }),
        },
      );
      const restored = await readActionResponse(response);
      setRestoredIds((current) =>
        current.includes(restored.id) ? current : [...current, restored.id],
      );
      setArchivedIds((current) => current.filter((id) => id !== restored.id));
      setNewlyArchivedProducts((current) =>
        current.filter((item) => item.id !== restored.id),
      );
      setRestoredProducts((current) => [
        ...current.filter((item) => item.id !== restored.id),
        restored,
      ]);
      setOverrides((current) => ({ ...current, [restored.id]: restored }));
      setFeedback({
        message: `${restored.name} fue recuperado como no disponible. Actívalo cuando quieras publicarlo.`,
        error: false,
      });
    } catch (error: unknown) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "No fue posible recuperar el producto.",
        error: true,
      });
    } finally {
      pendingRef.current = null;
      setPending(null);
    }
  }

  return (
    <main id="contenido-principal" className={styles.main}>
      <header className={styles.heading}>
        <h1>Productos</h1>
        <p>Editar menú digital</p>
      </header>

      <form className={styles.searchForm} role="search">
        <button type="submit" className={styles.searchButton} aria-label="Buscar productos">
          <Search aria-hidden="true" />
        </button>
        <label className={styles.srOnly} htmlFor="admin-product-search">
          Buscar productos
        </label>
        <input
          id="admin-product-search"
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Buscar hamburguesas, combos..."
          maxLength={100}
        />
        {search ? (
          <Link
            href="/administrador/productos"
            className={styles.clearSearch}
            aria-label="Limpiar búsqueda de productos"
          >
            <X aria-hidden="true" />
          </Link>
        ) : null}
      </form>

      <div className={styles.productActions}>
        <Link href="/administrador/productos/nuevo" className={styles.newProductLink}>
          <Plus aria-hidden="true" />
          Nuevo producto
        </Link>
        <button
          type="button"
          className={`${styles.archiveLibraryButton} ${styles.desktopArchiveButton}`}
          onClick={() => setArchiveLibraryOpen(true)}
        >
          <ArchiveRestore aria-hidden="true" />
          <span>Archivo</span>
          {visibleArchivedProducts.length > 0 ? (
            <span className={styles.archiveCount} aria-label={`${visibleArchivedProducts.length} productos archivados`}>
              {visibleArchivedProducts.length}
            </span>
          ) : null}
        </button>
      </div>

      {feedback ? (
        <p
          className={styles.actionFeedback}
          data-error={feedback.error || undefined}
          role={feedback.error ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}

      {visibleProducts.length > 0 ? (
        <section className={styles.catalogSection} aria-label="Catálogo activo">
          <div className={styles.carousel}>
            <ul className={styles.grid}>
              {pageProducts.map((product) => (
                <li key={product.id}>
                  <AdminProductCard
                    product={product}
                    eager
                    categoryName={
                      (product.primaryCategoryId &&
                        categoryNames[product.primaryCategoryId]) ||
                      "Sin categoría"
                    }
                    pendingAction={
                      pending?.productId === product.id &&
                      pending.action !== "restore"
                        ? pending.action
                        : null
                    }
                    actionsDisabled={pending !== null}
                    onToggleAvailability={() => changeAvailability(product)}
                    onRequestArchive={() => setArchiveTarget(product)}
                  />
                </li>
              ))}
            </ul>

            {pages.length > 1 ? (
              <nav
                className={styles.carouselControls}
                aria-label="Páginas de productos"
              >
                <button
                  type="button"
                  className={styles.carouselArrow}
                  onClick={() =>
                    setPageState({
                      signature: carouselSignature,
                      page: previousCarouselPage(page, pages.length),
                    })
                  }
                  aria-label="Productos anteriores"
                >
                  <ChevronLeft aria-hidden="true" />
                </button>

                <div className={styles.carouselDots}>
                  {pages.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={styles.carouselDot}
                      data-active={index === page || undefined}
                      onClick={() =>
                        setPageState({
                          signature: carouselSignature,
                          page: index,
                        })
                      }
                      aria-label={`Ir a la página ${index + 1} de ${pages.length}`}
                      aria-current={index === page ? "page" : undefined}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className={styles.carouselArrow}
                  onClick={() =>
                    setPageState({
                      signature: carouselSignature,
                      page: nextCarouselPage(page, pages.length),
                    })
                  }
                  aria-label="Más productos"
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </nav>
            ) : null}
          </div>
        </section>      ) : (
        <section className={styles.emptyState} aria-live="polite">
          <PackageOpen aria-hidden="true" />
          <h2>{search ? "Sin coincidencias" : "No hay productos activos"}</h2>
          <p>
            {search
              ? `No encontramos productos para “${search}”.`
              : "Crea un producto para empezar a gestionar el menú."}
          </p>
          {search ? (
            <Link href="/administrador/productos" className={styles.emptyAction}>
              Ver todos los productos
            </Link>
          ) : null}
        </section>
      )}

      <div className={styles.mobileArchiveAction}>
        <button
          type="button"
          className={styles.archiveLibraryButton}
          onClick={() => setArchiveLibraryOpen(true)}
        >
          <ArchiveRestore aria-hidden="true" />
          <span>Archivo</span>
          {visibleArchivedProducts.length > 0 ? (
            <span
              className={styles.archiveCount}
              aria-label={`${visibleArchivedProducts.length} productos archivados`}
            >
              {visibleArchivedProducts.length}
            </span>
          ) : null}
        </button>
      </div>

      <Dialog
        open={archiveLibraryOpen}
        onClose={() => {
          if (!pending) setArchiveLibraryOpen(false);
        }}
        title="Productos archivados"
        description="Recupera productos sin publicarlos de inmediato. Volverán como no disponibles hasta que decidas activarlos."
        closeLabel="Cerrar productos archivados"
        initialFocusSelector="[data-archive-library-close]"
        density="compact"
        actions={
          <Button
            data-archive-library-close
            variant="secondary"
            disabled={pending !== null}
            onClick={() => setArchiveLibraryOpen(false)}
          >
            Cerrar
          </Button>
        }
      >
        {visibleArchivedProducts.length > 0 ? (
          <ul className={styles.archiveList}>
            {visibleArchivedProducts.map((product) => (
              <li key={product.id} className={styles.archiveListItem}>
                <div className={styles.archiveItemInfo}>
                  <strong>{product.name}</strong>
                  <span>
                    {(product.primaryCategoryId &&
                      categoryNames[product.primaryCategoryId]) ||
                      "Sin categoría"}
                    {" · "}
                    {formatCop(product.priceCop)}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="compact"
                  loading={
                    pending?.productId === product.id &&
                    pending.action === "restore"
                  }
                  loadingLabel="Recuperando"
                  disabled={pending !== null && pending.productId !== product.id}
                  leadingIcon={<ArchiveRestore />}
                  onClick={() => restoreProduct(product)}
                >
                  Recuperar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.archiveEmpty} role="status">
            <ArchiveRestore aria-hidden="true" />
            <strong>No hay productos archivados</strong>
            <p>Los productos que archives aparecerán aquí para poder recuperarlos.</p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={archiveTarget !== null}
        onClose={() => {
          if (!pending) setArchiveTarget(null);
        }}
        title="Archivar producto"
        description="El producto dejará de aparecer en el catálogo público, pero sus datos e historial se conservarán."
        closeLabel="Cerrar confirmación de archivo"
        initialFocusSelector="[data-archive-cancel]"
        actions={
          <>
            <Button
              data-archive-cancel
              variant="secondary"
              disabled={pending !== null}
              onClick={() => setArchiveTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending?.action === "archive"}
              loadingLabel="Archivando"
              onClick={confirmArchive}
            >
              Archivar
            </Button>
          </>
        }
      >
        <p className={styles.archiveCopy}>
          {archiveTarget
            ? `Vas a archivar “${archiveTarget.name}”. Esta acción no elimina el producto de la base de datos.`
            : ""}
        </p>
      </Dialog>
    </main>
  );
}
