import { forwardRef, type ButtonHTMLAttributes } from "react";
import styles from "./IconButton.module.css";

type IconButtonVariant = "filled" | "surface" | "danger" | "ghost";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  "aria-label": string;
  variant?: IconButtonVariant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      children,
      className,
      variant = "surface",
      type = "button",
      ...props
    },
    ref,
  ) {
    const classes = [styles.button, className].filter(Boolean).join(" ");

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={classes}
        data-variant={variant}
      >
        <span aria-hidden="true">{children}</span>
      </button>
    );
  },
);
