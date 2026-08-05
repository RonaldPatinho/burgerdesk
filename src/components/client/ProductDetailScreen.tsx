"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShoppingBag } from "lucide-react";
import { Badge, Button, IconButton } from "@/components/ui";
import { MAX_QUANTITY_PER_CART_LINE } from "@/data/provisional";
import { createCartItemId } from "@/domain/cart";
import { formatCop } from "@/domain/currency";
import type { Product, ProductOptionId } from "@/domain/models";
import { calculateProductUnitPrice } from "@/domain/pricing";
import { useClientCart } from "./ClientCartProvider";
import { ClientHeader } from "./ClientHeader";
import styles from "./ProductDetailScreen.module.css";

type MessageTone = "success" | "error" | "notice";

interface DetailMessage {
  tone: MessageTone;
  text: string;
}

export interface ProductDetailScreenProps {
  product: Product;
}

export function ProductDetailScreen({ product }: ProductDetailScreenProps) {
  const [selectedOptionIds, setSelectedOptionIds] = useState<
    readonly ProductOptionId[]
  >(product.defaultOptionIds);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<DetailMessage | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const { addItem, status: cartStatus } = useClientCart();

  const unitPriceCop = useMemo(
    () =>
      product.available
        ? calculateProductUnitPrice(product, selectedOptionIds)
        : product.priceCop,
    [product, selectedOptionIds],
  );
  const totalCop = unitPriceCop * quantity;

  function toggleOption(optionId: ProductOptionId) {
    setMessage(null);
    setSelectedOptionIds((current) =>
      current.includes(optionId)
        ? current.filter((candidate) => candidate !== optionId)
        : [...current, optionId],
    );
  }

  async function handleAddToCart() {
    if (pendingRef.current || !product.available) return;

    pendingRef.current = true;
    setPending(true);
    setMessage(null);

    try {
      const result = await addItem({
        id: createCartItemId(product.id, selectedOptionIds),
        productId: product.id,
        optionIds: selectedOptionIds,
        quantity,
      });

      setMessage(
        result.quantityAdjusted
          ? {
              tone: "notice",
              text: `Se guardaron ${result.acceptedQuantity} unidades, el máximo permitido para esta selección.`,
            }
          : {
              tone: "success",
              text: `${product.name} se agregó al carrito.`,
            },
      );
    } catch {
      setMessage({
        tone: "error",
        text: "No pudimos guardar el producto. Intenta nuevamente.",
      });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  const visibleMessage =
    message ??
    (cartStatus === "error"
      ? {
          tone: "error" as const,
          text: "No pudimos leer el carrito guardado en este navegador.",
        }
      : null);

  return (
    <div className={styles.page}>
      <ClientHeader homeLink />
      <main id="contenido-principal" className={styles.main}>
        <Link className={styles.backLink} href="/menu">
          <ArrowLeft aria-hidden="true" />
          <span>Volver al menú</span>
        </Link>

        <div className={styles.hero}>
          {product.badge ? (
            <Badge className={styles.badge} tone="promotion">
              {product.badge}
            </Badge>
          ) : null}
          {!product.available ? (
            <Badge className={styles.badge} tone="danger">
              No disponible
            </Badge>
          ) : null}
          <Image
            src={product.imagePath}
            alt={`${product.name}: ${product.summary}`}
            fill
            sizes="(max-width: 430px) calc(100vw - 32px), 398px"
            className={styles.productImage}
            priority
          />
        </div>

        <section className={styles.productCopy} aria-labelledby="nombre-producto">
          <div className={styles.titleRow}>
            <h1 id="nombre-producto">{product.name}</h1>
            <span>{formatCop(product.priceCop)}</span>
          </div>
          <p>{product.detailDescription ?? product.summary}</p>
        </section>

        {product.options.length > 0 ? (
          <section className={styles.options} aria-labelledby="personaliza-producto">
            <div className={styles.sectionHeading}>
              <h2 id="personaliza-producto">Personaliza tu burger</h2>
              <p>Selecciona los complementos que prefieras</p>
            </div>
            <div className={styles.optionGrid}>
              {product.options.map((option) => {
                const selected = selectedOptionIds.includes(option.id);
                const optionPrice =
                  option.priceCop === 0 ? "incluida" : `+ ${formatCop(option.priceCop)}`;

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={styles.option}
                    data-selected={selected || undefined}
                    aria-pressed={selected}
                    disabled={!option.available || !product.available}
                    onClick={() => toggleOption(option.id)}
                  >
                    {option.name} · {optionPrice}
                    {!option.available ? " · No disponible" : ""}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className={styles.quantitySection} aria-labelledby="cantidad-producto">
          <div>
            <h2 id="cantidad-producto">Cantidad</h2>
            <div className={styles.quantityControl}>
              <IconButton
                variant="ghost"
                aria-label="Disminuir cantidad"
                disabled={quantity <= 1 || pending}
                onClick={() => {
                  setQuantity((current) => Math.max(1, current - 1));
                  setMessage(null);
                }}
              >
                <Minus />
              </IconButton>
              <output aria-live="polite" aria-label={`${quantity} unidades`}>
                {quantity}
              </output>
              <IconButton
                variant="ghost"
                aria-label="Aumentar cantidad"
                disabled={quantity >= MAX_QUANTITY_PER_CART_LINE || pending}
                onClick={() => {
                  setQuantity((current) =>
                    Math.min(MAX_QUANTITY_PER_CART_LINE, current + 1),
                  );
                  setMessage(null);
                }}
              >
                <Plus />
              </IconButton>
            </div>
          </div>
          <div className={styles.total}>
            <span>Total</span>
            <strong>{formatCop(totalCop)}</strong>
          </div>
        </section>

        <div
          className={styles.message}
          data-tone={visibleMessage?.tone}
          role={visibleMessage?.tone === "error" ? "alert" : "status"}
          aria-live={visibleMessage?.tone === "error" ? "assertive" : "polite"}
        >
          {visibleMessage?.text ?? ""}
        </div>
      </main>

      <div className={styles.addBar}>
        <Button
          className={styles.addButton}
          fullWidth
          leadingIcon={<ShoppingBag />}
          loading={pending}
          loadingLabel="Guardando producto"
          disabled={!product.available || cartStatus === "loading"}
          onClick={handleAddToCart}
        >
          {product.available
            ? `Agregar al carrito · ${formatCop(totalCop)}`
            : "Producto no disponible"}
        </Button>
      </div>
    </div>
  );
}
