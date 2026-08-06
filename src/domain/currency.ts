import type { CopAmount } from "./models";

const copNumberFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCop(amount: CopAmount): string {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError("El importe COP debe ser un entero seguro no negativo.");
  }

  return `$${copNumberFormatter.format(amount)}`;
}
