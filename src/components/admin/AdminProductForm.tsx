"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, ImagePlus } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  acceptedAdminProductImageMimeTypes,
  MAX_ADMIN_PRODUCT_IMAGE_BYTES,
  type AdminProduct,
} from "@/domain/admin-products";
import type { Category } from "@/domain/models";
import { Button, Dialog, Field } from "@/components/ui";
import styles from "./AdminProductForm.module.css";

type ProductFormField =
  | "name"
  | "summary"
  | "priceCop"
  | "primaryCategoryId"
  | "image"
  | "expectedUpdatedAt"
  | "product";

type ProductFormErrors = Partial<Record<ProductFormField, string>>;

type ProductFormDraft = {
  name: string;
  summary: string;
  priceCop: number;
  primaryCategoryId: string;
  available: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.message === "string"
    ? value.message
    : fallback;
}

function responseErrors(value: unknown): ProductFormErrors {
  if (!isRecord(value) || !isRecord(value.errors)) return {};
  const errors: ProductFormErrors = {};
  for (const field of [
    "name",
    "summary",
    "priceCop",
    "primaryCategoryId",
    "image",
    "expectedUpdatedAt",
    "product",
  ] as const) {
    const message = value.errors[field];
    if (typeof message === "string") errors[field] = message;
  }
  return errors;
}

export function AdminProductForm({
  mode,
  categories,
  initialProduct,
}: {
  mode: "create" | "edit";
  categories: readonly Category[];
  initialProduct?: AdminProduct;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialProduct?.name ?? "");
  const [summary, setSummary] = useState(initialProduct?.summary ?? "");
  const [price, setPrice] = useState(
    initialProduct ? String(initialProduct.priceCop) : "",
  );
  const [categoryId, setCategoryId] = useState(
    initialProduct?.primaryCategoryId ?? categories[0]?.id ?? "",
  );
  const [available, setAvailable] = useState(initialProduct?.available ?? true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(initialProduct?.imagePath ?? "");
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<ProductFormDraft | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const pendingRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  function clearFieldError(field: ProductFormField) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    clearFieldError("image");
    if (!file) return;
    if (
      !acceptedAdminProductImageMimeTypes.some((mimeType) => mimeType === file.type) ||
      file.size > MAX_ADMIN_PRODUCT_IMAGE_BYTES
    ) {
      setErrors((current) => ({
        ...current,
        image: "Usa una imagen JPEG, PNG o WebP de máximo 5 MB.",
      }));
      event.currentTarget.value = "";
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setImageFile(file);
    setPreviewUrl(objectUrl);
  }

  function validateDraft(): ProductFormDraft | null {
    const nextErrors: ProductFormErrors = {};
    const trimmedName = name.trim();
    const trimmedSummary = summary.trim();
    const priceCop = Number(price);
    if (!trimmedName || trimmedName.length > 191) {
      nextErrors.name = "Escribe un nombre de hasta 191 caracteres.";
    }
    if (!trimmedSummary || trimmedSummary.length > 255) {
      nextErrors.summary = "Escribe una descripción de hasta 255 caracteres.";
    }
    if (!/^\d+$/.test(price) || !Number.isSafeInteger(priceCop) || priceCop < 1) {
      nextErrors.priceCop = "Escribe un precio COP entero positivo.";
    }
    if (!categories.some((category) => category.id === categoryId)) {
      nextErrors.primaryCategoryId = "Selecciona una categoría disponible.";
    }
    if (mode === "create" && !imageFile) {
      nextErrors.image = "Selecciona una imagen para el producto.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setMessage("Corrige los campos marcados antes de continuar.");
      window.requestAnimationFrame(() => {
        if (nextErrors.image) imageInputRef.current?.focus();
        else nameRef.current?.focus();
      });
      return null;
    }
    return {
      name: trimmedName,
      summary: trimmedSummary,
      priceCop,
      primaryCategoryId: categoryId,
      available,
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const nextDraft = validateDraft();
    if (!nextDraft) return;
    setMessage(null);
    setDraft(nextDraft);
    setConfirmOpen(true);
  }

  async function confirmSave() {
    if (!draft || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setMessage(null);

    const body = new FormData();
    const productPayload =
      mode === "create"
        ? draft
        : {
            expectedUpdatedAt: initialProduct?.updatedAt,
            patch: draft,
          };
    body.set("product", JSON.stringify(productPayload));
    if (imageFile) body.set("image", imageFile);

    try {
      const endpoint =
        mode === "create"
          ? "/api/administrador/products"
          : `/api/administrador/products/${initialProduct?.id}`;
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        body,
        credentials: "same-origin",
        cache: "no-store",
      });
      const value: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const nextErrors = responseErrors(value);
        setErrors(nextErrors);
        throw new Error(
          responseMessage(value, "No fue posible guardar el producto."),
        );
      }
      setConfirmOpen(false);
      router.replace("/administrador/productos");
      router.refresh();
    } catch (error: unknown) {
      pendingRef.current = false;
      setPending(false);
      setConfirmOpen(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible guardar el producto.",
      );
    }
  }

  const title = mode === "create" ? "Nuevo producto" : "Editar producto";
  const submitLabel = mode === "create" ? "Guardar producto" : "Guardar cambios";

  return (
    <main id="contenido-principal" className={styles.main}>
      <header className={styles.heading}>
        <h1>{title}</h1>
        <p>Formulario del menú digital</p>
      </header>

      {message ? (
        <div className={styles.formMessage} role="alert">
          {message}
        </div>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <section className={styles.imageSection} aria-labelledby="product-image-label">
          <div className={styles.preview}>
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt={`Vista previa de ${name.trim() || "producto"}`}
                fill
                sizes="(max-width: 767px) calc(100vw - 2rem), (max-width: 1023px) 38vw, 28rem"
                loading="eager"
                unoptimized={previewUrl.startsWith("blob:")}
                className={styles.previewImage}
              />
            ) : (
              <div className={styles.emptyPreview}>
                <ImagePlus aria-hidden="true" />
                <span>Selecciona una imagen</span>
              </div>
            )}
            <span id="product-image-label" className={styles.previewBadge}>
              Vista previa
            </span>
          </div>
          <label className={styles.fileButton} htmlFor="admin-product-image">
            <Camera aria-hidden="true" />
            {previewUrl ? "Cambiar imagen" : "Elegir imagen"}
          </label>
          <input
            ref={imageInputRef}
            id="admin-product-image"
            className={styles.fileInput}
            type="file"
            name="image"
            accept={acceptedAdminProductImageMimeTypes.join(",")}
            onChange={handleImageChange}
            aria-describedby="admin-product-image-help admin-product-image-error"
          />
          <p id="admin-product-image-help" className={styles.helpText}>
            JPEG, PNG o WebP · Máximo 5 MB
          </p>
          {imageFile ? <p className={styles.fileName}>{imageFile.name}</p> : null}
          {errors.image ? (
            <p id="admin-product-image-error" className={styles.fieldError} role="alert">
              {errors.image}
            </p>
          ) : null}
        </section>

        <Field
          ref={nameRef}
          id="admin-product-name"
          name="name"
          label="Nombre del producto"
          value={name}
          maxLength={191}
          disabled={pending}
          error={errors.name}
          onChange={(event) => {
            setName(event.currentTarget.value);
            clearFieldError("name");
          }}
        />

        <div className={styles.fieldGroup}>
          <label htmlFor="admin-product-summary">Descripción</label>
          <textarea
            id="admin-product-summary"
            name="summary"
            value={summary}
            maxLength={255}
            disabled={pending}
            aria-invalid={Boolean(errors.summary) || undefined}
            aria-describedby={errors.summary ? "admin-product-summary-error" : undefined}
            onChange={(event) => {
              setSummary(event.currentTarget.value);
              clearFieldError("summary");
            }}
          />
          {errors.summary ? (
            <p id="admin-product-summary-error" className={styles.fieldError} role="alert">
              {errors.summary}
            </p>
          ) : null}
        </div>

        <div className={styles.splitFields}>
          <Field
            id="admin-product-price"
            name="priceCop"
            label="Precio"
            value={price}
            inputMode="numeric"
            autoComplete="off"
            placeholder="26900"
            maxLength={12}
            disabled={pending}
            error={errors.priceCop}
            onChange={(event) => {
              setPrice(event.currentTarget.value.replace(/\D/g, ""));
              clearFieldError("priceCop");
            }}
          />

          <div className={styles.fieldGroup}>
            <label htmlFor="admin-product-category">Categoría</label>
            <select
              id="admin-product-category"
              name="primaryCategoryId"
              value={categoryId}
              disabled={pending}
              aria-invalid={Boolean(errors.primaryCategoryId) || undefined}
              aria-describedby={
                errors.primaryCategoryId ? "admin-product-category-error" : undefined
              }
              onChange={(event) => {
                setCategoryId(event.currentTarget.value);
                clearFieldError("primaryCategoryId");
              }}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.primaryCategoryId ? (
              <p id="admin-product-category-error" className={styles.fieldError} role="alert">
                {errors.primaryCategoryId}
              </p>
            ) : null}
          </div>
        </div>

        <label className={styles.switchRow}>
          <span>Disponible en el menú</span>
          <span className={styles.switchControl}>
            <span>{available ? "Sí" : "No"}</span>
            <input
              type="checkbox"
              name="available"
              checked={available}
              disabled={pending}
              onChange={(event) => setAvailable(event.currentTarget.checked)}
            />
            <span className={styles.switchTrack} aria-hidden="true">
              <span />
            </span>
          </span>
        </label>

        <div className={styles.actions}>
          <Link href="/administrador/productos" className={styles.cancelLink}>
            Cancelar
          </Link>
          <Button
            type="submit"
            loading={pending}
            loadingLabel="Guardando"
            leadingIcon={<Check />}
            className={styles.saveButton}
          >
            {submitLabel}
          </Button>
        </div>
      </form>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (!pending) setConfirmOpen(false);
        }}
        title={mode === "create" ? "Guardar producto" : "Guardar cambios"}
        description="Confirma los datos antes de modificar el menú digital."
        closeLabel="Cerrar confirmación"
        initialFocusSelector="[data-product-cancel]"
        actions={
          <>
            <Button
              data-product-cancel
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              Volver
            </Button>
            <Button
              loading={pending}
              loadingLabel="Guardando"
              onClick={confirmSave}
            >
              Confirmar
            </Button>
          </>
        }
      >
        {draft ? (
          <dl className={styles.confirmSummary}>
            <div><dt>Producto</dt><dd>{draft.name}</dd></div>
            <div><dt>Precio</dt><dd>${draft.priceCop.toLocaleString("es-CO")}</dd></div>
            <div><dt>Categoría</dt><dd>{categories.find((item) => item.id === draft.primaryCategoryId)?.name}</dd></div>
            <div><dt>Disponibilidad</dt><dd>{draft.available ? "Disponible" : "No disponible"}</dd></div>
            <div><dt>Imagen</dt><dd>{imageFile ? "Nueva imagen seleccionada" : "Conservar imagen actual"}</dd></div>
          </dl>
        ) : null}
      </Dialog>
    </main>
  );
}
