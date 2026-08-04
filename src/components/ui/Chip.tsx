import { forwardRef, type ButtonHTMLAttributes } from "react";
import styles from "./Chip.module.css";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  {
    selected = false,
    className,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  const classes = [styles.chip, className].filter(Boolean).join(" ");

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classes}
      aria-pressed={selected}
      data-selected={selected || undefined}
    >
      {children}
    </button>
  );
});
