import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui";
import { formatCop } from "@/domain/currency";
import type { Product } from "@/domain/models";
import styles from "./ProductCard.module.css";

export interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className={styles.card} data-available={product.available}>
      <div className={styles.imageFrame}>
        <Image
          src={product.imagePath}
          alt={`${product.name}: ${product.summary}`}
          fill
          sizes="(max-width: 430px) 45vw, 190px"
          className={styles.image}
        />
        {product.badge ? (
          <Badge className={styles.badge} tone="promotion">
            {product.badge}
          </Badge>
        ) : null}
        {!product.available ? (
          <Badge className={styles.badge} tone="danger">
            No disponible
          </Badge>
        ) : null}
      </div>
      <div className={styles.copy}>
        <h3>{product.name}</h3>
        <p>{product.summary}</p>
      </div>
      <div className={styles.footer}>
        <span className={styles.price}>{formatCop(product.priceCop)}</span>
        {product.available ? (
          <Link
            className={styles.more}
            href={`/menu/${product.id}`}
            aria-label={`Ver detalle de ${product.name}`}
          >
            <Plus aria-hidden="true" />
          </Link>
        ) : (
          <span
            className={styles.more}
            data-disabled="true"
            aria-label={`${product.name} no está disponible`}
            role="img"
          >
            <Plus aria-hidden="true" />
          </span>
        )}
      </div>
    </article>
  );
}
