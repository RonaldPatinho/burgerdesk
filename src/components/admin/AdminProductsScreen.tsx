"use client";

import Link from "next/link";
import { PackageOpen, Plus, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import type { AdminProduct } from "@/domain/admin-products";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { AdminProductCard } from "./AdminProductCard";
import styles from "./AdminProductsScreen.module.css";

type PendingAction = "availability" | "archive";

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
  categoryNames,
  search,
}: {
  products: readonly AdminProduct[];
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
  const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    error: boolean;
  } | null>(null);

  const visibleProducts = products
    .filter((product) => !archivedIds.includes(product.id))
    .map((product) => overrides[product.id] ?? product);

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
      setArchivedIds((current) => [...current, archived.id]);
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

      <Link href="/administrador/productos/nuevo" className={styles.newProductLink}>
        <Plus aria-hidden="true" />
        Nuevo producto
      </Link>

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
        <section aria-label="Catálogo activo">
          <ul className={styles.grid}>
            {visibleProducts.map((product) => (
              <li key={product.id}>
                <AdminProductCard
                  product={product}
                  categoryName={
                    (product.primaryCategoryId &&
                      categoryNames[product.primaryCategoryId]) ||
                    "Sin categoría"
                  }
                  pendingAction={
                    pending?.productId === product.id ? pending.action : null
                  }
                  actionsDisabled={pending !== null}
                  onToggleAvailability={() => changeAvailability(product)}
                  onRequestArchive={() => setArchiveTarget(product)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : (
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
