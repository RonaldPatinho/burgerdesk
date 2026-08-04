import type { CopAmount } from "./models";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  currencyDisplay: "code",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCop(amount: CopAmount): string {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError("El importe COP debe ser un entero seguro no negativo.");
  }

  return copFormatter.format(amount).replace(/\u00a0/g, " ");
}
