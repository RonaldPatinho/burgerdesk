import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./Field.module.css";

type FieldMessageTone = "hint" | "error" | "success";
type FieldSize = "default" | "compact";

export interface FieldMessageProps {
  id?: string;
  tone?: FieldMessageTone;
  children: ReactNode;
}

export function FieldMessage({
  id,
  tone = "hint",
  children,
}: FieldMessageProps) {
  return (
    <p id={id} className={styles.message} data-tone={tone}>
      {children}
    </p>
  );
}

export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingAction?: ReactNode;
  size?: FieldSize;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  {
    id,
    label,
    hint,
    error,
    leadingIcon,
    trailingAction,
    size = "default",
    className,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId, hintId]
    .filter(Boolean)
    .join(" ");
  const classes = [styles.input, className].filter(Boolean).join(" ");

  return (
    <div className={styles.field} data-size={size}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.control} data-invalid={Boolean(error) || undefined}>
        {leadingIcon ? (
          <span className={styles.icon} aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}
        <input
          {...props}
          ref={ref}
          id={id}
          className={classes}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy || undefined}
        />
        {trailingAction ? (
          <span className={styles.trailingAction}>{trailingAction}</span>
        ) : null}
      </div>
      {error ? (
        <FieldMessage id={errorId} tone="error">
          {error}
        </FieldMessage>
      ) : hint ? (
        <FieldMessage id={hintId}>{hint}</FieldMessage>
      ) : null}
    </div>
  );
});
