import Image from "next/image";
import Link from "next/link";
import { Archive, Eye, EyeOff, LoaderCircle, Pencil } from "lucide-react";
import type { AdminProduct } from "@/domain/admin-products";
import { formatCop } from "@/domain/currency";
import styles from "./AdminProductsScreen.module.css";

type PendingAction = "availability" | "archive" | null;

export function AdminProductCard({
  product,
  categoryName,
  pendingAction,
  actionsDisabled,
  onToggleAvailability,
  onRequestArchive,
}: {
  product: AdminProduct;
  categoryName: string;
  pendingAction: PendingAction;
  actionsDisabled: boolean;
  onToggleAvailability: () => void;
  onRequestArchive: () => void;
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
          <div className={styles.cardActions}>
            <button
              type="button"
              className={styles.availabilityButton}
              disabled={actionsDisabled}
              aria-label={`${product.available ? "Desactivar" : "Activar"} ${product.name}`}
              aria-busy={pendingAction === "availability" || undefined}
              onClick={onToggleAvailability}
            >
              {pendingAction === "availability" ? (
                <LoaderCircle aria-hidden="true" className={styles.spinner} />
              ) : product.available ? (
                <EyeOff aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
              <span>{product.available ? "Desactivar" : "Activar"}</span>
            </button>
            <Link
              href={`/administrador/productos/${product.id}/editar`}
              className={styles.editLink}
              aria-label={`Editar ${product.name}`}
              title={`Editar ${product.name}`}
            >
              <Pencil aria-hidden="true" />
            </Link>
            <button
              type="button"
              className={styles.archiveButton}
              disabled={actionsDisabled}
              aria-label={`Archivar ${product.name}`}
              aria-busy={pendingAction === "archive" || undefined}
              title={`Archivar ${product.name}`}
              onClick={onRequestArchive}
            >
              {pendingAction === "archive" ? (
                <LoaderCircle aria-hidden="true" className={styles.spinner} />
              ) : (
                <Archive aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
