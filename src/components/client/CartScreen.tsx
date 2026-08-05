"use client";

import Image from "next/image";
import Link from "next/link";
import { CreditCard, MapPin, Minus, Plus, ShoppingBag } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button, Feedback, IconButton } from "@/components/ui";
import {
  MAX_QUANTITY_PER_CART_LINE,
  SERVICE_FEE_COP,
} from "@/data/provisional";
import { formatCop } from "@/domain/currency";
import type { CartItem, Product, StoreLocation } from "@/domain/models";
import { calculateCartPricing } from "@/domain/pricing";
import { ClientBottomNav } from "./ClientBottomNav";
import { useClientCart } from "./ClientCartProvider";
import { ClientHeader } from "./ClientHeader";
import styles from "./CartScreen.module.css";

interface CartScreenProps {
  products: readonly Product[];
  pickupStore: StoreLocation | null;
}

interface LineAvailability {
  available: boolean;
  message: string | null;
}

function getLineAvailability(
  item: CartItem,
  product: Product | undefined,
): LineAvailability {
  if (!product) {
    return {
      available: false,
      message: "Este producto ya no forma parte del menú.",
    };
  }

  if (!product.available) {
    return { available: false, message: "Este producto no está disponible." };
  }

  const unavailableOption = item.optionIds.find((optionId) => {
    const option = product.options.find((candidate) => candidate.id === optionId);
    return !option?.available;
  });

  if (unavailableOption) {
    return {
      available: false,
      message: "Una opción elegida ya no está disponible.",
    };
  }

  return { available: true, message: null };
}

export function CartScreen({ products, pickupStore }: CartScreenProps) {
  const {
    cart,
    status,
    setItemQuantity,
    removeItem,
    setKitchenNote,
    reload,
  } = useClientCart();
  const [message, setMessage] = useState("");
  const [operationError, setOperationError] = useState("");
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const pendingItemRef = useRef<string | null>(null);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const availabilityByItemId = useMemo(
    () =>
      new Map(
        cart.items.map((item) => [
          item.id,
          getLineAvailability(item, productById.get(item.productId)),
        ]),
      ),
    [cart.items, productById],
  );
  const hasUnavailableItems = [...availabilityByItemId.values()].some(
    (availability) => !availability.available,
  );
  const pricingResult = useMemo(() => {
    if (cart.items.length === 0 || hasUnavailableItems) {
      return { pricing: null, error: null };
    }

    try {
      return {
        pricing: calculateCartPricing(
          cart,
          products,
          SERVICE_FEE_COP,
          MAX_QUANTITY_PER_CART_LINE,
        ),
        error: null,
      };
    } catch {
      return {
        pricing: null,
        error: "No pudimos calcular el carrito con los datos disponibles.",
      };
    }
  }, [cart, hasUnavailableItems, products]);
  const pricedLineById = useMemo(
    () =>
      new Map(
        pricingResult.pricing?.lines.map((line) => [line.itemId, line]) ?? [],
      ),
    [pricingResult.pricing],
  );

  async function changeQuantity(item: CartItem, direction: -1 | 1) {
    if (pendingItemRef.current) return;

    pendingItemRef.current = item.id;
    setPendingItemId(item.id);
    setOperationError("");

    try {
      if (direction === -1 && item.quantity === 1) {
        const productName = productById.get(item.productId)?.name ?? "El producto";
        await removeItem(item.id);
        setMessage(`${productName} se eliminó del carrito.`);
        return;
      }

      const nextQuantity = Math.min(
        MAX_QUANTITY_PER_CART_LINE,
        item.quantity + direction,
      );
      await setItemQuantity(item.id, nextQuantity);
      setMessage(
        `Cantidad actualizada a ${nextQuantity} ${
          nextQuantity === 1 ? "unidad" : "unidades"
        }.`,
      );
    } catch {
      setOperationError(
        "No pudimos actualizar el carrito. Intenta nuevamente.",
      );
    } finally {
      pendingItemRef.current = null;
      setPendingItemId(null);
    }
  }

  function updateKitchenNote(value: string) {
    setOperationError("");
    void setKitchenNote(value).catch(() => {
      setOperationError(
        "No pudimos guardar la nota para cocina. Intenta nuevamente.",
      );
    });
  }

  const blockingMessage = pricingResult.error ?? operationError;

  return (
    <div className={styles.page}>
      <ClientHeader homeLink />
      <main id="contenido-principal" className={styles.main}>
        <header className={styles.heading}>
          <h1>Tu carrito</h1>
          <p>Revisa los productos antes de continuar</p>
        </header>

        {status === "loading" ? (
          <Feedback
            variant="loading"
            title="Cargando tu carrito"
            description="Estamos recuperando los productos guardados."
          />
        ) : null}

        {status === "error" && cart.items.length === 0 ? (
          <Feedback
            variant="error"
            title="No pudimos cargar tu carrito"
            description="Tus otros datos guardados permanecen intactos."
            action={
              <Button fullWidth onClick={() => void reload()}>
                Reintentar
              </Button>
            }
          />
        ) : null}

        {status !== "loading" &&
        !(status === "error" && cart.items.length === 0) &&
        cart.items.length === 0 ? (
          <Feedback
            variant="empty"
            title="Tu carrito está vacío"
            description="Explora el menú y agrega algo para comenzar."
            action={
              <Link className={styles.emptyAction} href="/menu">
                Ver menú
              </Link>
            }
          />
        ) : null}

        {cart.items.length > 0 && status !== "loading" ? (
          <>
            <section className={styles.cartItems} aria-label="Productos del carrito">
              {cart.items.map((item) => {
                const product = productById.get(item.productId);
                const pricedLine = pricedLineById.get(item.id);
                const availability = availabilityByItemId.get(item.id);
                const visibleOptionNames =
                  product?.options
                    .filter(
                      (option) =>
                        item.optionIds.includes(option.id) && option.priceCop > 0,
                    )
                    .map((option) => option.name) ?? [];
                const details =
                  visibleOptionNames.length > 0
                    ? visibleOptionNames.join(" · ")
                    : product?.summary ?? "Configuración no disponible";
                const itemPending = pendingItemId === item.id;

                return (
                  <article
                    key={item.id}
                    className={styles.cartItem}
                    data-unavailable={!availability?.available || undefined}
                  >
                    <div className={styles.productImage}>
                      {product ? (
                        <Image
                          src={product.imagePath}
                          alt=""
                          fill
                          sizes="(max-width: 359px) 64px, 72px"
                        />
                      ) : (
                        <ShoppingBag aria-hidden="true" />
                      )}
                    </div>
                    <div className={styles.productCopy}>
                      <h2>{product?.name ?? "Producto no disponible"}</h2>
                      <p>{details}</p>
                      {availability?.message ? (
                        <p className={styles.unavailableMessage}>
                          {availability.message}
                        </p>
                      ) : null}
                      <strong>
                        {pricedLine
                          ? formatCop(pricedLine.lineTotalCop)
                          : "Precio no disponible"}
                      </strong>
                    </div>
                    <div className={styles.quantityControl}>
                      <IconButton
                        className={styles.quantityButton}
                        variant="ghost"
                        aria-label={
                          item.quantity === 1
                            ? `Eliminar ${product?.name ?? "producto"} del carrito`
                            : `Disminuir cantidad de ${product?.name ?? "producto"}`
                        }
                        disabled={itemPending}
                        onClick={() => void changeQuantity(item, -1)}
                      >
                        <Minus />
                      </IconButton>
                      <output
                        aria-live="polite"
                        aria-label={`${item.quantity} unidades de ${
                          product?.name ?? "producto"
                        }`}
                      >
                        {item.quantity}
                      </output>
                      <IconButton
                        className={styles.quantityButton}
                        variant="ghost"
                        aria-label={`Aumentar cantidad de ${
                          product?.name ?? "producto"
                        }`}
                        disabled={
                          itemPending ||
                          !availability?.available ||
                          item.quantity >= MAX_QUANTITY_PER_CART_LINE
                        }
                        onClick={() => void changeQuantity(item, 1)}
                      >
                        <Plus />
                      </IconButton>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className={styles.noteSection} aria-labelledby="nota-cocina">
              <label id="nota-cocina" htmlFor="nota-para-cocina">
                Nota para cocina
              </label>
              <textarea
                id="nota-para-cocina"
                rows={1}
                value={cart.kitchenNote}
                placeholder="Agregar observación o alergia..."
                onChange={(event) => updateKitchenNote(event.target.value)}
              />
            </section>

            {hasUnavailableItems ? (
              <div className={styles.availabilityAlert} role="alert">
                <strong>Hay productos no disponibles.</strong>
                <span>Elimínalos para recalcular y continuar al pago.</span>
              </div>
            ) : null}

            {blockingMessage ? (
              <div className={styles.operationError} role="alert">
                {blockingMessage}
              </div>
            ) : null}

            {pricingResult.pricing ? (
              <section className={styles.summary} aria-labelledby="resumen-carrito">
                <h2 id="resumen-carrito">Resumen</h2>
                <dl>
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{formatCop(pricingResult.pricing.subtotalCop)}</dd>
                  </div>
                  <div>
                    <dt>Servicio</dt>
                    <dd>{formatCop(pricingResult.pricing.serviceFeeCop)}</dd>
                  </div>
                  <div className={styles.totalRow}>
                    <dt>Total</dt>
                    <dd>{formatCop(pricingResult.pricing.totalCop)}</dd>
                  </div>
                </dl>
                {pickupStore ? (
                  <p className={styles.pickup}>
                    <MapPin aria-hidden="true" />
                    <span>
                      Retiro en local · {pickupStore.pickupEstimateMinutes[0]}–
                      {pickupStore.pickupEstimateMinutes[1]} min
                    </span>
                  </p>
                ) : (
                  <p className={styles.pickupUnavailable} role="alert">
                    No hay un local de retiro disponible.
                  </p>
                )}
              </section>
            ) : null}

            {pricingResult.pricing && pickupStore ? (
              <Link className={styles.checkoutLink} href="/pago" prefetch={false}>
                <CreditCard aria-hidden="true" />
                <span>Continuar al pago</span>
              </Link>
            ) : (
              <button className={styles.checkoutLink} type="button" disabled>
                <CreditCard aria-hidden="true" />
                <span>Continuar al pago</span>
              </button>
            )}
          </>
        ) : null}

        <p className={styles.srMessage} role="status" aria-live="polite">
          {message}
        </p>
      </main>
      <ClientBottomNav active="order" />
    </div>
  );
}
