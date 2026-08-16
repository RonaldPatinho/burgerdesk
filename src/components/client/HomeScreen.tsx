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
import { ClientDesktopMenuHero } from "./ClientDesktopMenuHero";
import { ClientPromotionCarousel } from "./ClientPromotionCarousel";
import { ClientDesktopTopbar } from "./ClientDesktopTopbar";
import { DesktopProductExplorer } from "./DesktopProductExplorer";
import { DesktopOrderPanel } from "./DesktopOrderPanel";
import { ClientHeader } from "./ClientHeader";
import { MobileProductCarousel } from "./MobileProductCarousel";
import styles from "./HomeScreen.module.css";

export interface HomeScreenProps {
  categories: readonly Category[];
  featuredProducts: readonly Product[];
  desktopCategories: readonly Category[];
  desktopProducts: readonly Product[];
  promotions: readonly Promotion[];
  customerMessage: string;
}

const categoryIcons: Partial<Record<CategoryId, LucideIcon>> = {
  combos: Grid2X2,
  clasicas: House,
  especiales: Heart,
  bebidas: Clock3,
};

function menuCategoryTarget(categoryId: CategoryId): CategoryId {
  if (categoryId === "clasicas" || categoryId === "especiales") {
    return "burgers";
  }

  return categoryId;
}

export function HomeScreen({
  categories,
  featuredProducts,
  desktopCategories,
  desktopProducts,
  promotions,
  customerMessage,
}: HomeScreenProps) {
  const promotion = promotions[0];
  const promotionProduct = promotion
    ? featuredProducts.find((product) => product.id === promotion.productId)
    : null;
  const featuredIds = new Set(featuredProducts.map((product) => product.id));
  const prioritizedProducts = [
    ...featuredProducts,
    ...desktopProducts.filter((product) => !featuredIds.has(product.id)),
  ];

  return (
    <div className={styles.page}>
      <ClientHeader />
      <ClientDesktopTopbar
        title="Menú"
        subtitle="Elige, personaliza y paga sin filas"
      />
      <main id="contenido-principal" className={styles.main}>
        {customerMessage ? (
          <aside className={styles.customerMessage} aria-label="Mensaje del local">
            <Clock3 aria-hidden="true" />
            <p>{customerMessage}</p>
          </aside>
        ) : null}
        <div className={styles.desktopOverview}>
          <ClientDesktopMenuHero
            promotion={promotion}
            promotionProduct={promotionProduct}
          />
          <div className={styles.desktopContentGrid}>
            <DesktopProductExplorer
              categories={desktopCategories}
              products={prioritizedProducts}
              title="Favoritos de la casa"
              subtitle="Encuentra tu próxima favorita"
            />
            <DesktopOrderPanel products={desktopProducts} />
          </div>
        </div>
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
              <ClientPromotionCarousel
                variant="mobile"
                priority
                slides={[
                  {
                    src: promotion.imagePath,
                    alt: promotionProduct
                      ? `Promoción ${promotionProduct.name}`
                      : "Promoción BurgerDesk",
                    label: promotionProduct?.name ?? "Combo recomendado",
                  },
                  {
                    src: "/images/promotions/combo2.webp",
                    alt: "Segundo combo recomendado de BurgerDesk",
                    label: "Combo especial",
                  },
                  {
                    src: "/images/products/cheddar.png",
                    alt: "Papas cheddar de BurgerDesk",
                    label: "Papas cheddar",
                  },
                ]}
              />
            </div>
          </section>
        ) : (
          <div className={styles.mobilePromotionFeedback}>
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
          </div>
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
                <li key={category.id} className={styles.categoryItem}>
                  <Link
                    className={styles.categoryCard}
                    href={`/menu?categoria=${encodeURIComponent(menuCategoryTarget(category.id))}`}
                    aria-label={`Ver productos de ${category.name}`}
                  >
                    <span className={styles.categoryIcon} aria-hidden="true">
                      <Icon />
                    </span>
                    <span>{category.name}</span>
                  </Link>
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
          {prioritizedProducts.length > 0 ? (
            <MobileProductCarousel
              products={prioritizedProducts}
              ariaLabel="Favoritos y productos destacados"
            />
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
