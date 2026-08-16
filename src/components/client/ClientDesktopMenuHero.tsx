import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product, Promotion } from "@/domain/models";
import { ClientPromotionCarousel } from "./ClientPromotionCarousel";
import styles from "./ClientDesktopMenuHero.module.css";

export interface ClientDesktopMenuHeroProps {
  promotion?: Promotion;
  promotionProduct?: Product | null;
  actionHref?: string;
}

export function ClientDesktopMenuHero({
  promotion,
  promotionProduct,
  actionHref = "/menu",
}: ClientDesktopMenuHeroProps) {
  if (!promotion) return null;

  const slides = [
    {
      src: promotion.imagePath,
      alt: promotionProduct
        ? `Combo recomendado: ${promotionProduct.name}`
        : "Combo recomendado de BurgerDesk",
      label: "Combo recomendado",
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
  ] as const;

  return (
    <section className={styles.hero} aria-labelledby="desktop-menu-hero-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>SABOR BENDITO · HECHO AL MOMENTO</p>
        <h2 id="desktop-menu-hero-title">Tu antojo, listo sin hacer fila.</h2>
        <p className={styles.description}>
          Pide desde la app y retira en el mostrador.
        </p>
        <Link className={styles.action} href={actionHref}>
          <ArrowRight aria-hidden="true" />
          <span>Explorar menú</span>
        </Link>
      </div>

      <div className={styles.visual}>
        <ClientPromotionCarousel slides={slides} variant="desktop" priority />
      </div>
    </section>
  );
}
