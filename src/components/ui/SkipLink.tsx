import { type AnchorHTMLAttributes } from "react";
import styles from "./SkipLink.module.css";

export type SkipLinkProps = AnchorHTMLAttributes<HTMLAnchorElement>;

export function SkipLink({ className, ...props }: SkipLinkProps) {
  const classes = [styles.link, className].filter(Boolean).join(" ");
  return <a {...props} className={classes} />;
}
