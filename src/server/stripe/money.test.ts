import assert from "node:assert/strict";
import test from "node:test";
import {
  copToStripeMinorUnits,
  stripeMinorUnitsToWholeCop,
} from "./money";

test("convierte pesos COP enteros a unidades menores de Stripe", () => {
  assert.equal(copToStripeMinorUnits(37_000), 3_700_000);
});

test("acepta solo unidades menores que representen pesos COP enteros", () => {
  assert.equal(stripeMinorUnitsToWholeCop(3_700_000), 37_000);
  assert.equal(stripeMinorUnitsToWholeCop(3_700_001), null);
  assert.equal(stripeMinorUnitsToWholeCop(null), null);
});
