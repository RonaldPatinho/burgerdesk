"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./ClientPromotionCarousel.module.css";

export interface ClientPromotionSlide {
  src: string;
  alt: string;
  label: string;
}

export interface ClientPromotionCarouselProps {
  slides: readonly ClientPromotionSlide[];
  variant?: "desktop" | "mobile";
  priority?: boolean;
}

export function ClientPromotionCarousel({
  slides,
  variant = "desktop",
  priority = false,
}: ClientPromotionCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) return;

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 10_000);

    return () => window.clearTimeout(timer);
  }, [activeIndex, slides.length]);

  if (slides.length === 0) return null;

  const activeSlide = slides[activeIndex] ?? slides[0];

  return (
    <div
      className={styles.carousel}
      data-variant={variant}
      aria-roledescription="carrusel"
      aria-label="Promociones destacadas"
    >
      <span className={styles.badge}>{activeSlide.label}</span>

      <div className={styles.imageStage} aria-live="polite">
        <Image
          key={activeSlide.src}
          src={activeSlide.src}
          alt={activeSlide.alt}
          fill
          priority={priority && activeIndex === 0}
          sizes={
            variant === "desktop"
              ? "(min-width: 1280px) 36vw, (min-width: 768px) 42vw, 1px"
              : "(max-width: 430px) 43vw, 185px"
          }
        />
      </div>

      {slides.length > 1 ? (
        <div className={styles.dots} role="group" aria-label="Cambiar promoción">
          {slides.map((slide, index) => (
            <button
              key={slide.src}
              className={styles.dot}
              type="button"
              data-active={index === activeIndex || undefined}
              aria-label={`Mostrar promoción ${index + 1}: ${slide.label}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
