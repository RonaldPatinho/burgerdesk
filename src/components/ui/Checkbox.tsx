import { Check } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./Checkbox.module.css";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    { id, label, description, className, disabled, ...props },
    ref,
  ) {
    const classes = [styles.checkbox, className].filter(Boolean).join(" ");

    return (
      <label className={classes} data-disabled={disabled || undefined}>
        <input
          {...props}
          ref={ref}
          id={id}
          type="checkbox"
          className={styles.input}
          disabled={disabled}
        />
        <span className={styles.control} aria-hidden="true">
          <Check />
        </span>
        <span className={styles.copy}>
          <span>{label}</span>
          {description ? (
            <span className={styles.description}>{description}</span>
          ) : null}
        </span>
      </label>
    );
  },
);
