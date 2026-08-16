import Image from "next/image";
import Link from "next/link";
import { Pencil } from "lucide-react";
import type { AdminProduct } from "@/domain/admin-products";
import { formatCop } from "@/domain/currency";
import styles from "./AdminProductsScreen.module.css";

export function AdminProductCard({
  product,
  categoryName,
}: {
  product: AdminProduct;
  categoryName: string;
}) {
  return (
    <article className={styles.card}>
      <div className={styles.imageFrame}>
        <Image
          src={product.imagePath}
          alt={product.name}
          fill
          sizes="(max-width: 430px) 42vw, 180px"
          className={styles.productImage}
        />
        <span
          className={styles.availability}
          data-available={product.available || undefined}
        >
          <span aria-hidden="true" />
          {product.available ? "Disponible" : "No disponible"}
        </span>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardHeading}>
          <h2>{product.name}</h2>
          {product.badge ? (
            <span className={styles.commercialBadge}>{product.badge}</span>
          ) : null}
        </div>
        <p className={styles.summary}>{product.summary}</p>
        <span className={styles.category}>{categoryName}</span>

        <div className={styles.cardFooter}>
          <strong>{formatCop(product.priceCop)}</strong>
          <Link
            href={`/administrador/productos/${product.id}/editar`}
            className={styles.editLink}
            aria-label={`Editar ${product.name}`}
            title={`Editar ${product.name}`}
          >
            <Pencil aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
