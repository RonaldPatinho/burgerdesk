import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "default" | "compact";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  inverse?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      className,
      variant = "primary",
      size = "default",
      fullWidth = false,
      loading = false,
      loadingLabel = "Cargando",
      leadingIcon,
      inverse = false,
      disabled,
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
        data-size={size}
        data-full-width={fullWidth || undefined}
        data-inverse={inverse || undefined}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
      >
        {loading ? (
          <LoaderCircle className={styles.spinner} aria-hidden="true" />
        ) : leadingIcon ? (
          <span className={styles.icon} aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}
        <span>{loading ? loadingLabel : children}</span>
      </button>
    );
  },
);
