"use client";

import { X } from "lucide-react";
import {
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
} from "react";
import { IconButton } from "./IconButton";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  closeLabel?: string;
  initialFocusSelector?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  closeLabel = "Cerrar diálogo",
  initialFocusSelector,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (!dialog.open) dialog.showModal();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const animationFrame = window.requestAnimationFrame(() => {
      const initialTarget = initialFocusSelector
        ? dialog.querySelector<HTMLElement>(initialFocusSelector)
        : dialog.querySelector<HTMLElement>(
            "[data-dialog-initial-focus], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
          );
      (initialTarget ?? dialog).focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      restoreFocusRef.current?.focus();
    };
  }, [initialFocusSelector, open]);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            ) : null}
          </div>
          <IconButton aria-label={closeLabel} onClick={onClose}>
            <X />
          </IconButton>
        </header>
        <div className={styles.body}>{children}</div>
        {actions ? <footer className={styles.actions}>{actions}</footer> : null}
      </div>
    </dialog>
  );
}
