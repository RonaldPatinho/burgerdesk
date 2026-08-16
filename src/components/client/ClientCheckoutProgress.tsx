import styles from "./ClientCheckoutProgress.module.css";

export interface ClientCheckoutProgressProps {
  currentStep: 1 | 2 | 3;
}

const steps = [
  { number: 1, label: "Carrito" },
  { number: 2, label: "Pago" },
  { number: 3, label: "Confirmación" },
] as const;

export function ClientCheckoutProgress({
  currentStep,
}: ClientCheckoutProgressProps) {
  return (
    <nav className={styles.progress} aria-label="Progreso del pedido">
      <ol>
        {steps.map((step) => {
          const status =
            step.number < currentStep
              ? "complete"
              : step.number === currentStep
                ? "current"
                : "upcoming";

          return (
            <li key={step.number} className={styles.step} data-status={status}>
              <span
                className={styles.circle}
                aria-current={status === "current" ? "step" : undefined}
              >
                {step.number}
              </span>
              <span className={styles.label}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
