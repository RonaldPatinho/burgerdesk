import { forwardRef, type HTMLAttributes } from "react";
import styles from "./Card.module.css";

type CardTone = "surface" | "cream" | "dark";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, tone = "surface", ...props },
  ref,
) {
  const classes = [styles.card, className].filter(Boolean).join(" ");
  return <div {...props} ref={ref} className={classes} data-tone={tone} />;
});
