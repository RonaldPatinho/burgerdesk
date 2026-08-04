import { type HTMLAttributes, type ReactNode } from "react";
import styles from "./Badge.module.css";

type BadgeTone = "neutral" | "promotion" | "danger" | "success";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  leadingIcon?: ReactNode;
}

export function Badge({
  tone = "neutral",
  leadingIcon,
  className,
  children,
  ...props
}: BadgeProps) {
  const classes = [styles.badge, className].filter(Boolean).join(" ");

  return (
    <span {...props} className={classes} data-tone={tone}>
      {leadingIcon ? (
        <span className={styles.icon} aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
