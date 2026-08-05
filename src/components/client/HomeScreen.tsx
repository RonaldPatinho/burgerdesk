import Image from "next/image";
import Link from "next/link";
import {
  Clock3,
  Grid2X2,
  Heart,
  House,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { Feedback } from "@/components/ui";
import type {
  Category,
  CategoryId,
  Product,
  Promotion,
} from "@/domain/models";
import { ClientBottomNav } from "./ClientBottomNav";
import { ClientHeader } from "./ClientHeader";
import { ProductCard } from "./ProductCard";
import styles from "./HomeScreen.module.css";

export interface HomeScreenProps {
  categories: readonly Category[];
  featuredProducts: readonly Product[];
  promotions: readonly Promotion[];
}

const categoryIcons: Partial<Record<CategoryId, LucideIcon>> = {
  combos: Grid2X2,
  clasicas: House,
  especiales: Heart,
  bebidas: Clock3,
};

export function HomeScreen({
  categories,
  featuredProducts,
  promotions,
}: HomeScreenProps) {
  const promotion = promotions[0];
  const promotionProduct = promotion
    ? featuredProducts.find((product) => product.id === promotion.productId)
    : null;

  return (
    <div className={styles.page}>
      <ClientHeader />
      <main id="contenido-principal" className={styles.main}>
        {promotion ? (
          <section className={styles.hero} aria-labelledby="promocion-principal">
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>{promotion.eyebrow}</p>
              <h1 id="promocion-principal">{promotion.title}</h1>
              <p className={styles.heroDescription}>{promotion.description}</p>
              <Link className={styles.heroAction} href="/menu">
                <LayoutGrid aria-hidden="true" />
                <span>{promotion.actionLabel}</span>
              </Link>
            </div>
            <div className={styles.promotionImage}>
              {promotionProduct ? (
                <span className={styles.promotionLabel}>
                  {promotionProduct.name}
                </span>
              ) : null}
              <Image
                src={promotion.imagePath}
                alt={
                  promotionProduct
                    ? `Promoción ${promotionProduct.name}`
                    : "Promoción BurgerDesk"
                }
                fill
                sizes="(max-width: 430px) 43vw, 185px"
                priority
              />
            </div>
          </section>
        ) : (
          <Feedback
            variant="empty"
            title="No hay promociones disponibles"
            description="Puedes explorar el menú completo."
            action={
              <Link className={styles.feedbackLink} href="/menu">
                Ver menú
              </Link>
            }
          />
        )}

        <section className={styles.categories} aria-labelledby="categorias-inicio">
          <div className={styles.sectionHeading}>
            <h2 id="categorias-inicio">Explora por categoría</h2>
            <p>Encuentra tu antojo más rápido</p>
          </div>
          <ul className={styles.categoryGrid}>
            {categories.map((category) => {
              const Icon = categoryIcons[category.id] ?? LayoutGrid;
              return (
                <li key={category.id} className={styles.categoryCard}>
                  <span className={styles.categoryIcon} aria-hidden="true">
                    <Icon />
                  </span>
                  <span>{category.name}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.featured} aria-labelledby="favoritos-inicio">
          <div className={styles.featuredHeading}>
            <h2 id="favoritos-inicio">Favoritos de la casa</h2>
            <Link href="/menu">Ver todo →</Link>
          </div>
          {featuredProducts.length > 0 ? (
            <div className={styles.productGrid}>
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <Feedback
              variant="empty"
              title="No hay favoritos disponibles"
              description="Revisa el menú para encontrar otros productos."
            />
          )}
        </section>
      </main>
      <ClientBottomNav active="home" />
    </div>
  );
}
