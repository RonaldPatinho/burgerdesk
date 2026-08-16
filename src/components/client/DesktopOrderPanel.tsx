"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShieldCheck, ShoppingBag } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button, Feedback, IconButton } from "@/components/ui";
import {
  MAX_QUANTITY_PER_CART_LINE,
  SERVICE_FEE_COP,
} from "@/data/provisional";
import { formatCop } from "@/domain/currency";
import type { CartItem, Product } from "@/domain/models";
import {
  calculateCartPricing,
  calculateProductUnitPrice,
} from "@/domain/pricing";
import { useClientCart } from "./ClientCartProvider";
import styles from "./DesktopOrderPanel.module.css";

export interface DesktopOrderPanelProps {
  products: readonly Product[];
}

function isItemAvailable(item: CartItem, product: Product | undefined): boolean {
  if (!product?.available) return false;

  return item.optionIds.every((optionId) =>
    product.options.some(
      (option) => option.id === optionId && option.available,
    ),
  );
}

function getItemTotalCop(
  item: CartItem,
  product: Product | undefined,
): number | null {
  if (!product) return null;

  try {
    return calculateProductUnitPrice(product, item.optionIds) * item.quantity;
  } catch {
    return null;
  }
}

export function DesktopOrderPanel({ products }: DesktopOrderPanelProps) {
  const {
    cart,
    cartCount,
    status,
    setItemQuantity,
    removeItem,
    reload,
  } = useClientCart();
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const pendingItemRef = useRef<string | null>(null);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const hasUnavailableItems = cart.items.some(
    (item) => !isItemAvailable(item, productById.get(item.productId)),
  );
  const pricing = useMemo(() => {
    if (cart.items.length === 0 || hasUnavailableItems) return null;

    try {
      return calculateCartPricing(
        cart,
        products,
        SERVICE_FEE_COP,
        MAX_QUANTITY_PER_CART_LINE,
      );
    } catch {
      return null;
    }
  }, [cart, hasUnavailableItems, products]);
  const pricedLineById = useMemo(
    () => new Map(pricing?.lines.map((line) => [line.itemId, line]) ?? []),
    [pricing],
  );

  async function changeQuantity(item: CartItem, direction: -1 | 1) {
    if (pendingItemRef.current) return;

    const product = productById.get(item.productId);
    const productName = product?.name ?? "El producto";
    pendingItemRef.current = item.id;
    setPendingItemId(item.id);
    setOperationError("");
    setStatusMessage("");

    try {
      if (direction === -1 && item.quantity === 1) {
        await removeItem(item.id);
        setStatusMessage(`${productName} se eliminó del carrito.`);
        return;
      }

      const nextQuantity = Math.min(
        MAX_QUANTITY_PER_CART_LINE,
        item.quantity + direction,
      );
      await setItemQuantity(item.id, nextQuantity);
      setStatusMessage(
        `Cantidad de ${productName} actualizada a ${nextQuantity}.`,
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

  return (
    <aside className={styles.panel} aria-labelledby="desktop-order-title">
      <div className={styles.heading}>
        <h2 id="desktop-order-title">Tu pedido</h2>
        <span className={styles.itemCount} aria-live="polite">
          {cartCount} {cartCount === 1 ? "ítem" : "ítems"}
        </span>
      </div>

      <div className={styles.divider} aria-hidden="true" />

      {status === "loading" ? (
        <Feedback
          variant="loading"
          title="Cargando tu pedido"
          description="Estamos recuperando tu carrito."
        />
      ) : null}

      {status === "error" && cart.items.length === 0 ? (
        <Feedback
          variant="error"
          title="No pudimos cargar tu pedido"
          description="Puedes intentar recuperar el carrito nuevamente."
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
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <ShoppingBag />
          </span>
          <div>
            <strong>Tu carrito está vacío</strong>
            <p>Agrega productos del menú para ver aquí tu pedido.</p>
          </div>
        </div>
      ) : null}

      {cart.items.length > 0 && status !== "loading" ? (
        <>
          <div className={styles.items}>
            {cart.items.map((item) => {
              const product = productById.get(item.productId);
              const pricedLine = pricedLineById.get(item.id);
              const available = isItemAvailable(item, product);
              const selectedOptions =
                product?.options
                  .filter((option) => item.optionIds.includes(option.id))
                  .map((option) => option.name) ?? [];
              const details =
                selectedOptions.length > 0
                  ? selectedOptions.join(" · ")
                  : product?.summary ?? "Configuración no disponible";
              const itemPending = pendingItemId === item.id;
              const lineTotalCop =
                pricedLine?.lineTotalCop ?? getItemTotalCop(item, product);

              return (
                <article
                  className={styles.item}
                  data-unavailable={!available || undefined}
                  key={item.id}
                >
                  <div className={styles.productImage}>
                    {product ? (
                      <Image
                        src={product.imagePath}
                        alt=""
                        fill
                        sizes="88px"
                      />
                    ) : (
                      <ShoppingBag aria-hidden="true" />
                    )}
                  </div>

                  <div className={styles.productCopy}>
                    <h3>{product?.name ?? "Producto no disponible"}</h3>
                    <p>{details}</p>
                    <strong>
                      {lineTotalCop !== null
                        ? formatCop(lineTotalCop)
                        : "Precio por revisar"}
                    </strong>
                    {!available ? (
                      <span className={styles.unavailable}>
                        Revisa este producto en el carrito.
                      </span>
                    ) : null}
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
                        !available ||
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
          </div>

          {operationError ? (
            <p className={styles.operationError} role="alert">
              {operationError}
            </p>
          ) : null}

          {hasUnavailableItems || !pricing ? (
            <p className={styles.pricingAlert} role="alert">
              Revisa el carrito para actualizar la disponibilidad y el total.
            </p>
          ) : (
            <dl className={styles.summary}>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatCop(pricing.subtotalCop)}</dd>
              </div>
              <div>
                <dt>Servicio</dt>
                <dd>{formatCop(pricing.serviceFeeCop)}</dd>
              </div>
              <div className={styles.totalRow}>
                <dt>Total</dt>
                <dd>{formatCop(pricing.totalCop)}</dd>
              </div>
            </dl>
          )}

          <Link className={styles.cartAction} href="/carrito">
            <ShoppingBag aria-hidden="true" />
            <span>Ir al carrito</span>
          </Link>

          <p className={styles.securePayment}>
            <ShieldCheck aria-hidden="true" />
            <span>Pago seguro integrado</span>
          </p>
        </>
      ) : null}

      <p className={styles.statusMessage} role="status" aria-live="polite">
        {statusMessage}
      </p>
    </aside>
  );
}
