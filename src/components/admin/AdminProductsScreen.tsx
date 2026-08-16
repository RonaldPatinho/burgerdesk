import Link from "next/link";
import { PackageOpen, Plus, Search, X } from "lucide-react";
import type { AdminProduct } from "@/domain/admin-products";
import { AdminProductCard } from "./AdminProductCard";
import styles from "./AdminProductsScreen.module.css";

export function AdminProductsScreen({
  products,
  categoryNames,
  search,
}: {
  products: readonly AdminProduct[];
  categoryNames: Readonly<Record<string, string>>;
  search: string;
}) {
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

      {products.length > 0 ? (
        <section aria-label="Catálogo activo">
          <ul className={styles.grid}>
            {products.map((product) => (
              <li key={product.id}>
                <AdminProductCard
                  product={product}
                  categoryName={
                    (product.primaryCategoryId &&
                      categoryNames[product.primaryCategoryId]) ||
                    "Sin categoría"
                  }
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
    </main>
  );
}
