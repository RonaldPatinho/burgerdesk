const COP_MINOR_UNIT_FACTOR = 100;

export function copToStripeMinorUnits(amountCop: number): number {
  const amountMinor = amountCop * COP_MINOR_UNIT_FACTOR;
  if (
    !Number.isSafeInteger(amountCop) ||
    amountCop < 0 ||
    !Number.isSafeInteger(amountMinor)
  ) {
    throw new Error("INVALID_COP_AMOUNT");
  }
  return amountMinor;
}

export function stripeMinorUnitsToWholeCop(
  amountMinor: number | null,
): number | null {
  if (
    amountMinor === null ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor < 0 ||
    amountMinor % COP_MINOR_UNIT_FACTOR !== 0
  ) {
    return null;
  }
  return amountMinor / COP_MINOR_UNIT_FACTOR;
}
